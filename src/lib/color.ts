// 色の計算(選んだ色から、影や線の少し濃い色を作る)

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function hslToHex([h, s, l]: [number, number, number]): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/** 明るさを points(0〜100)だけ下げた色 */
export function darken(hex: string, points: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return hslToHex([h, s, Math.max(0, l - points)]);
}

const toHex = (rgb: number[]) =>
  `#${rgb.map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('')}`;

/** 赤・緑・青をそれぞれ ratio 倍にした色(0.85 なら約15%暗く)。素材の影の色と同じ作り方 */
export function shade(hex: string, ratio: number): string {
  return toHex(hexToRgb(hex).map((x) => x * ratio));
}

/** a と b を混ぜた色(t=0 で a、t=1 で b) */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return toHex(ca.map((x, i) => x + (cb[i] - x) * t));
}

/** #rgb・大文字を #rrggbb の小文字にそろえる。色でなければ null */
export function normalizeHex(s: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return null;
  return toHex(hexToRgb(m[1]));
}
