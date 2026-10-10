// データのバージョン番号と、古い形のデータを新しい形に直す仕組み。
// データの形を変えるときは CURRENT_DATA_VERSION を1つ上げ、STEPS に「前の番号 → 次の番号」の直し方を足す。
import type { IDBPDatabase } from 'idb';
import { ROOM_PALETTES } from '../config/room';
import { ANIMALS, defaultDecoration } from '../data/animals';
import { defaultInteriorShape, WEAR_DEPTS } from '../data/wear';
import type { AnimalId, PartnerData, RoomData, Work } from './db';
import { initialDisplay, initialWearing } from './wardrobe';

export const CURRENT_DATA_VERSION = 5;

/** 音声入力で1カウントになる言葉(最初) */
export const DEFAULT_VOICE_WORDS = ['あみ'];

/** IndexedDB(または、読み込むファイルを直すときの、同じ get / getAll / put が使えるメモリの中の入れ物) */
export type AnyDB = Pick<IDBPDatabase<any>, 'get' | 'getAll' | 'put'>;

/** まだ出会っていない子の、最初の個体データ */
export function newPartner(animal: AnimalId): PartnerData {
  return {
    animal,
    met: false,
    metAt: null,
    decoration: defaultDecoration(animal),
    bodyColor: null,
    eyeColor: null,
    wearing: {},
    name: '',
    knittingWorkId: null,
  };
}

/** 6匹分の個体データ。すでに作品がある子は「出会った」にする(出会った日はその子のいちばん古い作品の始めた日) */
export function partnersFromWorks(works: { partner: AnimalId; startedAt: string }[]): PartnerData[] {
  return ANIMALS.map((a) => {
    const mine = works.filter((w) => w.partner === a).map((w) => w.startedAt).sort();
    return mine.length ? { ...newPartner(a), met: true, metAt: mine[0] } : newPartner(a);
  });
}

/** バージョン1の作品に、目標なしの進行度を足す */
export function workToV2<T extends object>(w: T): T & { manualProgress: number } {
  return { manualProgress: 0, ...w };
}

/** バージョン2の作品に、2つ目のカウンター・メモ・感想・完成の記録・編んだ時間を足す */
export function workToV3<T extends object>(w: T) {
  return {
    pattern: null,
    memo: { yarn: '', needle: '', note: '' },
    impression: '',
    knitMs: 0,
    lastCountAt: null,
    finishedAt: null,
    giftedTo: null,
    ...w,
  };
}

/** 最初の部屋:おすすめの「はじめの部屋」の色と花(今までのホームと同じ見た目) */
export function newRoom(): RoomData {
  const { name: _name, ...first } = ROOM_PALETTES[0];
  return { key: 'room', ...first, displayed: [] };
}

/** バージョン3の作品に、部屋に飾るときの絵を足す(小物やインテリアだけ。種類名から決める) */
export function workToV4<T extends { department: string; kind: string }>(w: T): T & { interiorShape: Work['interiorShape'] } {
  const shape = w.department === 'interior' ? defaultInteriorShape(w.kind) : null;
  return { interiorShape: shape, ...w };
}

/** バージョン3のパートナーの「身につけている作品」(1つ)を、部門ごとの形にする。完成作品は部門ごとに一番新しいものを身につける */
export function partnerToV4(
  p: Omit<PartnerData, 'wearing'> & { wearingWorkId?: string | null; wearing?: PartnerData['wearing'] },
  works: Pick<Work, 'id' | 'department' | 'status' | 'giftedTo' | 'finishedAt'>[],
): PartnerData {
  const { wearingWorkId, ...rest } = p;
  const wearing = { ...initialWearing(p.animal, works), ...p.wearing };
  const old = works.find((w) => w.id === wearingWorkId && w.giftedTo === p.animal);
  if (old && (WEAR_DEPTS as string[]).includes(old.department)) {
    wearing[old.department as keyof PartnerData['wearing']] = old.id;
  }
  return { ...rest, wearing };
}

/** その子の「今編んでいる作品」:編みかけのうち、最後に数えた作品 */
export function pickKnitting(
  animal: AnimalId,
  works: Pick<Work, 'id' | 'partner' | 'status' | 'updatedAt'>[],
): string | null {
  const mine = works.filter((w) => w.partner === animal && w.status === 'wip');
  mine.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return mine[0]?.id ?? null;
}

/** STEPS[n] は、バージョン n のデータを n+1 に直す */
const STEPS: Record<number, (db: AnyDB) => Promise<void>> = {
  // 1 → 2:パートナーの個体データを作る。作品に目標なしの進行度を足す
  1: async (db) => {
    const works = await db.getAll('works');
    for (const w of works) await db.put('works', workToV2(w));
    for (const p of partnersFromWorks(works)) {
      if (!(await db.get('partners', p.animal))) await db.put('partners', p);
    }
  },
  // 2 → 3:作品に新しい項目を足す。パートナーに「今編んでいる作品」を足す
  2: async (db) => {
    const works = await db.getAll('works');
    for (const w of works) await db.put('works', workToV3(w));
    for (const p of await db.getAll('partners')) {
      if (p.knittingWorkId === undefined) {
        await db.put('partners', { ...p, knittingWorkId: pickKnitting(p.animal, works) });
      }
    }
  },
  // 3 → 4:作品に部屋に飾るときの絵、パートナーに部門ごとの「身につけている作品」、部屋、音声の言葉。
  // フェーズ3までに完成した作品は、同じ決め方で身につけ・飾っておく
  3: async (db) => {
    const works = (await db.getAll('works')).map(workToV4);
    for (const w of works) await db.put('works', w);
    for (const p of await db.getAll('partners')) await db.put('partners', partnerToV4(p, works));
    if (!(await db.get('room', 'room'))) {
      await db.put('room', { ...newRoom(), displayed: initialDisplay(works) });
    }
    const settings = await db.get('settings', 'app');
    if (!settings.voiceWords) await db.put('settings', { ...settings, voiceWords: DEFAULT_VOICE_WORDS });
  },
  // 4 → 5:設定に「最後に書き出した日」を足す
  4: async (db) => {
    const settings = await db.get('settings', 'app');
    if (settings.lastExportedAt === undefined) await db.put('settings', { ...settings, lastExportedAt: null });
  },
};

/** バージョン from のデータを、STEPS を順に動かして今の形に直す。直したあとのバージョンを返す */
export async function runSteps(db: AnyDB, from: number): Promise<number> {
  let version = from;
  while (version < CURRENT_DATA_VERSION) {
    const step = STEPS[version];
    if (!step) throw new Error(`データのバージョン ${version} を直す方法がありません`);
    await step(db);
    version += 1;
  }
  return version;
}

export async function migrate(db: AnyDB): Promise<void> {
  const settings = await db.get('settings', 'app');
  if (!settings) {
    // 初めて開いたとき
    await db.put('settings', {
      key: 'app',
      dataVersion: CURRENT_DATA_VERSION,
      quickAdds: [10],
      voiceWords: DEFAULT_VOICE_WORDS,
      lastExportedAt: null,
    });
    for (const p of partnersFromWorks([])) await db.put('partners', p);
    await db.put('room', newRoom());
    return;
  }
  const version = await runSteps(db, settings.dataVersion ?? 1);
  if (version !== settings.dataVersion) {
    await db.put('settings', { ...(await db.get('settings', 'app')), dataVersion: version });
  }
}
