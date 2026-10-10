import { describe, expect, it } from 'vitest';
import { shrinkSize } from './photo';

describe('写真の縮小', () => {
  it('長辺1600pxまで縮め、小さい写真は大きくしない', () => {
    expect(shrinkSize(4032, 3024, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(shrinkSize(3024, 4032, 1600)).toEqual({ w: 1200, h: 1600 });
    expect(shrinkSize(800, 600, 1600)).toEqual({ w: 800, h: 600 });
  });
});
