// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import anchors from '../../assets/animals/anchors.json';
import { knitHeight, preparePartner } from './partnerSvg';
import { parseSvg } from './svgPrep';

const read = (p: string) => readFileSync(`assets/${p}`, 'utf8');
const ANIMALS = ['sheep', 'cat', 'stoat', 'axolotl', 'seal', 'otter'] as const;

function prepare(animal: (typeof ANIMALS)[number], prefix = 'x0-') {
  const deco = anchors.defaultDecoration[animal];
  return preparePartner({
    animal: read(`animals/${animal}.svg`),
    decoration: read(`decorations/${deco}.svg`),
    anchor: anchors.anchors[animal],
    scale: anchors.decorationScale,
    prefix,
  });
}

/** 形を表す要素を、目印(class・style)と id の頭の文字を除いて並べたもの */
function shapes(svg: string, prefix = ''): string[] {
  const root = parseSvg(svg);
  return Array.from(root.querySelectorAll('circle, ellipse, rect, path, line, polygon, polyline, stop'))
    .filter((e) => !e.closest('.sc-stars, .sc-dim'))
    .map((e) => {
      const attrs = Array.from(e.attributes)
        .filter((a) => a.name !== 'class' && a.name !== 'style')
        // ひつじの線の丸い端は、まとめていた g から線に移すので比べない
        .filter((a) => !(e.tagName === 'line' && a.name === 'stroke-linecap'))
        .map((a) => `${a.name}=${prefix ? a.value.replaceAll(prefix, '') : a.value}`)
        .sort();
      return `${e.tagName} ${attrs.join(' ')}`;
    })
    .sort();
}

describe('どうぶつの下ごしらえ', () => {
  for (const animal of ANIMALS) {
    it(`${animal}:編み地・左右の手・目・頭飾りが見つかり、形は変わらない`, () => {
      const out = prepare(animal);
      const root = parseSvg(out);
      expect(root.querySelectorAll('.pt-knit')).toHaveLength(1);
      for (const side of ['l', 'r']) {
        const hand = root.querySelectorAll(`.pt-hand-${side}`);
        expect(hand).toHaveLength(1);
        // 編み針2本(線2本)・玉1つ・手1つ
        expect(hand[0].querySelectorAll('line')).toHaveLength(2);
        expect(hand[0].querySelectorAll('circle, ellipse')).toHaveLength(2);
      }
      expect(root.querySelectorAll('.pt-eye')).toHaveLength(2);
      expect(root.querySelectorAll('.pt-deco')).toHaveLength(1);

      // どうぶつの部分は、元の素材と同じ形が同じ数だけある
      const animalOnly = parseSvg(out);
      animalOnly.querySelector('.pt-deco')!.parentElement!.remove();
      expect(shapes(animalOnly.outerHTML, 'x0-')).toEqual(shapes(read(`animals/${animal}.svg`)));
    });
  }

  it('ひつじの手は、左の手→右の手の順にまとまる(ほかの5匹と同じ)', () => {
    const root = parseSvg(prepare('sheep'));
    const l = root.querySelector('.pt-hand-l')!;
    const r = root.querySelector('.pt-hand-r')!;
    expect(l.nextElementSibling).toBe(r);
    expect(Array.from(l.children).map((c) => c.tagName)).toEqual(['line', 'line', 'circle', 'ellipse']);
    for (const line of root.querySelectorAll('line')) expect(line.getAttribute('stroke-linecap')).toBe('round');
  });

  it('同じ画面に何匹いても id がぶつからない', () => {
    const a = parseSvg(prepare('cat', 'a1-'));
    const b = parseSvg(prepare('cat', 'b2-'));
    const ids = [...a.querySelectorAll('[id]'), ...b.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // url(#…) はすべて、同じ絵の中の id を指している
    const urls = a.outerHTML.match(/url\(#([^)]+)\)/g)!.map((u) => u.slice(5, -1));
    const own = new Set(Array.from(a.querySelectorAll('[id]')).map((e) => e.id));
    for (const u of urls) expect(own.has(u)).toBe(true);
  });

  it('編み地の色は CSS 変数で差し替えられる(変数がなければ元の色)', () => {
    const out = prepare('seal');
    expect(out).toContain('fill: var(--knit-color, #5aa3df)');
    expect(out).toContain('stroke: var(--knit-shade, #3f86c4)');
    expect(out).toContain('stroke: var(--knit-line, #2f6aa3)');
  });
});

describe('編み地の高さ', () => {
  it('0〜1 を 4〜44 に', () => {
    expect(knitHeight(0)).toBe(4);
    expect(knitHeight(0.5)).toBe(24);
    expect(knitHeight(1)).toBe(44);
  });
  it('範囲の外は端にそろえる', () => {
    expect(knitHeight(-1)).toBe(4);
    expect(knitHeight(3)).toBe(44);
    expect(knitHeight(NaN)).toBe(4);
  });
});
