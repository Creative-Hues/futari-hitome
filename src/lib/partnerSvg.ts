// どうぶつ+頭飾りのSVGを、動かせる形に下ごしらえする。
// assets/ のファイルは変えない。読み込んだあとメモリの中で、目印付けと並びのまとめ直しだけをする。
//
// できあがり(HTML。下から):
//   <div .pt-stage>
//     <svg .pt-shadow>影</svg>                                   … 動かない
//     <div .pt-react>                                             … ふれあい・お祝い
//       <svg .pt-svg .pt-breath>体・身につけた作品・編み地・左右の手(.pt-hand-l / .pt-hand-r、手袋もこの中)・頭飾り(.pt-deco)</svg>  … 呼吸
//     </div>
//   </div>
// 体ごと動かす動き(呼吸・ふれあい・お祝い)は、SVGの中の g ではなく、SVG そのもの(HTMLの部品)で動かす。
// iPhone の Safari は、SVGの中の g を CSS で動かすと、clipPath・mask で切り取った部分(体の編み目など)の
// 描き直しがずれることがあるため。HTMLの部品の動きは、描き上がった絵のまま動かすので、ずれない。
// 切り取りの型(clipPath・mask)は、いちばん上の defs にまとめる(見た目は同じ)。
// かぎ針の作品では、左右の手から棒針を外し、右の手にかぎ針を持たせる(assets/tools/README.md)。
//
// 新しい絵(PNG)の子は preparePngPartner で、同じ重なり・同じ目印のまとまりに PNG を置く(動きの CSS はそのまま使える)。
// 絵の座標は SVG と同じ 240×240。PNG のない部品は、今のSVGから取り出して置く。
import type { Placed, Point } from './artConfig';
import { addClass, children, colorVar, el, image, parseSvg, prefixIds, serialize, SVG_NS } from './svgPrep';
import { addWear, type WearInput } from './wearSvg';

const EYE_FILLS = ['#1a1620', '#fdfbff'];
/** 左右の手の回転の中心(assets/README.md) */
export const HAND_CENTERS = { l: { x: 102, y: 150 }, r: { x: 138, y: 150 } };

/** 編み地の高さ(README:試作では4〜44)。p は 0〜1 */
export const KNIT_MIN = 4;
export const KNIT_MAX = 44;
export function knitHeight(p: number, min = KNIT_MIN, max = KNIT_MAX): number {
  const c = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
  return Math.round((min + (max - min) * c) * 10) / 10;
}

/** その子のもとの目の色(ひつじは白、ほかは黒) */
export function eyeFill(animalSvg: string): string {
  const m = /<circle\b[^>]*fill="(#1a1620|#fdfbff)"/.exec(animalSvg);
  return m?.[1] ?? EYE_FILLS[0];
}

export interface PartnerSvgInput {
  animal: string;
  decoration: string;
  anchor: { x: number; y: number };
  scale: number;
  prefix: string;
  /** 身につけた作品(なければ空) */
  wear?: WearInput[];
  /** かぎ針の素材(assets/tools/crochet_hook.svg)。かぎ針の作品のときだけ渡す。なければ棒針 */
  hook?: string;
}

/** 新しい絵(PNG)の部品。null の部品は今のSVGを使う。位置はすべて 240 の座標(頭飾りは頭飾りの座標) */
export interface PartnerPng {
  body: Placed;
  eyes: Placed | null;
  hands: { l: Placed; r: Placed } | null;
  /** 手の回転の中心 */
  centers: { l: Point; r: Point };
  /** 編み地の四角の左上と幅(高さは Partner が進み具合で決める) */
  knit: { x: number; y: number; width: number };
  decoration: Placed | null;
}

/** svg の外側の目印(どちらの絵でも同じ) */
function setRoot(root: Element) {
  root.removeAttribute('width');
  root.removeAttribute('height');
  root.setAttribute('class', 'pt-svg');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
}

/** 素材のSVGに、動かす部品の目印と色の CSS 変数を付ける */
function markAll(root: Element, prefix: string, hook?: string) {
  markKnit(root, prefix);
  markHands(root);
  if (hook) holdHook(root, hook, prefix);
  markBody(root, prefix);
  for (const c of root.querySelectorAll('circle')) {
    if (EYE_FILLS.includes(c.getAttribute('fill') ?? '')) {
      addClass(c, 'pt-eye');
      colorVar(c, 'fill', '--eye');
    }
  }
}

export function preparePartner(i: PartnerSvgInput): string {
  const root = parseSvg(prefixIds(i.animal, i.prefix));
  setRoot(root);
  markAll(root, i.prefix, i.hook);
  if (i.wear?.length) addWear(root, i.wear, i.prefix);
  return finish(root, i, null);
}

/**
 * 新しい絵(PNG)の子。重なりは SVG と同じ(影 → 体・目 → 身につけた作品 → 編み地 → 左右の手 → 頭飾り)。
 * 素材のSVGからは、色の模様(defs)・影・編み地の四角と、PNG のない部品(目・手・頭飾り)だけを使う
 */
export function preparePngPartner(i: PartnerSvgInput & { png: PartnerPng }): string {
  const src = parseSvg(prefixIds(i.animal, i.prefix));
  markAll(src, i.prefix, i.hook);
  const root = parseSvg(`<svg xmlns="${SVG_NS}" viewBox="${src.getAttribute('viewBox')}"></svg>`);
  setRoot(root);
  const take = (e: Element) => root.appendChild(root.ownerDocument.importNode(e, true)) as Element;
  const p = i.png;

  for (const c of children(src)) if (c.tagName === 'defs' || isShadow(c)) take(c);
  root.appendChild(image(root, p.body));
  if (p.eyes) {
    const g = el(root, 'g', { class: 'pt-eye' });
    g.appendChild(image(root, p.eyes));
    root.appendChild(g);
  } else {
    for (const e of src.querySelectorAll('.pt-eye')) take(e);
  }
  const knit = src.querySelector('.pt-knit');
  if (!knit) throw new Error('編み地が見つかりません');
  const k = take(knit);
  k.setAttribute('x', String(p.knit.x));
  k.setAttribute('y', String(p.knit.y));
  k.setAttribute('width', String(p.knit.width));
  for (const side of ['l', 'r'] as const) {
    if (p.hands) {
      const c = p.centers[side];
      const g = el(root, 'g', { class: `pt-hand-${side}`, style: `transform-origin: ${c.x}px ${c.y}px` });
      g.appendChild(image(root, p.hands[side]));
      root.appendChild(g);
    } else {
      take(src.querySelector(`.pt-hand-${side}`)!);
    }
  }
  if (i.wear?.length) addWear(root, i.wear, i.prefix);
  return finish(root, i, p.decoration);
}

/** 頭飾りを足し、影を別の SVG に分けて、動かす入れ物(HTML)に入れる */
function finish(root: Element, i: PartnerSvgInput, decoPng: Placed | null): string {

  // 頭飾り(anchors.json の位置に translate、大きさは scale。(0,0) が頭に触れる点)
  const place = el(root, 'g', {
    transform: `translate(${i.anchor.x} ${i.anchor.y}) scale(${i.scale})`,
  });
  const sway = el(root, 'g', { class: 'pt-deco' });
  if (decoPng) {
    sway.appendChild(image(root, decoPng));
  } else {
    const deco = parseSvg(prefixIds(i.decoration, `${i.prefix}d-`));
    for (const c of children(deco)) sway.appendChild(root.ownerDocument.importNode(c, true));
  }
  place.appendChild(sway);
  root.appendChild(place);

  // 切り取りの型を、いちばん上の defs へ(どこに置いても、切り取られる部品の位置で使われる)
  const defs = children(root).find((c) => c.tagName === 'defs') ?? root.insertBefore(el(root, 'defs'), root.firstChild);
  for (const c of root.querySelectorAll('clipPath, mask')) if (c.parentNode !== defs) defs.appendChild(c);

  // 影は動かない SVG に分ける
  const shadow = parseSvg(`<svg xmlns="${SVG_NS}" viewBox="${root.getAttribute('viewBox')}"></svg>`);
  shadow.setAttribute('class', 'pt-shadow');
  shadow.setAttribute('aria-hidden', 'true');
  shadow.setAttribute('focusable', 'false');
  for (const c of children(root).filter(isShadow)) {
    shadow.appendChild(shadow.ownerDocument.importNode(c, true));
    c.remove();
  }

  addClass(root, 'pt-breath');
  return `<div class="pt-stage">${serialize(shadow)}<div class="pt-react">${serialize(root)}</div></div>`;
}

function isShadow(e: Element): boolean {
  return e.tagName === 'ellipse' && e.getAttribute('fill') === '#000';
}

/** 体の白(wool のグラデーション3色・編み目の線・しっぽの白い線)を、体の色に差し替えられるようにCSS変数 */
function markBody(root: Element, prefix: string) {
  root.querySelectorAll(`[id="${prefix}wool"] stop`).forEach((s, i) => colorVar(s, 'stop-color', `--body-${i}`));
  for (const p of root.querySelectorAll(`[id="${prefix}stitch"] path`)) colorVar(p, 'stroke', '--body-stitch');
  for (const p of root.querySelectorAll('path[stroke="#f3eef4"]')) colorVar(p, 'stroke', '--body-tail');
}

/** 編み地:高さを変えられるように目印、色を作品の色に差し替えられるようにCSS変数 */
function markKnit(root: Element, prefix: string) {
  const knitUrl = `url(#${prefix}knit)`;
  for (const r of root.querySelectorAll('rect')) {
    if (r.getAttribute('fill') === knitUrl) {
      addClass(r, 'pt-knit');
      colorVar(r, 'stroke', '--knit-line');
    }
  }
  const pattern = root.querySelector(`[id="${prefix}knit"]`);
  if (pattern) {
    for (const r of pattern.querySelectorAll('rect')) colorVar(r, 'fill', '--knit-color');
    for (const p of pattern.querySelectorAll('path')) colorVar(p, 'stroke', '--knit-shade');
  }
}

/** 左右の手(編み針ごと)。5匹はもとから左右に分かれている。ひつじだけ、ほかの5匹と同じ並びにまとめ直す */
function markHands(root: Element) {
  const find = (side: 'l' | 'r') => {
    const c = HAND_CENTERS[side];
    return Array.from(root.querySelectorAll('g')).find(
      (g) => g.getAttribute('transform') === `rotate(0 ${c.x} ${c.y})`,
    );
  };
  const found: [Element | undefined, Element | undefined] = [find('l'), find('r')];
  const [left, right] = found[0] && found[1] ? (found as [Element, Element]) : regroupHands(root);
  addClass(left, 'pt-hand-l');
  addClass(right, 'pt-hand-r');
}

function regroupHands(root: Element): [Element, Element] {
  const lines = Array.from(root.querySelectorAll('line'));
  const pick = (sel: (e: Element) => boolean, list: Element[]) => list.filter(sel);
  const all = Array.from(root.querySelectorAll('circle, ellipse'));
  const at = (e: Element, x: number, y: number) =>
    Number(e.getAttribute('cx')) === x && Number(e.getAttribute('cy')) === y;

  const leftParts = [
    ...pick((l) => l.getAttribute('x1') === '80', lines),
    ...pick((e) => at(e, 79, 169), all),
    ...pick((e) => at(e, 102, 150), all),
  ];
  const rightParts = [
    ...pick((l) => l.getAttribute('x1') === '160', lines),
    ...pick((e) => at(e, 161, 169), all),
    ...pick((e) => at(e, 138, 150), all),
  ];
  if (leftParts.length !== 4 || rightParts.length !== 4) {
    throw new Error('編み針と手が見つかりません');
  }

  // 線の丸い端は、まとめていた g から受け継いでいた。抜き出しても同じ見た目になるよう線に移す
  const needleGroup = leftParts[0].parentElement!;
  const cap = needleGroup.getAttribute('stroke-linecap');
  for (const l of [...leftParts, ...rightParts]) {
    if (l.tagName === 'line' && cap && !l.hasAttribute('stroke-linecap')) l.setAttribute('stroke-linecap', cap);
  }

  const gl = el(root, 'g');
  const gr = el(root, 'g');
  needleGroup.parentNode!.insertBefore(gl, needleGroup);
  needleGroup.parentNode!.insertBefore(gr, needleGroup);
  for (const p of leftParts) gl.appendChild(p);
  for (const p of rightParts) gr.appendChild(p);
  if (needleGroup.children.length === 0) needleGroup.remove();
  return [gl, gr];
}

/** 棒針の先の赤い玉 */
const NEEDLE_BALL = '#e45864';

/**
 * かぎ針を持たせる。左右の手から棒針(線2本と赤い玉)を外し、右の手には、棒針のあった場所(手の絵より下の層)に
 * crochet-right の中身を入れる(手がかぎ針を握って見える)。左の手は手だけ
 */
function holdHook(root: Element, hook: string, prefix: string) {
  const tool = parseSvg(prefixIds(hook, `${prefix}h-`)).querySelector(`[id="${prefix}h-crochet-right"]`);
  if (!tool) throw new Error('かぎ針の絵が見つかりません');
  for (const side of ['l', 'r'] as const) {
    const hand = root.querySelector(`.pt-hand-${side}`)!;
    const needles = children(hand).filter(
      (c) => c.tagName === 'line' || (c.tagName === 'circle' && c.getAttribute('fill') === NEEDLE_BALL),
    );
    if (needles.length !== 3) throw new Error('棒針が見つかりません');
    if (side === 'r') {
      for (const c of children(tool)) hand.insertBefore(root.ownerDocument.importNode(c, true), needles[0]);
    }
    for (const n of needles) n.remove();
  }
}
