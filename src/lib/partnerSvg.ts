// どうぶつ+頭飾りのSVGを、動かせる形に下ごしらえする。
// assets/ のファイルは変えない。読み込んだあとメモリの中で、目印付けと並びのまとめ直しだけをする。
//
// できあがりの重なり(下から):
//   影 / [ふれあい [呼吸 [体・身につけた作品・編み地・左右の手(.pt-hand-l / .pt-hand-r、手袋もこの中)・頭飾り(.pt-deco)]]]
import { addClass, children, colorVar, el, parseSvg, prefixIds, serialize, wrap } from './svgPrep';
import { addWear, type WearInput } from './wearSvg';

const EYE_FILLS = ['#1a1620', '#fdfbff'];
/** 左右の手の回転の中心(assets/README.md) */
export const HAND_CENTERS = { l: { x: 102, y: 150 }, r: { x: 138, y: 150 } };

/** 編み地の高さ(README:試作では4〜44)。p は 0〜1 */
export const KNIT_MIN = 4;
export const KNIT_MAX = 44;
export function knitHeight(p: number): number {
  const c = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
  return Math.round((KNIT_MIN + (KNIT_MAX - KNIT_MIN) * c) * 10) / 10;
}

export interface PartnerSvgInput {
  animal: string;
  decoration: string;
  anchor: { x: number; y: number };
  scale: number;
  prefix: string;
  /** 身につけた作品(なければ空) */
  wear?: WearInput[];
}

export function preparePartner(i: PartnerSvgInput): string {
  const root = parseSvg(prefixIds(i.animal, i.prefix));
  root.removeAttribute('width');
  root.removeAttribute('height');
  root.setAttribute('class', 'pt-svg');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');

  markKnit(root, i.prefix);
  markHands(root);
  markBody(root, i.prefix);
  for (const c of root.querySelectorAll('circle')) {
    if (EYE_FILLS.includes(c.getAttribute('fill') ?? '')) {
      addClass(c, 'pt-eye');
      colorVar(c, 'fill', '--eye');
    }
  }
  if (i.wear?.length) addWear(root, i.wear, i.prefix);

  // 影と defs 以外を「呼吸」と「ふれあい」の入れ物に入れる
  const moving = children(root).filter((c) => c.tagName !== 'defs' && !isShadow(c));
  const breath = wrap(moving, 'pt-breath');
  wrap([breath], 'pt-react');

  // 頭飾り(anchors.json の位置に translate、大きさは scale。(0,0) が頭に触れる点)
  const deco = parseSvg(prefixIds(i.decoration, `${i.prefix}d-`));
  const place = el(root, 'g', {
    transform: `translate(${i.anchor.x} ${i.anchor.y}) scale(${i.scale})`,
  });
  const sway = el(root, 'g', { class: 'pt-deco' });
  for (const c of children(deco)) sway.appendChild(root.ownerDocument.importNode(c, true));
  place.appendChild(sway);
  breath.appendChild(place);

  return serialize(root);
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
