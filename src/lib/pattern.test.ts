import { describe, expect, it } from 'vitest';
import { add, pushHistory, undo } from './counter';
import type { HistoryEntry } from './db';
import { advancePattern, newPattern } from './pattern';

describe('2つ目のカウンター', () => {
  const every3 = { ...newPattern(0), everyRows: 3 };

  it('○段ごとに1回進み、段が戻ると一緒に戻る', () => {
    let p = advancePattern(every3, 0, 2);
    expect(p.count).toBe(0);
    p = advancePattern(p, 2, 3);
    expect(p.count).toBe(1);
    p = advancePattern(p, 3, 9);
    expect(p.count).toBe(3);
    p = advancePattern(p, 9, 5);
    expect(p.count).toBe(1);
  });

  it('自動で進め始めた段から数える', () => {
    const p = { ...newPattern(13), everyRows: 4 };
    expect(advancePattern(p, 13, 16).count).toBe(0);
    expect(advancePattern(p, 13, 17).count).toBe(1);
  });

  it('手で数えるときは段で動かない。0より下にはならない', () => {
    expect(advancePattern(newPattern(0), 0, 10).count).toBe(0);
    expect(advancePattern({ ...every3, count: 0 }, 6, 0).count).toBe(0);
  });

  it('取り消しで模様の回数も戻せる(履歴に回数を一緒に残す)', () => {
    let h: HistoryEntry[] = [];
    h = pushHistory(h, { row: 2, stitch: 0, repeat: 0 });
    expect(undo(h)!.count).toEqual({ row: 2, stitch: 0, repeat: 0 });
    // 段の自動送りの計算は今までどおり
    expect(add({ row: 2, stitch: 9 }, 1, 10)).toEqual({ row: 3, stitch: 0 });
  });
});
