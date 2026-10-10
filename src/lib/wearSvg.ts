// 身につける作品・部屋に飾る作品のSVGを重ねる(assets/wear/README.md のとおり)。
// assets/ のファイルは変えない。読み込んだあとメモリの中で、id の付け替えと、色の入れ物で包むことだけをする。
//
// 大事なこと:
//  - 模様の <defs> は、各まとまり(wear-body など)の中に置いたまま動かさない。
//    模様の中の CSS 変数(--item)は、模様が置かれた場所の親から受け継ぐため。外に出すと色が付かない
//  - id は作品ごとに別の文字を頭に付ける(同じ画面に同じ種類が2つあってもぶつからない)
import { WEAR_STACK, type WearDept } from '../data/wear';
import { addClass, el, parseSvg, prefixIds, serialize } from './svgPrep';

export interface WearInput {
  dept: WearDept;
  /** 素材のSVG(文字) */
  svg: string;
  /** 作品の色と、約15%暗くした色 */
  color: string;
  shade: string;
}

/** 作品の色を受け継がせる入れ物 */
function colorBox(owner: Element, color: string, shade: string, cls: string): SVGElement {
  return el(owner, 'g', { class: cls, style: `--item: ${color}; --item-shade: ${shade}` });
}

/** 素材から、名前のまとまり(中の defs ごと)を取り出す */
function group(svg: string, prefix: string, name: string): Element | null {
  return parseSvg(prefixIds(svg, prefix)).querySelector(`[id="${prefix}${name}"]`);
}

/**
 * どうぶつの絵に、身につけた作品を重ねる。
 *  - wear-body:体の上、編み地(.pt-knit)のすぐ前。重ね順はセーター → くつした → マフラー → 帽子
 *  - 手袋:左右の手(.pt-hand-l / .pt-hand-r)の中、手の絵のあと。左右を必ず同時に入れる(右手は左手の模様を使う)
 */
export function addWear(root: Element, items: WearInput[], prefix: string) {
  const knit = root.querySelector('.pt-knit');
  const sorted = [...items].sort((a, b) => WEAR_STACK.indexOf(a.dept) - WEAR_STACK.indexOf(b.dept));
  for (const item of sorted) {
    const p = `${prefix}w-${item.dept}-`;
    const doc = root.ownerDocument;
    if (item.dept === 'paw') {
      const left = group(item.svg, p, 'wear-hand-left');
      const right = group(item.svg, p, 'wear-hand-right');
      const hl = root.querySelector('.pt-hand-l');
      const hr = root.querySelector('.pt-hand-r');
      if (!left || !right || !hl || !hr) throw new Error('手袋の絵か手が見つかりません');
      for (const [g, hand] of [
        [left, hl],
        [right, hr],
      ] as const) {
        const box = colorBox(root, item.color, item.shade, 'pt-wear');
        box.appendChild(doc.importNode(g, true));
        hand.appendChild(box);
      }
    } else {
      const g = group(item.svg, p, 'wear-body');
      if (!g || !knit) throw new Error('身につける絵か編み地が見つかりません');
      const box = colorBox(root, item.color, item.shade, 'pt-wear');
      box.appendChild(doc.importNode(g, true));
      knit.parentNode!.insertBefore(box, knit);
    }
  }
}

/**
 * 部屋に飾る作品を1つ、部屋の絵(root)の中の置き場所に置く要素を作る。
 * (0,0) が床に触れる下の真ん中なので、置き場所の (x, y) に translate して scale をかける
 */
export function interiorItem(
  root: Element,
  svg: string,
  spot: { x: number; y: number; scale: number },
  color: string,
  shade: string,
  prefix: string,
): Element {
  const g = group(svg, prefix, 'wear-room');
  if (!g) throw new Error('部屋に飾る絵が見つかりません');
  const place = el(root, 'g', { transform: `translate(${spot.x} ${spot.y}) scale(${spot.scale})` });
  addClass(place, 'sc-item');
  const box = colorBox(root, color, shade, 'sc-item-color');
  box.appendChild(root.ownerDocument.importNode(g, true));
  place.appendChild(box);
  return place;
}

/** 部屋に飾る作品を1つだけ、小さな絵として出すためのSVG(作品の色で) */
export function interiorPreview(svg: string, viewBox: string, color: string, shade: string, prefix: string): string {
  const root = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"></svg>`);
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  root.appendChild(interiorItem(root, svg, { x: 0, y: 0, scale: 1 }, color, shade, prefix));
  return serialize(root);
}
