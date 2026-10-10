// 原っぱ(編む画面)とホームの部屋のSVGを、時間帯で色を変えたり雲・花を動かせる形に下ごしらえする。
// assets/ のファイルは変えない。目印付けと、夜の星・暗くするための薄い幕を足すだけ。
import { DIM_COLOR, STAR_COLOR } from '../config/sky';
import { addClass, children, colorVar, el, parseSvg, prefixIds, serialize, wrap, wrapChildren } from './svgPrep';

export type SceneKind = 'meadow' | 'room';

/** 夜の星の位置と大きさ(雲や窓の桟に重ならない場所) */
const STARS: Record<SceneKind, [number, number, number][]> = {
  meadow: [
    [18, 16, 1.6],
    [104, 20, 1.3],
    [62, 76, 1.2],
    [132, 58, 1.7],
    [196, 14, 1.3],
    [214, 46, 1.6],
    [244, 22, 1.2],
    [90, 104, 1.1],
    [178, 92, 1.4],
  ],
  room: [
    [98, 34, 1.4],
    [146, 36, 1.2],
    [198, 32, 1.5],
    [228, 40, 1.1],
    [254, 62, 1.3],
    [100, 72, 1.2],
    [158, 54, 1.1],
  ],
};

export function prepareScene(raw: string, kind: SceneKind, prefix: string): string {
  const root = parseSvg(prefixIds(raw, prefix));
  root.removeAttribute('width');
  root.removeAttribute('height');
  root.setAttribute('class', 'sc-svg');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  if (kind === 'meadow') root.setAttribute('preserveAspectRatio', 'xMidYMax slice');

  // 空のグラデーション
  root.querySelectorAll(`[id="${prefix}sky"] stop`).forEach((s, i) => colorVar(s, 'stop-color', `--sky-${i}`));

  // 雲
  const cloudParent = kind === 'meadow' ? root : root.querySelector('g[clip-path]');
  let n = 0;
  if (cloudParent) {
    const list = children(cloudParent);
    list.forEach((c, i) => {
      if (c.tagName !== 'g' || c.getAttribute('fill') !== '#ffffff') return;
      colorVar(c, 'fill', '--cloud');
      const parts = [c];
      const next = list[i + 1];
      if (next?.tagName === 'ellipse' && next.getAttribute('fill') === '#e2f0fb') {
        colorVar(next, 'fill', '--cloud-shade');
        parts.push(next);
      }
      const g = wrap(parts, 'sc-cloud');
      g.setAttribute('style', `--i: ${n++}`);
    });
  }

  // 揺れる花
  let f = 0;
  const sway = (g: Element) => wrapChildren(g, 'sc-sway').setAttribute('style', `--i: ${f++}`);
  for (const g of children(root)) {
    if (g.tagName !== 'g' || g.hasAttribute('transform')) continue;
    for (const c of children(g)) {
      if (c.tagName === 'g' && c.getAttribute('transform')?.startsWith('translate(')) sway(c);
    }
  }
  if (kind === 'room') {
    // 窓辺の鉢植え:位置を決めている g の中の、最初の g が花(その下は鉢)
    for (const g of children(root)) {
      const first = g.firstElementChild;
      if (g.tagName === 'g' && g.getAttribute('transform')?.startsWith('translate(') && first?.tagName === 'g') {
        sway(first);
      }
    }
  }

  // 暗くする幕(昼は透明)と夜の星
  const [, , w, h] = (root.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/);
  const dim = el(root, 'rect', { x: '0', y: '0', width: w, height: h, fill: DIM_COLOR, class: 'sc-dim' });
  root.appendChild(dim);
  const stars = el(root, 'g', { class: 'sc-stars', fill: STAR_COLOR });
  if (kind === 'room') stars.setAttribute('clip-path', `url(#${prefix}win)`);
  STARS[kind].forEach(([x, y, r], i) => {
    const c = el(root, 'circle', { cx: String(x), cy: String(y), r: String(r) });
    c.setAttribute('style', `--i: ${i}`);
    stars.appendChild(c);
  });
  root.appendChild(stars);
  addClass(root, `sc-${kind}`);

  return serialize(root);
}
