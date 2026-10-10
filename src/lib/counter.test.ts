import { describe, expect, it } from 'vitest';
import { add, progress, pushHistory, undo, unravel, type Count } from './counter';

describe('add', () => {
  it('1段の目数が満ちると段が進む', () => {
    expect(add({ row: 0, stitch: 29 }, 1, 30)).toEqual({ row: 1, stitch: 0 });
  });
  it('+N で段をまたぐ', () => {
    expect(add({ row: 2, stitch: 25 }, 10, 30)).toEqual({ row: 3, stitch: 5 });
    expect(add({ row: 0, stitch: 0 }, 65, 30)).toEqual({ row: 2, stitch: 5 });
  });
  it('1段の目数がない作品は段を数える', () => {
    expect(add({ row: 4, stitch: 0 }, 1, null)).toEqual({ row: 5, stitch: 0 });
  });
  it('0より下には戻らない', () => {
    expect(add({ row: 0, stitch: 3 }, -10, 30)).toEqual({ row: 0, stitch: 0 });
    expect(add({ row: 1, stitch: 0 }, -5, null)).toEqual({ row: 0, stitch: 0 });
  });
});

describe('unravel', () => {
  it('目数でほどくと前の段に戻ることもある', () => {
    expect(unravel({ row: 3, stitch: 2 }, 'stitch', 5, 30)).toEqual({ row: 2, stitch: 27 });
  });
  it('段数でほどくと、今の段の目数はそのまま', () => {
    expect(unravel({ row: 3, stitch: 2 }, 'row', 2, 30)).toEqual({ row: 1, stitch: 2 });
  });
  it('1段の目数がない作品は段でほどく', () => {
    expect(unravel({ row: 3, stitch: 0 }, 'row', 2, null)).toEqual({ row: 1, stitch: 0 });
  });
  it('ほどきすぎても0で止まる', () => {
    expect(unravel({ row: 1, stitch: 2 }, 'row', 5, 30)).toEqual({ row: 0, stitch: 0 });
  });
});

describe('undo', () => {
  it('直前の操作を1つずつ戻す', () => {
    let h = pushHistory([], { row: 0, stitch: 0 });
    h = pushHistory(h, { row: 0, stitch: 1 });
    const a = undo(h)!;
    expect(a.count).toEqual({ row: 0, stitch: 1 });
    const b = undo(a.history)!;
    expect(b.count).toEqual({ row: 0, stitch: 0 });
    expect(undo(b.history)).toBeNull();
  });
  it('履歴は50件まで', () => {
    let h: Count[] = [];
    for (let i = 0; i < 60; i++) h = pushHistory(h, { row: 0, stitch: i });
    expect(h).toHaveLength(50);
    expect(h[0]).toEqual({ row: 0, stitch: 10 });
    expect(h[49]).toEqual({ row: 0, stitch: 59 });
  });
});

describe('progress', () => {
  it('目標の段数に対する割合', () => {
    expect(progress({ row: 40, stitch: 15 }, 80, 30)).toBeCloseTo(40.5 / 80);
    expect(progress({ row: 10, stitch: 0 }, null, 30)).toBeNull();
    expect(progress({ row: 90, stitch: 0 }, 80, null)).toBe(1);
  });
});
