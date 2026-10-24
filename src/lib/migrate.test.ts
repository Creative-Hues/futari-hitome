import { describe, expect, it } from 'vitest';
import {
  CURRENT_DATA_VERSION,
  FIRST_PART_ID,
  migrate,
  partnersFromWorks,
  partnerToV7,
  pickKnitting,
  workToV2,
  workToV3,
  workToV6,
  workToV7,
  type AnyDB,
} from './migrate';

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

describe('データのバージョン 5 → 6', () => {
  it('作品に「お休みにした日」(null)が足され、ほかはそのまま', () => {
    const v5 = { id: 'a', status: 'wip', count: { row: 3, stitch: 2 } };
    expect(workToV6(v5)).toEqual({ ...v5, pausedAt: null });
    expect(workToV6({ ...v5, pausedAt: '2026-10-10' }).pausedAt).toBe('2026-10-10');
  });
});

describe('データのバージョン 6 → 7', () => {
  const v6 = {
    id: 'a',
    status: 'wip',
    color: '#5aa3df',
    goalRows: 80,
    stitchesPerRow: 30,
    count: { row: 42, stitch: 17 },
    manualProgress: 0,
    history: [{ row: 42, stitch: 16, repeat: 2 }],
    pattern: { name: '模様', count: 2, everyRows: 8, baseRow: 0 },
    knitMs: 12345,
    lastCountAt: 99,
    memo: { yarn: '', needle: '', note: '' },
  };

  it('数・目標・取り消しの履歴・模様・編んだ時間が、1つ目のパーツにそのまま移る。棒針になる', () => {
    expect(workToV7(v6)).toEqual({
      id: 'a',
      status: 'wip',
      color: '#5aa3df',
      lastCountAt: 99,
      memo: v6.memo,
      tool: 'knit',
      currentPartId: FIRST_PART_ID,
      parts: [
        {
          id: FIRST_PART_ID,
          group: '',
          name: '',
          goalRows: 80,
          stitchesPerRow: 30,
          count: { row: 42, stitch: 17 },
          manualProgress: 0,
          history: [{ row: 42, stitch: 16, repeat: 2 }],
          pattern: v6.pattern,
          knitMs: 12345,
        },
      ],
    });
  });

  it('すでにパーツがある作品はそのまま(2回直しても同じ)', () => {
    const once = workToV7(v6);
    expect(workToV7(once)).toEqual(once);
  });

  it('前のうすい体の色は、同じ名前のはっきりした色になる。候補にない色・もとの色はそのまま', () => {
    expect(partnerToV7({ bodyColor: '#fbe2e8' }).bodyColor).toBe('#f5b3c2');
    expect(partnerToV7({ bodyColor: '#FBE2E8' }).bodyColor).toBe('#f5b3c2');
    expect(partnerToV7({ bodyColor: '#123456' }).bodyColor).toBe('#123456');
    expect(partnerToV7({ bodyColor: null }).bodyColor).toBeNull();
  });

  it('端末のデータ(バージョン6)を開くと、作品とパートナーが直る', async () => {
    const data = new Map<string, Map<string, any>>([
      ['settings', new Map([['app', { key: 'app', dataVersion: 6, quickAdds: [10], voiceWords: ['あみ'], lastExportedAt: null }]])],
      ['works', new Map([['a', v6]])],
      ['partners', new Map([['cat', { animal: 'cat', bodyColor: '#e0f3e6' }]])],
    ]);
    const db = {
      get: async (s: string, k: string) => data.get(s)?.get(k),
      getAll: async (s: string) => [...(data.get(s)?.values() ?? [])],
      put: async (s: string, v: any) => data.get(s)!.set(v.key ?? v.id ?? v.animal, v),
    } as unknown as AnyDB;
    await migrate(db);
    expect(data.get('settings')!.get('app').dataVersion).toBe(CURRENT_DATA_VERSION);
    expect(data.get('works')!.get('a').parts[0].count).toEqual({ row: 42, stitch: 17 });
    expect(data.get('partners')!.get('cat').bodyColor).toBe('#a6dcc0');
  });
});
