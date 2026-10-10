import { describe, expect, it } from 'vitest';
import { CURRENT_DATA_VERSION, migrate, partnersFromWorks, pickKnitting, workToV2, workToV3, type AnyDB } from './migrate';

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

describe('データのバージョン 2 → 3', () => {
  it('作品に新しい項目が足され、ほかの項目はそのまま', () => {
    const v2 = { id: 'a', name: 'マフラー', count: { row: 3, stitch: 2 }, manualProgress: 40 };
    const v3 = workToV3(v2);
    expect(v3).toMatchObject(v2);
    expect(v3).toMatchObject({
      pattern: null,
      memo: { yarn: '', needle: '', note: '' },
      impression: '',
      knitMs: 0,
      lastCountAt: null,
      finishedAt: null,
      giftedTo: null,
    });
  });

  it('パートナーの今編んでいる作品は、その子の編みかけのうち最後に数えた作品', () => {
    const works = [
      { id: 'a', partner: 'sheep' as const, status: 'wip' as const, updatedAt: '2026-10-01' },
      { id: 'b', partner: 'sheep' as const, status: 'wip' as const, updatedAt: '2026-10-03' },
      { id: 'c', partner: 'sheep' as const, status: 'done' as const, updatedAt: '2026-10-05' },
      { id: 'd', partner: 'cat' as const, status: 'wip' as const, updatedAt: '2026-10-09' },
    ];
    expect(pickKnitting('sheep', works)).toBe('b');
    expect(pickKnitting('cat', works)).toBe('d');
    expect(pickKnitting('seal', works)).toBeNull();
  });

  it('新しい子は、今編んでいる作品なし', () => {
    expect(partnersFromWorks([]).every((p) => p.knittingWorkId === null)).toBe(true);
  });
});

describe('データのバージョン 4 → 5', () => {
  it('設定に「最後に書き出した日」(null)が足され、ほかはそのまま', async () => {
    const data = new Map<string, any>([['settings', { key: 'app', dataVersion: 4, quickAdds: [5], voiceWords: ['はい'] }]]);
    const db = {
      get: async (s: string) => data.get(s),
      getAll: async () => [],
      put: async (s: string, v: any) => data.set(s, v),
    } as unknown as AnyDB;
    await migrate(db);
    expect(data.get('settings')).toEqual({
      key: 'app',
      dataVersion: CURRENT_DATA_VERSION,
      quickAdds: [5],
      voiceWords: ['はい'],
      lastExportedAt: null,
    });
  });
});
