import { describe, expect, it } from 'vitest';
import {
  addPart,
  amountText,
  currentPart,
  duplicateGroup,
  duplicatePart,
  editPart,
  groupParts,
  hasParts,
  mirrorName,
  newPart,
  nextPartId,
  overallProgress,
  partLabel,
  removePart,
  totalKnitMs,
  type Part,
} from './parts';

const part = (id: string, fields: Partial<Part> = {}) => newPart({ id, ...fields });

/** 右手:親指(20段)・手のひら(40段)/左手:親指 */
function glove() {
  const parts = [
    part('r1', { group: '右手', name: '親指', goalRows: 20, count: { row: 20, stitch: 0 }, knitMs: 100 }),
    part('r2', { group: '右手', name: '手のひら', goalRows: 40, count: { row: 10, stitch: 0 }, knitMs: 50 }),
    part('l1', { group: '左手', name: '親指', goalRows: 20 }),
  ];
  return { parts, currentPartId: 'r1' };
}

describe('今のパーツと次のパーツ', () => {
  it('今のパーツ。見つからなければ1つ目', () => {
    const w = glove();
    expect(currentPart(w).id).toBe('r1');
    expect(currentPart({ ...w, currentPartId: 'none' }).id).toBe('r1');
  });

  it('次のパーツ。最後のパーツなら null', () => {
    const w = glove();
    expect(nextPartId(w)).toBe('r2');
    expect(nextPartId({ ...w, currentPartId: 'l1' })).toBeNull();
  });

  it('パーツ1つの作品は、パーツの表示を出さない', () => {
    expect(hasParts({ parts: [part('a')] })).toBe(false);
    expect(hasParts(glove())).toBe(true);
  });

  it('名前:「右手・親指」、まとまりなしは名前だけ', () => {
    expect(partLabel({ group: '右手', name: '親指' })).toBe('右手・親指');
    expect(partLabel({ group: '', name: '身ごろ' })).toBe('身ごろ');
  });

  it('作品カードの数:パーツがあれば今のパーツ、なければ今まで通り', () => {
    expect(amountText(glove())).toBe('親指 20/20段');
    expect(amountText({ parts: [part('a', { goalRows: 80, count: { row: 42, stitch: 3 } })], currentPartId: 'a' })).toBe('42/80段');
    expect(amountText({ parts: [part('a', { count: { row: 7, stitch: 0 } })], currentPartId: 'a' })).toBe('7段');
  });
});

describe('作品全体の進み具合', () => {
  it('目標の段数で重みを付けた平均', () => {
    // 親指 20/20、手のひら 10/40、左手の親指 0/20 → (20 + 10 + 0) / 80
    expect(overallProgress(glove())).toBeCloseTo(30 / 80);
  });

  it('パーツ1つなら、今までと同じ(目標あり:達成率、目標なし:だいたい○%)', () => {
    const goal = part('a', { goalRows: 80, stitchesPerRow: 10, count: { row: 40, stitch: 5 } });
    expect(overallProgress({ parts: [goal] })).toBeCloseTo(40.5 / 80);
    expect(overallProgress({ parts: [part('a', { manualProgress: 40 })] })).toBeCloseTo(0.4);
  });

  it('目標なしのパーツは、目標ありのパーツの平均の段数ぶんとして数える', () => {
    const w = {
      parts: [
        part('a', { goalRows: 10, count: { row: 10, stitch: 0 } }),
        part('b', { goalRows: 30 }),
        part('c', { manualProgress: 50 }),
      ],
    };
    // 平均20段。(10*1 + 30*0 + 20*0.5) / (10 + 30 + 20)
    expect(overallProgress(w)).toBeCloseTo(20 / 60);
  });

  it('全部目標なしなら、そのまま平均', () => {
    expect(overallProgress({ parts: [part('a', { manualProgress: 100 }), part('b', { manualProgress: 0 })] })).toBeCloseTo(0.5);
  });

  it('目標を超えたパーツは100%として数える。全部届けば100%', () => {
    const w = {
      parts: [
        part('a', { goalRows: 10, count: { row: 15, stitch: 0 } }),
        part('b', { goalRows: 10, count: { row: 10, stitch: 0 } }),
      ],
    };
    expect(overallProgress(w)).toBe(1);
  });

  it('編んだ時間は全パーツの合計', () => {
    expect(totalKnitMs(glove())).toBe(150);
  });
});

describe('パーツを足す・複製・並び替え・消す', () => {
  it('名前の右と左を入れ替える。どちらもなければ「○○ 2」', () => {
    expect(mirrorName('右手')).toBe('左手');
    expect(mirrorName('左足')).toBe('右足');
    expect(mirrorName('そで')).toBe('そで 2');
  });

  it('まとまりごと複製:すぐ後ろに入り、目標と模様の設定は同じ、数・履歴・模様の回数・編んだ時間は0から', () => {
    const parts = [
      part('r1', {
        group: '右手',
        name: '親指',
        goalRows: 20,
        stitchesPerRow: 12,
        count: { row: 20, stitch: 0 },
        history: [{ row: 19, stitch: 11 }],
        pattern: { name: '模様', count: 3, everyRows: 4, baseRow: 2 },
        knitMs: 100,
      }),
      part('r2', { group: '右手', name: '人差し指', goalRows: 24 }),
      part('x', { group: '', name: 'ひも' }),
    ];
    const next = duplicateGroup(parts, '右手', '左手');
    expect(next.map((p) => `${p.group}/${p.name}`)).toEqual(['右手/親指', '右手/人差し指', '左手/親指', '左手/人差し指', '/ひも']);
    const copy = next[2];
    expect(copy.id).not.toBe('r1');
    expect(copy).toMatchObject({
      goalRows: 20,
      stitchesPerRow: 12,
      count: { row: 0, stitch: 0 },
      history: [],
      pattern: { name: '模様', count: 0, everyRows: 4, baseRow: 0 },
      knitMs: 0,
    });
    // 元のパーツは変わらない
    expect(next[0]).toBe(parts[0]);
  });

  it('パーツ1つを複製:すぐ後ろに入る', () => {
    const next = duplicatePart(glove().parts, 'r1', '人差し指');
    expect(next.map((p) => p.name)).toEqual(['親指', '人差し指', '手のひら', '親指']);
    expect(next[1].group).toBe('右手');
  });

  it('足すパーツは、そのまとまりの最後。新しいまとまりなら一番最後', () => {
    const w = glove();
    expect(addPart(w.parts, part('n', { group: '右手', name: '小指' })).map((p) => p.id)).toEqual(['r1', 'r2', 'n', 'l1']);
    expect(addPart(w.parts, part('n', { group: 'ひも', name: 'ひも' })).map((p) => p.id)).toEqual(['r1', 'r2', 'l1', 'n']);
  });

  it('まとまりを変えたら、新しいまとまりの最後へ移る。数はそのまま', () => {
    const next = editPart(glove().parts, 'r1', { group: '左手' });
    expect(next.map((p) => p.id)).toEqual(['r2', 'l1', 'r1']);
    expect(next[2].count).toEqual({ row: 20, stitch: 0 });
  });

  it('まとまりごとに分けると、同じまとまりのパーツは続けて並ぶ', () => {
    const groups = groupParts([part('a', { group: 'A' }), part('b', { group: 'B' }), part('c', { group: 'A' })]);
    expect(groups.map((g) => [g.group, g.parts.map((p) => p.id)])).toEqual([
      ['A', ['a', 'c']],
      ['B', ['b']],
    ]);
  });

  it('消す:今のパーツを消したら前のパーツ(1つ目なら次)にする。最後の1つは消せない', () => {
    const w = glove();
    expect(removePart({ ...w, currentPartId: 'r2' }, 'r2')).toMatchObject({ currentPartId: 'r1' });
    expect(removePart(w, 'r1')).toMatchObject({ currentPartId: 'r2' });
    expect(removePart(w, 'l1').currentPartId).toBe('r1');
    const one = { parts: [part('a')], currentPartId: 'a' };
    expect(removePart(one, 'a')).toBe(one);
  });
});
