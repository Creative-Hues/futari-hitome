import { describe, expect, it } from 'vitest';
import { addKnitTime, daysBetween, formatKnitTime } from './knitTime';

describe('編んだ時間の目安', () => {
  it('5分以内の間だけ足す', () => {
    let t = addKnitTime(0, null, 1000);
    expect(t.knitMs).toBe(0);
    t = addKnitTime(t.knitMs, t.lastAt, 61_000);
    expect(t.knitMs).toBe(60_000);
    t = addKnitTime(t.knitMs, t.lastAt, 61_000 + 6 * 60_000);
    expect(t.knitMs).toBe(60_000);
  });

  it('表示', () => {
    expect(formatKnitTime(0)).toBe('記録なし');
    expect(formatKnitTime(3 * 60_000)).toBe('10分未満');
    expect(formatKnitTime(200 * 60_000)).toBe('約 3時間20分');
    expect(formatKnitTime(60 * 60_000)).toBe('約 1時間');
  });

  it('かかった日数は同じ日なら1日', () => {
    expect(daysBetween('2026-10-01T09:00:00', '2026-10-01T22:00:00')).toBe(1);
    expect(daysBetween('2026-09-30T23:00:00', '2026-10-02T01:00:00')).toBe(3);
  });
});
