import { describe, expect, it } from 'vitest';
import { partnersFromWorks, workToV2 } from './migrate';

describe('データのバージョン 1 → 2', () => {
  it('6匹分の個体データができ、作品のある子だけ出会っている', () => {
    const ps = partnersFromWorks([
      { partner: 'sheep', startedAt: '2026-09-20T10:00:00.000Z' },
      { partner: 'sheep', startedAt: '2026-09-01T10:00:00.000Z' },
    ]);
    expect(ps.map((p) => p.animal)).toEqual(['sheep', 'cat', 'stoat', 'axolotl', 'seal', 'otter']);
    const sheep = ps.find((p) => p.animal === 'sheep')!;
    expect(sheep.met).toBe(true);
    expect(sheep.metAt).toBe('2026-09-01T10:00:00.000Z');
    expect(ps.filter((p) => p.met)).toHaveLength(1);
  });

  it('最初の頭飾りは anchors.json のとおり', () => {
    const deco = Object.fromEntries(partnersFromWorks([]).map((p) => [p.animal, p.decoration]));
    expect(deco).toEqual({
      sheep: 'tulip',
      cat: 'clover',
      stoat: 'sakura',
      axolotl: 'coral',
      seal: 'shell',
      otter: 'seaweed',
    });
  });

  it('作品には進行度0が足され、ほかの項目はそのまま', () => {
    const v1 = { id: 'a', name: 'マフラー', count: { row: 3, stitch: 2 } };
    expect(workToV2(v1)).toEqual({ ...v1, manualProgress: 0 });
    // すでに入っていれば上書きしない
    expect(workToV2({ ...v1, manualProgress: 40 }).manualProgress).toBe(40);
  });
});
