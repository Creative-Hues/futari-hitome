import { describe, expect, it } from 'vitest';
import { indexAt, moveItem } from './reorder';

describe('ドラッグ並び替え', () => {
  it('項目を動かす', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('指の位置にある項目', () => {
    const rects = [
      { left: 0, top: 0, right: 100, bottom: 50 },
      { left: 0, top: 60, right: 100, bottom: 110 },
    ];
    expect(indexAt(rects, 50, 80)).toBe(1);
    expect(indexAt(rects, 50, 55)).toBe(-1);
  });
});
