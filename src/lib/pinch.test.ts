import { describe, expect, it } from 'vitest';
import { clampView, pinch, zoomAt } from './pinch';

describe('写真を2本指で拡大', () => {
  it('2本指を広げると大きくなり、真ん中の点は動かない', () => {
    const v = pinch({ scale: 1, x: 0, y: 0 }, { x: -10, y: 0 }, { x: 10, y: 0 }, { x: -20, y: 0 }, { x: 20, y: 0 });
    expect(v.scale).toBe(2);
    expect(v.x).toBe(0);
  });

  it('2本指をそろえて動かすと写真も動く', () => {
    const v = pinch({ scale: 2, x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 7 }, { x: 15, y: 7 });
    expect(v).toEqual({ scale: 2, x: 5, y: 7 });
  });

  it('拡大した点がそのままの位置に残る', () => {
    // 点 50 は写真の 50 の位置。2倍で 100 になるので、-50 ずらす
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 2, 50, 0).x).toBe(-50);
  });

  it('1〜5倍に収め、写真が枠の外へ行きすぎない', () => {
    expect(clampView({ scale: 0.5, x: 30, y: 0 }, 300, 200, 300, 400)).toEqual({ scale: 1, x: 0, y: 0 });
    const v = clampView({ scale: 9, x: 9999, y: -9999 }, 300, 200, 300, 400);
    expect(v.scale).toBe(5);
    expect(v.x).toBe((300 * 5 - 300) / 2);
    expect(v.y).toBe(-(200 * 5 - 400) / 2);
  });
});
