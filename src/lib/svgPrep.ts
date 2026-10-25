// SVG素材を画面に直接入れるための共通の下ごしらえ。
// 形・色・位置は変えず、名前(id)の付け替えと、動かすための目印(class)付けだけをする。

export const SVG_NS = 'http://www.w3.org/2000/svg';

let nextPrefix = 0;
/** 画面に出すたびに違う、id の頭に付ける文字 */
export function uniquePrefix(base: string): string {
  return `${base}${nextPrefix++}-`;
}

/** id と、それを指す url(#…)・href="#…" の頭に prefix を付ける(同じ画面に何枚あってもぶつからないように) */
export function prefixIds(svg: string, prefix: string): string {
  return svg
    .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`);
}

export function parseSvg(svg: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return doc.documentElement as unknown as SVGSVGElement;
}

export function serialize(el: Element): string {
  return new XMLSerializer().serializeToString(el);
}

export function el(owner: Element, tag: string, attrs: Record<string, string> = {}): SVGElement {
  const e = owner.ownerDocument.createElementNS(SVG_NS, tag) as SVGElement;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** 画像(新しい絵のPNG)を、絵の座標の四角に置く */
export function image(owner: Element, p: { href: string; x: number; y: number; width: number; height: number }): SVGElement {
  return el(owner, 'image', {
    href: p.href,
    x: String(p.x),
    y: String(p.y),
    width: String(p.width),
    height: String(p.height),
    preserveAspectRatio: 'none',
  });
}

/** 中身はそのままで、子要素をまとめて新しい g で包む(元の要素の transform を消さずに、CSSで動かせるように) */
export function wrapChildren(parent: Element, cls: string): SVGElement {
  const g = el(parent, 'g', { class: cls });
  while (parent.firstChild) g.appendChild(parent.firstChild);
  parent.appendChild(g);
  return g;
}

/** 要素そのものを新しい g で包む(並びの位置は変えない) */
export function wrap(nodes: Element[], cls: string): SVGElement {
  const first = nodes[0];
  const g = el(first, 'g', { class: cls });
  first.parentNode!.insertBefore(g, first);
  for (const n of nodes) g.appendChild(n);
  return g;
}

export function addClass(e: Element, cls: string) {
  const now = e.getAttribute('class');
  e.setAttribute('class', now ? `${now} ${cls}` : cls);
}

/** 色の属性はそのまま残し、CSS変数があればそちらを使うようにする(変数がなければ元の色) */
export function colorVar(e: Element, prop: 'fill' | 'stroke' | 'stop-color', name: string) {
  const attr = prop === 'stop-color' ? e.getAttribute('stop-color') : e.getAttribute(prop);
  const prev = e.getAttribute('style');
  const rule = `${prop}: var(${name}, ${attr})`;
  e.setAttribute('style', prev ? `${prev}; ${rule}` : rule);
}

export function children(e: Element): Element[] {
  return Array.from(e.children);
}
