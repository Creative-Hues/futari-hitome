import { describe, expect, it } from 'vitest';
import { TapGuard } from './tapGuard';

describe('TapGuard', () => {
  it('1本指のタップは数える', () => {
    const g = new TapGuard(1, 150);
    g.down(1);
    expect(g.up(1, 1000)).toBe(true);
  });

  it('2本指が触れたタッチは数えない', () => {
    const g = new TapGuard(1, 150);
    g.down(1);
    g.down(2);
    expect(g.up(1, 1000)).toBe(false);
    expect(g.up(2, 1010)).toBe(false);
    // 全部離れたら元通り
    g.down(3);
    expect(g.up(3, 2000)).toBe(true);
  });

  it('0.15秒以内の連続タッチは1回とみなす', () => {
    const g = new TapGuard(1, 150);
    g.down(1);
    expect(g.up(1, 1000)).toBe(true);
    g.down(2);
    expect(g.up(2, 1100)).toBe(false);
  });

  it('0.15秒あければ続けて数える', () => {
    const g = new TapGuard(1, 150);
    g.down(1);
    expect(g.up(1, 1000)).toBe(true);
    g.down(2);
    expect(g.up(2, 1150)).toBe(true);
    g.down(3);
    expect(g.up(3, 1400)).toBe(true);
  });

  it('取り消されたタッチは数えない', () => {
    const g = new TapGuard(1, 150);
    g.down(1);
    g.cancel(1);
    g.down(2);
    expect(g.up(2, 1000)).toBe(true);
  });
});
