// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import anchors from '../../assets/animals/anchors.json';
import { eyeFill, knitHeight, preparePartner, preparePngPartner, type PartnerPng } from './partnerSvg';
import { parseSvg } from './svgPrep';

const read = (p: string) => readFileSync(`assets/${p}`, 'utf8');
const ANIMALS = ['sheep', 'cat', 'stoat', 'axolotl', 'seal', 'otter'] as const;

const HOOK = read('tools/crochet_hook.svg');

function prepare(animal: (typeof ANIMALS)[number], prefix = 'x0-', hook?: string) {
  const deco = anchors.defaultDecoration[animal];
  return preparePartner({
    animal: read(`animals/${animal}.svg`),
    decoration: read(`decorations/${deco}.svg`),
    anchor: anchors.anchors[animal],
    scale: anchors.decorationScale,
    prefix,
    hook,
  });
}

/** 下ごしらえした絵(HTML)を読む。いちばん外の .pt-stage を返す */
const parsePartner = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.firstElementChild!;

/** 形を表す要素を、目印(class・style)と id の頭の文字を除いて並べたもの */
function shapes(svg: string | Element, prefix = ''): string[] {
  const root = typeof svg === 'string' ? parseSvg(svg) : svg;
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
      const root = parsePartner(out);
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
      const animalOnly = parsePartner(out);
      animalOnly.querySelector('.pt-deco')!.parentElement!.remove();
      expect(shapes(animalOnly, 'x0-')).toEqual(shapes(read(`animals/${animal}.svg`)));
    });
  }

  it('ひつじの手は、左の手→右の手の順にまとまる(ほかの5匹と同じ)', () => {
    const root = parsePartner(prepare('sheep'));
    const l = root.querySelector('.pt-hand-l')!;
    const r = root.querySelector('.pt-hand-r')!;
    expect(l.nextElementSibling).toBe(r);
    expect(Array.from(l.children).map((c) => c.tagName)).toEqual(['line', 'line', 'circle', 'ellipse']);
    for (const line of root.querySelectorAll('line')) expect(line.getAttribute('stroke-linecap')).toBe('round');
  });

  for (const animal of ANIMALS) {
    it(`${animal}:影だけ動かない SVG、ほかはすべて体ごと動かす SVG(.pt-react > .pt-breath)の中。切り取りの型はいちばん上の defs`, () => {
      const stage = parsePartner(prepare(animal));
      expect(stage.getAttribute('class')).toBe('pt-stage');
      expect(Array.from(stage.children).map((c) => c.getAttribute('class'))).toEqual(['pt-shadow', 'pt-react']);
      const shadow = stage.querySelector('.pt-shadow')!;
      expect(Array.from(shadow.children).map((c) => `${c.tagName}:${c.getAttribute('fill')}`)).toEqual(['ellipse:#000']);
      const body = stage.querySelector('.pt-react > svg')!;
      expect(body.getAttribute('class')).toBe('pt-svg pt-breath');
      expect(body.getAttribute('viewBox')).toBe(shadow.getAttribute('viewBox'));
      // 動くまとまりは SVG の中に作らない(体ごとの動きは HTML の部品で)
      expect(body.querySelector('.pt-breath, .pt-react')).toBeNull();
      const defs = Array.from(body.children).find((c) => c.tagName === 'defs')!;
      for (const c of body.querySelectorAll('clipPath, mask')) expect(c.parentElement).toBe(defs);
      // 切り取る部品が指す型は、同じ SVG の中にある
      for (const e of body.querySelectorAll('[clip-path], [mask]')) {
        const ref = /url\(#([^)]+)\)/.exec(e.getAttribute('clip-path') ?? e.getAttribute('mask')!)![1];
        expect(defs.querySelector(`[id="${ref}"]`)).not.toBeNull();
      }
      expect(body.querySelectorAll('[clip-path]').length).toBeGreaterThan(0);
    });
  }

  it('ひつじの足は体の前。呼吸のまとまりの中で、手と影には入らない', () => {
    const root = parsePartner(prepare('sheep'));
    const legs = Array.from(root.querySelectorAll('ellipse')).filter((e) => e.getAttribute('cy') === '204');
    expect(legs).toHaveLength(2);
    for (const leg of legs) {
      expect(leg.closest('.pt-react')).not.toBeNull();
      expect(leg.closest('.pt-hand-l, .pt-hand-r')).toBeNull();
      expect(leg.getAttribute('fill')).toBe('#4a4350');
    }
  });

  it('同じ画面に何匹いても id がぶつからない', () => {
    const a = parsePartner(prepare('cat', 'a1-'));
    const b = parsePartner(prepare('cat', 'b2-'));
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

describe('かぎ針の作品', () => {
  for (const animal of ANIMALS) {
    it(`${animal}:右の手はかぎ針を手の絵の下に持ち、左の手は手だけ。棒針と赤い玉はない`, () => {
      const root = parsePartner(prepare(animal, 'x0-', HOOK));
      const l = root.querySelector('.pt-hand-l')!;
      const r = root.querySelector('.pt-hand-r')!;
      expect(Array.from(l.children).map((c) => c.tagName)).toEqual(['ellipse']);
      expect(Array.from(r.children).map((c) => `${c.tagName}${c.getAttribute('class') ? `.${c.getAttribute('class')}` : ''}`)).toEqual([
        'g.crochet-hook',
        'ellipse',
      ]);
      expect(root.querySelectorAll('line')).toHaveLength(2);
      expect(root.querySelectorAll('.crochet-hook line')).toHaveLength(2);
      expect(root.querySelector('circle[fill="#e45864"]')).toBeNull();
      // かぎ針の形は素材のまま
      expect(shapes(r.querySelector('.crochet-hook')!.outerHTML)).toEqual(
        shapes(parseSvg(HOOK).querySelector('.crochet-hook')!.outerHTML),
      );
    });
  }

  it('棒針の作品は今までどおり(かぎ針を入れない)', () => {
    expect(prepare('cat')).not.toContain('crochet-hook');
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

describe('編み地の高さ(新しい絵)', () => {
  it('art.json の いちばん短いとき〜長いとき に合わせる', () => {
    expect(knitHeight(0, 5, 45)).toBe(5);
    expect(knitHeight(0.5, 5, 45)).toBe(25);
    expect(knitHeight(1, 5, 45)).toBe(45);
  });
});

describe('新しい絵(PNG)の子', () => {
  const img = (name: string, x = 10, y = 20, w = 30, h = 40) => ({ href: `/art/${name}.png`, x, y, width: w, height: h });
  const PNG: PartnerPng = {
    body: img('body', 40, 30, 160, 186),
    eyes: img('eyes', 90, 95, 60, 12),
    hands: { l: img('hl'), r: img('hr') },
    centers: { l: { x: 101, y: 151 }, r: { x: 139, y: 151 } },
    knit: { x: 105, y: 147, width: 30 },
    decoration: img('deco', -10, -30, 20, 30),
  };
  const make = (animal: (typeof ANIMALS)[number], png: Partial<PartnerPng> = {}, wear = [], hook?: string) =>
    parsePartner(
      preparePngPartner({
        animal: read(`animals/${animal}.svg`),
        decoration: read(`decorations/${anchors.defaultDecoration[animal]}.svg`),
        anchor: { x: 120, y: 52 },
        scale: anchors.decorationScale,
        prefix: 'x0-',
        wear,
        hook,
        png: { ...PNG, ...png },
      }),
    );
  const hrefs = (e: Element) => Array.from(e.querySelectorAll('image')).map((i) => i.getAttribute('href'));

  for (const animal of ANIMALS) {
    it(`${animal}:重なりは 影 → 体 → 目 → 編み地 → 左右の手 → 頭飾り。動かすまとまりの目印は今と同じ`, () => {
      const root = make(animal);
      const breath = root.querySelector(':scope > .pt-react > svg.pt-breath')!;
      expect(breath).not.toBeNull();
      // 影は動かない別の SVG
      const shadow = root.querySelectorAll(':scope > svg.pt-shadow > ellipse');
      expect(shadow).toHaveLength(1);
      expect(shadow[0].getAttribute('fill')).toBe('#000');
      expect(Array.from(breath.children).map((c) => c.tagName + (c.getAttribute('class') ? `.${c.getAttribute('class')}` : ''))).toEqual([
        'defs',
        'image',
        'g.pt-eye',
        'rect.pt-knit',
        'g.pt-hand-l',
        'g.pt-hand-r',
        'g',
      ]);
      expect(hrefs(breath)).toEqual(['/art/body.png', '/art/eyes.png', '/art/hl.png', '/art/hr.png', '/art/deco.png']);
      const knit = root.querySelector('.pt-knit')!;
      expect([knit.getAttribute('x'), knit.getAttribute('y'), knit.getAttribute('width')]).toEqual(['105', '147', '30']);
      expect(knit.getAttribute('fill')).toBe('url(#x0-knit)');
      expect(root.querySelector('[id="x0-knit"]')).not.toBeNull();
      // 手の回転の中心は art.json の値
      expect(root.querySelector('.pt-hand-l')!.getAttribute('style')).toBe('transform-origin: 101px 151px');
      expect(root.querySelector('.pt-hand-r')!.getAttribute('style')).toBe('transform-origin: 139px 151px');
      // 頭飾りは位置の translate の中で揺れる
      const deco = root.querySelector('.pt-deco')!;
      expect(deco.parentElement!.getAttribute('transform')).toBe(`translate(120 52) scale(${anchors.decorationScale})`);
      expect(hrefs(deco)).toEqual(['/art/deco.png']);
    });
  }

  it('目・手・頭飾りのPNGがなければ、その部品だけ今のSVG(体の色・目の色の変数も付く)', () => {
    const root = make('sheep', { eyes: null, hands: null, decoration: null });
    expect(root.querySelectorAll('circle.pt-eye')).toHaveLength(2);
    expect(root.querySelector('.pt-eye')!.getAttribute('style')).toContain('var(--eye');
    expect(root.querySelector('.pt-hand-l')!.querySelectorAll('line')).toHaveLength(2);
    expect(root.querySelector('.pt-hand-r')!.querySelectorAll('line')).toHaveLength(2);
    expect(root.querySelector('.pt-deco path, .pt-deco ellipse, .pt-deco circle')).not.toBeNull();
    // SVGの手は体の色(wool)を使うので、その色の変数も持っている
    expect(root.querySelector('[id="x0-wool"] stop')!.getAttribute('style')).toContain('var(--body-0');
    expect(hrefs(root)).toEqual(['/art/body.png']);
  });

  it('手のPNGがない子のかぎ針の作品は、SVGのかぎ針の手。手のPNGがあればPNGの手のまま', () => {
    const svgHands = make('cat', { hands: null }, [], HOOK);
    expect(svgHands.querySelector('.pt-hand-r .crochet-hook')).not.toBeNull();
    expect(svgHands.querySelector('.pt-hand-l line')).toBeNull();
    const pngHands = make('cat', {}, [], HOOK);
    expect(pngHands.querySelector('.crochet-hook')).toBeNull();
    expect(hrefs(pngHands.querySelector('.pt-hand-r')!)).toEqual(['/art/hr.png']);
  });

  it('もとの目の色:ひつじは白、ほかは黒', () => {
    expect(eyeFill(read('animals/sheep.svg'))).toBe('#fdfbff');
    for (const a of ANIMALS.filter((a) => a !== 'sheep')) expect(eyeFill(read(`animals/${a}.svg`))).toBe('#1a1620');
  });
});
