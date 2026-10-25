// 新しい絵(assets/art/ の透明PNG)から、アプリで使う軽い版を作る。npm run art
// 元の絵は変えない。まわりの透明な部分を切り落とし、色の数を減らしたPNGにして src/art/generated/ に置く。
// 切り落とした位置と art.json の中身は manifest.json に書き、アプリが元の位置に置き直す。
//
// 絵を読む場所を変えるとき(確かめ用の仮の絵など):ART_DIR=<フォルダ> npm run art
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import UPNG from 'upng-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(process.env.ART_DIR || path.join(ROOT, 'assets/art'));
const OUT = path.join(ROOT, 'src/art/generated');

/** 縮める割合(1 = 縮めない)。重すぎるときだけ下げる */
const SCALE = 1;
/** 色の数(256 = PNGの色の表の上限) */
const COLORS = 256;
/** 作り方を変えたら上げる(前に作った版を使わずに作り直す) */
const RECIPE = `1-${SCALE}-${COLORS}`;

const anchors = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/animals/anchors.json'), 'utf8'));
const wear = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/wear/wear.json'), 'utf8'));

/** アプリが使うファイル名(拡張子なし) */
function knownNames() {
  const names = new Set();
  for (const a of Object.keys(anchors.anchors)) {
    for (const p of ['body', 'body-mask', 'eyes']) names.add(`${a}_${p}`);
    for (const side of ['left', 'right']) {
      for (const tool of ['knit', 'crochet']) {
        names.add(`${a}_hand-${side}_${tool}`);
        names.add(`${a}_hand-${side}_${tool}_mask`);
      }
    }
  }
  for (const d of new Set(Object.values(anchors.defaultDecoration))) names.add(`deco_${d}`);
  for (const d of ['tulip', 'cosmos', 'hydrangea', 'sakura', 'daisy', 'sprout', 'clover', 'seaweed', 'coral', 'shell']) {
    names.add(`deco_${d}`);
  }
  for (const key of Object.keys(wear.worn)) {
    if (key.startsWith('paws_')) {
      names.add(`wear_${key}_left`);
      names.add(`wear_${key}_right`);
    } else names.add(`wear_${key}`);
  }
  for (const s of Object.keys(wear.interior.shapes)) names.add(`room_${s}`);
  return names;
}

function decode(buf) {
  const img = UPNG.decode(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  return { width: img.width, height: img.height, data: new Uint8Array(UPNG.toRGBA8(img)[0]) };
}

/** body-mask・手のマスク:白さ×濃さ を灰色にする(白=色を付ける、黒・透明=付けない) */
function maskToGray(img) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(((d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) * d[i + 3]) / 255);
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = v ? 255 : 0;
  }
  return img;
}

/** 透明でない(マスクは0でない)ところを囲む四角。全部透明なら null */
function contentBox(img) {
  const { width: w, height: h, data: d } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function crop(img, b) {
  const out = new Uint8Array(b.width * b.height * 4);
  for (let y = 0; y < b.height; y++) {
    const from = ((b.y + y) * img.width + b.x) * 4;
    out.set(img.data.subarray(from, from + b.width * 4), y * b.width * 4);
  }
  return { width: b.width, height: b.height, data: out };
}

/** 面積で平均して縮める(SCALE < 1 のときだけ) */
function resize(img, scale) {
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const out = new Uint8Array(w * h * 4);
  const sx = img.width / w;
  const sy = img.height / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.min(img.height, Math.ceil((y + 1) * sy)); yy++) {
        for (let xx = Math.floor(x * sx); xx < Math.min(img.width, Math.ceil((x + 1) * sx)); xx++) {
          const i = (yy * img.width + xx) * 4;
          const a = img.data[i + 3];
          acc[0] += img.data[i] * a;
          acc[1] += img.data[i + 1] * a;
          acc[2] += img.data[i + 2] * a;
          acc[3] += a;
          n++;
        }
      }
      const o = (y * w + x) * 4;
      if (acc[3]) for (let c = 0; c < 3; c++) out[o + c] = Math.round(acc[c] / acc[3]);
      out[o + 3] = Math.round(acc[3] / n);
    }
  }
  return { width: w, height: h, data: out };
}

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.warn(`art.json が読めません(決まりの値を使います):${e.message}`);
    return {};
  }
}

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

fs.mkdirSync(OUT, { recursive: true });
const manifestFile = path.join(OUT, 'manifest.json');
const before = readJson(manifestFile);
const known = knownNames();
const sources = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.png')) : [];
const files = {};
let total = { src: 0, out: 0 };

for (const file of sources.sort()) {
  const name = file.slice(0, -4);
  if (!known.has(name)) {
    console.warn(`使わないファイル名です(art-guide の名前を確かめてください):${file}`);
    continue;
  }
  const buf = fs.readFileSync(path.join(SRC, file));
  const hash = createHash('sha1').update(buf).update(RECIPE).digest('hex').slice(0, 12);
  const outName = `${name}.png`;
  const outFile = path.join(OUT, outName);
  const prev = before.files?.[name];
  if (prev?.hash === hash && fs.existsSync(outFile)) {
    files[name] = prev;
  } else {
    let img = decode(buf);
    if (name.endsWith('_body-mask') || name.endsWith('_mask')) img = maskToGray(img);
    const box = contentBox(img);
    if (!box) {
      console.warn(`全部透明なので使いません:${file}`);
      continue;
    }
    let part = crop(img, box);
    if (SCALE < 1) part = resize(part, SCALE);
    const png = Buffer.from(UPNG.encode([part.data.buffer], part.width, part.height, COLORS));
    fs.writeFileSync(outFile, png);
    files[name] = { ...box, canvasWidth: img.width, canvasHeight: img.height, hash, bytes: png.length, srcBytes: buf.length };
  }
  total.src += files[name].srcBytes;
  total.out += files[name].bytes;
  console.log(`${file}: ${kb(files[name].srcBytes)} → ${kb(files[name].bytes)}`);
}

// 今は使わなくなった軽い版を消す
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.png') && !files[f.slice(0, -4)]) fs.rmSync(path.join(OUT, f));
}

const manifest = { art: readJson(path.join(SRC, 'art.json')), files };
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
console.log(
  Object.keys(files).length
    ? `絵 ${Object.keys(files).length} 枚:${kb(total.src)} → ${kb(total.out)}(${SRC})`
    : `新しい絵はありません(${SRC})。今の絵(SVG)を使います`,
);
