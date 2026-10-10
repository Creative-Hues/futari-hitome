// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import anchors from '../../assets/animals/anchors.json';
import wear from '../../assets/wear/wear.json';
import type { WearDept } from '../data/wear';
import { preparePartner } from './partnerSvg';
import { prepareScene } from './sceneSvg';
import { parseSvg } from './svgPrep';
import type { WearInput } from './wearSvg';

const read = (p: string) => readFileSync(`assets/${p}`, 'utf8');
type Animal = keyof typeof anchors.anchors;

const DEPT_OF: Record<string, WearDept> = { 頭: 'head', 首: 'neck', 胴体: 'body', 前足: 'paw', 'その他・身につけるもの': 'wear' };

function item(key: keyof typeof wear.worn, color = '#e8505c'): WearInput {
  const w = wear.worn[key];
  return { dept: DEPT_OF[w.department], svg: read(`wear/${w.file}`), color, shade: '#c04450' };
}

function dress(animal: Animal, items: WearInput[], prefix = 'x0-', anchorY?: number) {
  const a = anchors.anchors[animal];
  return parseSvg(
    preparePartner({
      animal: read(`animals/${animal}.svg`),
      decoration: read(`decorations/${anchors.defaultDecoration[animal]}.svg`),
      anchor: { x: a.x, y: anchorY ?? a.y },
      scale: anchors.decorationScale,
      prefix,
      wear: items,
    }),
  );
}

/** 文書の中で a が b より前にあるか */
const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & 4);

describe('身につける作品(10通り)', () => {
  for (const key of Object.keys(wear.worn) as (keyof typeof wear.worn)[]) {
    const entry = wear.worn[key];
    it(`${key}:決まった場所に入り、defs はまとまりの中、色の入れ物で包まれる`, () => {
      const root = dress(entry.animal as Animal, [item(key)]);
      const boxes = root.querySelectorAll('.pt-wear');
      const knit = root.querySelector('.pt-knit')!;
      if (entry.layers.includes('body')) {
        expect(boxes).toHaveLength(1);
        const g = boxes[0].querySelector(`[id="x0-w-${DEPT_OF[entry.department]}-wear-body"]`)!;
        expect(g).not.toBeNull();
        // 体の上、編み地のすぐ前
        expect(boxes[0].nextElementSibling).toBe(knit);
        expect(g.querySelector('defs')).not.toBeNull();
      } else {
        expect(boxes).toHaveLength(2);
        const left = root.querySelector('.pt-hand-l')!;
        const right = root.querySelector('.pt-hand-r')!;
        // 手の絵のあと(手のまとまりの最後)に入る
        expect(left.lastElementChild!.classList.contains('pt-wear')).toBe(true);
        expect(right.lastElementChild!.classList.contains('pt-wear')).toBe(true);
        expect(left.querySelector('[id$="wear-hand-left"] defs')).not.toBeNull();
        // 右手が使う模様は、左手の中にある
        const url = right.querySelector('.pt-wear [fill^="url(#"]')!.getAttribute('fill')!;
        const id = url.slice(5, -1);
        expect(left.querySelector(`[id="${id}"]`)).not.toBeNull();
      }
      for (const b of boxes) {
        expect(b.getAttribute('style')).toContain('--item: #e8505c');
        expect(b.getAttribute('style')).toContain('--item-shade: #c04450');
      }
    });
  }

  it('2つ同時:ねこはマフラーと手袋を同時に身につける', () => {
    const root = dress('cat', [item('paws_cat', '#f6c94a'), item('neck_cat', '#a99ad6')]);
    expect(root.querySelectorAll('.pt-wear')).toHaveLength(3);
    const styles = Array.from(root.querySelectorAll('.pt-wear')).map((b) => b.getAttribute('style'));
    expect(styles.filter((s) => s!.includes('#f6c94a'))).toHaveLength(2);
    expect(styles.filter((s) => s!.includes('#a99ad6'))).toHaveLength(1);
  });

  it('重ね順:アザラシはセーターの上に帽子', () => {
    const root = dress('seal', [item('head_seal'), item('body_seal')]);
    const [first, second] = Array.from(root.querySelectorAll('.pt-wear'));
    expect(first.querySelector('[id$="wear-body"]')!.id).toContain('w-body-');
    expect(second.querySelector('[id$="wear-body"]')!.id).toContain('w-head-');
    expect(before(first, second)).toBe(true);
  });

  it('2匹並べても id がぶつからない', () => {
    const a = dress('seal', [item('body_seal')], 'p1-');
    const b = dress('seal', [item('body_seal')], 'p2-');
    const ids = (r: Element) => Array.from(r.querySelectorAll('[id]')).map((e) => e.id);
    const shared = ids(a).filter((id) => ids(b).includes(id));
    expect(shared).toEqual([]);
    // mask・clipPath を指す先も付け替わっている
    expect(a.querySelector('[mask]')!.getAttribute('mask')).toBe('url(#p1-w-body-wm-body_seal)');
  });

  it('帽子のとき頭飾りの y を変えられる(ひつじは絵の上の端より上にはみ出す)', () => {
    const y = wear.worn.head_sheep.decorationAnchorY;
    const root = dress('sheep', [item('head_sheep')], 'x0-', y);
    const place = root.querySelector('.pt-deco')!.parentElement!;
    expect(place.getAttribute('transform')).toBe(`translate(120 ${y}) scale(${anchors.decorationScale})`);
    expect(y + -40 * anchors.decorationScale).toBeLessThan(0);
  });

  it('体の色・目の色を変数で差し替えられる', () => {
    const root = dress('cat', []);
    expect(root.querySelectorAll('[style*="--body-"]').length).toBeGreaterThanOrEqual(5);
    expect(root.querySelectorAll('.pt-eye[style*="--eye"]')).toHaveLength(2);
  });
});

describe('部屋(room_template.svg)', () => {
  const raw = readFileSync('assets/backgrounds/room_template.svg', 'utf8');
  const cushion = read('wear/interior_cushion.svg');
  const spots = wear.interior.roomSpots;
  const room = (n: number) =>
    parseSvg(
      prepareScene(raw, 'room', 'r0-', {
        flower: read('decorations/tulip.svg'),
        items: spots.slice(0, n).map((spot) => ({ svg: cushion, spot, color: '#8fc79a', shade: '#7aa983' })),
      }),
    );

  it('見本の色の style を外し、色は変数のまま', () => {
    const root = room(0);
    expect(root.getAttribute('style')).toBeNull();
    expect(root.querySelector('[fill="var(--wall)"]')).not.toBeNull();
  });

  it('鉢植えの花が頭飾りの花に替わり、揺れる目印が付く', () => {
    const root = room(0);
    const sway = root.querySelectorAll('.sc-sway');
    expect(sway).toHaveLength(1);
    // チューリップの茎
    expect(sway[0].querySelector('path[d="M0 2 Q0 -7.0 0.0 -14"]')).not.toBeNull();
    expect(root.querySelectorAll('.sc-cloud')).toHaveLength(2);
  });

  it('同じクッションを3つ置いても id がぶつからず、置き場所の位置と大きさ', () => {
    const root = room(3);
    const items = root.querySelectorAll('.sc-item');
    expect(items).toHaveLength(3);
    items.forEach((g, i) => {
      expect(g.getAttribute('transform')).toBe(`translate(${spots[i].x} ${spots[i].y}) scale(${spots[i].scale})`);
      expect(g.querySelector('defs')).not.toBeNull();
    });
    const ids = Array.from(root.querySelectorAll('[id]')).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('作品は夜に暗くする幕と星の下', () => {
    const root = room(1);
    const item = root.querySelector('.sc-item')!;
    expect(before(item, root.querySelector('.sc-dim')!)).toBe(true);
    expect(before(item, root.querySelector('.sc-stars')!)).toBe(true);
  });
});
