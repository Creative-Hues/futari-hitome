import { describe, expect, it } from 'vitest';
import { ANIMALS } from '../data/animals';
import { APP_ID, backupParts, exportFileName, FILE_VERSION, parseBackup, REASONS } from './backup';
import { DEFAULT_SETTINGS, type Photo, type Snapshot, type Work } from './db';
import { CURRENT_DATA_VERSION, newPartner, newRoom } from './migrate';

const bytes = (n: number, seed = 1) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * 31 + seed * 7) & 0xff;
  return b;
};

function work(id: string, extra: Partial<Work> = {}): Work {
  return {
    id,
    name: `作品${id}`,
    department: 'neck',
    kind: 'マフラー',
    partner: 'cat',
    status: 'wip',
    order: 0,
    color: '#5aa3df',
    goalRows: 80,
    stitchesPerRow: 30,
    count: { row: 42, stitch: 17 },
    manualProgress: 0,
    history: [{ row: 42, stitch: 16 }],
    pattern: { name: '模様', count: 3, everyRows: 4, baseRow: 0 },
    memo: { yarn: '毛糸', needle: '6号', note: 'メモ "引用" \\ と改行\nも' },
    impression: '',
    knitMs: 12345,
    lastCountAt: 1,
    startedAt: '2026-10-01T00:00:00.000Z',
    finishedAt: null,
    pausedAt: null,
    giftedTo: null,
    interiorShape: null,
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...extra,
  };
}

function photo(id: string, workId: string, size: number, seed: number): Photo {
  return {
    id,
    workId,
    kind: 'pattern',
    order: seed,
    blob: new Blob([bytes(size, seed)], { type: 'image/jpeg' }),
    thumb: new Blob([bytes(size >> 3, seed + 1)], { type: 'image/jpeg' }),
    width: 1600,
    height: 1200,
    createdAt: '2026-10-03T00:00:00.000Z',
  };
}

function snapshot(photos: Photo[] = []): Snapshot {
  const cat = { ...newPartner('cat'), met: true, metAt: '2026-10-01T00:00:00.000Z', wearing: { neck: 'b' }, name: 'たま' };
  return {
    settings: { ...DEFAULT_SETTINGS, quickAdds: [10, 5], voiceWords: ['あみ', 'はい'], lastExportedAt: null },
    works: [work('a'), work('b', { status: 'done', finishedAt: '2026-10-05T00:00:00.000Z', giftedTo: 'cat' })],
    partners: ANIMALS.map((a) => (a === 'cat' ? cat : newPartner(a))),
    photos,
    room: { ...newRoom(), wall: '#ffeeee', displayed: [] },
  };
}

const toText = async (parts: string[]) => new Blob(parts).text();

async function exported(snap: Snapshot) {
  return toText(await backupParts(snap, '2026-10-11T09:30:00.000Z'));
}

describe('ファイル名', () => {
  it('端末の日付で futari-hitome-YYYY-MM-DD.json', () => {
    expect(exportFileName(new Date(2026, 9, 11, 23, 59))).toBe('futari-hitome-2026-10-11.json');
    expect(exportFileName(new Date(2027, 0, 5, 0, 1))).toBe('futari-hitome-2027-01-05.json');
  });
});

describe('書き出して読み込む', () => {
  it('5つの入れ物の中身が元と同じに戻る(写真は1バイト単位で)', async () => {
    const snap = snapshot([photo('p1', 'a', 5000, 1), photo('p2', 'b', 7001, 2)]);
    const text = await exported(snap);
    const file = JSON.parse(text);
    expect(file).toMatchObject({ app: APP_ID, fileVersion: FILE_VERSION, dataVersion: CURRENT_DATA_VERSION });

    const r = await parseBackup(text);
    if (!r.ok) throw new Error(r.reason);
    const { photos, ...rest } = r.snapshot;
    const { photos: before, ...restBefore } = snap;
    expect(rest).toEqual(restBefore);
    expect(photos).toHaveLength(2);
    for (const [i, p] of photos.entries()) {
      const { blob, thumb, ...meta } = p;
      const { blob: b0, thumb: t0, ...meta0 } = before[i];
      expect(meta).toEqual(meta0);
      expect(blob.type).toBe('image/jpeg');
      expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array(await b0.arrayBuffer()));
      expect(new Uint8Array(await thumb.arrayBuffer())).toEqual(new Uint8Array(await t0.arrayBuffer()));
    }
    expect(r.summary).toEqual({ exportedAt: '2026-10-11T09:30:00.000Z', wip: 1, paused: 0, done: 1, photos: 2, met: 1 });
  });

  it('写真が20枚(1枚0.5MBほど)でも、部品の配列のままファイルにでき、読み込める', async () => {
    const photos = Array.from({ length: 20 }, (_, i) => photo(`p${i}`, 'a', 500_000, i));
    const parts = await backupParts(snapshot(photos), '2026-10-11T09:30:00.000Z');
    // 画像の文字は1枚ずつ別の部品(大きな1つの文字列にはしない)
    expect(parts.length).toBeGreaterThan(20 * 4);
    expect(Math.max(...parts.map((p) => p.length))).toBeLessThan(700_000);
    const file = new File(parts, exportFileName(), { type: 'application/json' });
    const r = await parseBackup(await file.text());
    if (!r.ok) throw new Error(r.reason);
    expect(r.snapshot.photos).toHaveLength(20);
    expect(r.snapshot.photos[19].blob.size).toBe(500_000);
  });

  it('写真がないときも読める', async () => {
    const r = await parseBackup(await exported(snapshot()));
    expect(r.ok && r.snapshot.photos).toEqual([]);
  });

  it('どの作品のものでもない写真は飛ばす', async () => {
    const r = await parseBackup(await exported(snapshot([photo('p1', 'a', 10, 1), photo('p2', 'gone', 10, 2)])));
    expect(r.ok && r.snapshot.photos.map((p) => p.id)).toEqual(['p1']);
  });
});

describe('読み込めないファイル', () => {
  const reasonOf = async (text: string) => {
    const r = await parseBackup(text);
    return r.ok ? 'ok' : r.reason;
  };

  it('JSON として読めない(途中で切れている・ほかの種類)', async () => {
    const text = await exported(snapshot([photo('p1', 'a', 1000, 1)]));
    expect(await reasonOf(text.slice(0, text.length - 100))).toBe(REASONS.notJson);
    expect(await reasonOf('\xff\xd8\xff\xe0 JFIF')).toBe(REASONS.notJson);
    expect(await reasonOf('')).toBe(REASONS.notJson);
  });

  it('ほかのアプリの JSON・入れ物がそろっていない', async () => {
    expect(await reasonOf('{"works":[]}')).toBe(REASONS.notOurs);
    expect(await reasonOf('[1,2,3]')).toBe(REASONS.notOurs);
    const file = JSON.parse(await exported(snapshot()));
    delete file.room;
    expect(await reasonOf(JSON.stringify(file))).toBe(REASONS.notOurs);
  });

  it('新しすぎるバージョン', async () => {
    const file = JSON.parse(await exported(snapshot()));
    expect(await reasonOf(JSON.stringify({ ...file, dataVersion: CURRENT_DATA_VERSION + 1 }))).toBe(REASONS.tooNew);
    expect(await reasonOf(JSON.stringify({ ...file, fileVersion: FILE_VERSION + 1 }))).toBe(REASONS.tooNew);
  });

  it('作品に ID がない・数が数字でない・同じ ID が2つ', async () => {
    const file = JSON.parse(await exported(snapshot()));
    const broken = (works: unknown[]) => JSON.stringify({ ...file, works });
    expect(await reasonOf(broken([{ ...file.works[0], id: undefined }]))).toBe(REASONS.broken('作品'));
    expect(await reasonOf(broken([{ ...file.works[0], count: { row: 'x', stitch: 0 } }]))).toBe(REASONS.broken('作品'));
    expect(await reasonOf(broken([file.works[0], file.works[0]]))).toBe(REASONS.broken('作品'));
  });

  it('写真の文字が壊れている', async () => {
    const file = JSON.parse(await exported(snapshot([photo('p1', 'a', 100, 1)])));
    file.photos[0].blob = 'data:image/jpeg;base64,@@@@';
    expect(await reasonOf(JSON.stringify(file))).toBe(REASONS.broken('写真'));
    file.photos[0].blob = 'こわれた';
    expect(await reasonOf(JSON.stringify(file))).toBe(REASONS.broken('写真'));
  });
});

describe('古いバージョンのファイルを今の形に直す', () => {
  const v1Work = {
    id: 'w1',
    name: 'マフラー',
    department: 'neck',
    kind: 'マフラー',
    partner: 'sheep',
    status: 'wip',
    order: 0,
    color: '#5aa3df',
    goalRows: 80,
    stitchesPerRow: null,
    count: { row: 3, stitch: 0 },
    history: [],
    startedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };
  const base = { app: APP_ID, fileVersion: 1, exportedAt: '2026-10-11T00:00:00.000Z' };

  it('バージョン1(作品と設定だけ)', async () => {
    const r = await parseBackup(
      JSON.stringify({ ...base, dataVersion: 1, settings: { key: 'app', dataVersion: 1, quickAdds: [10] }, works: [v1Work] }),
    );
    if (!r.ok) throw new Error(r.reason);
    const s = r.snapshot;
    expect(s.settings).toMatchObject({ dataVersion: CURRENT_DATA_VERSION, voiceWords: ['あみ'], lastExportedAt: null });
    expect(s.works[0]).toMatchObject({ ...v1Work, manualProgress: 0, pattern: null, interiorShape: null, knitMs: 0 });
    expect(s.partners.map((p) => p.animal)).toEqual(ANIMALS);
    expect(s.partners.find((p) => p.animal === 'sheep')).toMatchObject({ met: true, wearing: {} });
    expect(s.room).toEqual(newRoom());
  });

  it('バージョン3(完成した小物を部屋に飾り、首の作品を身につける)', async () => {
    const v3Work = (id: string, extra: object) => ({
      ...v1Work,
      id,
      manualProgress: 0,
      pattern: null,
      memo: { yarn: '', needle: '', note: '' },
      impression: '',
      knitMs: 0,
      lastCountAt: null,
      finishedAt: null,
      giftedTo: null,
      ...extra,
    });
    const works = [
      v3Work('n', { status: 'done', finishedAt: '2026-09-10T00:00:00.000Z', giftedTo: 'sheep', department: 'neck' }),
      v3Work('i', {
        status: 'done',
        finishedAt: '2026-09-11T00:00:00.000Z',
        giftedTo: 'sheep',
        department: 'interior',
        kind: 'ブランケット',
      }),
    ];
    const partners = ANIMALS.map((a) => {
      const { wearing: _w, ...p } = newPartner(a);
      return { ...p, wearingWorkId: null, met: a === 'sheep' };
    });
    const photos = [
      { id: 'ph', workId: 'i', kind: 'finished', order: 0, width: 2, height: 2, createdAt: '', blob: 'data:image/jpeg;base64,AAEC', thumb: 'data:image/jpeg;base64,AA==' },
    ];
    const r = await parseBackup(
      JSON.stringify({ ...base, dataVersion: 3, settings: { key: 'app', dataVersion: 3, quickAdds: [10] }, works, partners, photos }),
    );
    if (!r.ok) throw new Error(r.reason);
    const s = r.snapshot;
    expect(s.works.find((w) => w.id === 'i')!.interiorShape).toBe('blanket');
    expect(s.partners.find((p) => p.animal === 'sheep')!.wearing).toEqual({ neck: 'n' });
    expect(s.room.displayed).toEqual(['i']);
    expect(s.photos).toHaveLength(1);
    expect([...new Uint8Array(await s.photos[0].blob.arrayBuffer())]).toEqual([0, 1, 2]);
  });

  it('バージョン4(設定に「最後に書き出した日」が足される)', async () => {
    const file = JSON.parse(await exported(snapshot()));
    delete file.settings.lastExportedAt;
    const r = await parseBackup(JSON.stringify({ ...file, dataVersion: 4, settings: { ...file.settings, dataVersion: 4 } }));
    if (!r.ok) throw new Error(r.reason);
    expect(r.snapshot.settings).toMatchObject({ dataVersion: CURRENT_DATA_VERSION, lastExportedAt: null, quickAdds: [10, 5] });
    expect(r.snapshot.works).toEqual(snapshot().works);
  });
});

describe('お休み(データのバージョン6)', () => {
  it('お休みの作品は、状態とお休みにした日がそのまま戻り、件数に出る', async () => {
    const snap = snapshot();
    snap.works.push(work('c', { status: 'paused', pausedAt: '2026-10-10T00:00:00.000Z', history: [{ row: 1, stitch: 2 }] }));
    const r = await parseBackup(await exported(snap));
    if (!r.ok) throw new Error(r.reason);
    expect(r.snapshot.works).toEqual(snap.works);
    expect(r.summary).toMatchObject({ wip: 1, paused: 1, done: 1 });
  });

  it('バージョン5のファイル:作品に pausedAt: null が足される', async () => {
    const file = JSON.parse(await exported(snapshot()));
    for (const w of file.works) delete w.pausedAt;
    const r = await parseBackup(JSON.stringify({ ...file, dataVersion: 5, settings: { ...file.settings, dataVersion: 5 } }));
    if (!r.ok) throw new Error(r.reason);
    expect(r.snapshot.works).toEqual(snapshot().works);
    expect(r.snapshot.works.every((w) => w.pausedAt === null)).toBe(true);
  });

  it('知らない状態の作品は壊れたファイル', async () => {
    const file = JSON.parse(await exported(snapshot()));
    file.works[0].status = 'sleeping';
    const r = await parseBackup(JSON.stringify(file));
    expect(r.ok ? 'ok' : r.reason).toBe(REASONS.broken('作品'));
  });
});
