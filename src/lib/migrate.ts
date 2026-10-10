// データのバージョン番号と、古い形のデータを新しい形に直す仕組み。
// データの形を変えるときは CURRENT_DATA_VERSION を1つ上げ、STEPS に「前の番号 → 次の番号」の直し方を足す。
import type { IDBPDatabase } from 'idb';
import { ANIMALS, defaultDecoration } from '../data/animals';
import type { AnimalId, PartnerData, Work } from './db';

export const CURRENT_DATA_VERSION = 3;

type AnyDB = IDBPDatabase<any>;

/** まだ出会っていない子の、最初の個体データ */
export function newPartner(animal: AnimalId): PartnerData {
  return {
    animal,
    met: false,
    metAt: null,
    decoration: defaultDecoration(animal),
    bodyColor: null,
    eyeColor: null,
    wearingWorkId: null,
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
};

export async function migrate(db: AnyDB): Promise<void> {
  const settings = await db.get('settings', 'app');
  if (!settings) {
    // 初めて開いたとき
    await db.put('settings', { key: 'app', dataVersion: CURRENT_DATA_VERSION, quickAdds: [10] });
    for (const p of partnersFromWorks([])) await db.put('partners', p);
    return;
  }
  let version: number = settings.dataVersion ?? 1;
  while (version < CURRENT_DATA_VERSION) {
    const step = STEPS[version];
    if (!step) throw new Error(`データのバージョン ${version} を直す方法がありません`);
    await step(db);
    version += 1;
  }
  if (version !== settings.dataVersion) {
    await db.put('settings', { ...(await db.get('settings', 'app')), dataVersion: version });
  }
}
