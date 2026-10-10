import { describe, expect, it } from 'vitest';
import { skyParam, timeOfDay } from './timeOfDay';
import { darken } from './color';

const at = (h: number, m = 0) => new Date(2026, 9, 10, h, m);

describe('時間帯', () => {
  it('朝5〜10時・昼10〜16時・夕方16〜19時・夜19〜5時', () => {
    expect(timeOfDay(at(4, 59))).toBe('night');
    expect(timeOfDay(at(5))).toBe('morning');
    expect(timeOfDay(at(9, 59))).toBe('morning');
    expect(timeOfDay(at(10))).toBe('day');
    expect(timeOfDay(at(15, 59))).toBe('day');
    expect(timeOfDay(at(16))).toBe('evening');
    expect(timeOfDay(at(18, 59))).toBe('evening');
    expect(timeOfDay(at(19))).toBe('night');
    expect(timeOfDay(at(0))).toBe('night');
  });
});

describe('色を濃くする', () => {
  it('明るさだけ下げる', () => {
    expect(darken('#ffffff', 10)).toBe('#e6e6e6');
    expect(darken('#000000', 10)).toBe('#000000');
  });
  it('青は青のまま濃くなる', () => {
    const d = darken('#5aa3df', 12);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(d.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
    expect(b).toBeLessThan(0xdf);
  });
});

describe('確認用の ?sky=', () => {
  it('# の前でも後ろでも読める', () => {
    expect(skyParam('?sky=night', '#/')).toBe('night');
    expect(skyParam('', '#/knit/abc?sky=morning')).toBe('morning');
    expect(skyParam('', '#/?sky=evening')).toBe('evening');
    expect(skyParam('?sky=day', '')).toBe('day');
  });
  it('付けていない・正しくない値のときは null(今の時刻で決める)', () => {
    expect(skyParam('', '#/')).toBeNull();
    expect(skyParam('?sky=noon', '#/')).toBeNull();
    expect(skyParam('?time=night', '#/')).toBeNull();
  });
});
