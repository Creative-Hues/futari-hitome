// 端末内の保存(IndexedDB)。外には何も送らない。
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { ANIMALS, type DecorationId } from '../data/animals';
import type { Count } from './counter';
import { CURRENT_DATA_VERSION, migrate, newPartner } from './migrate';

export type DepartmentId = 'head' | 'neck' | 'body' | 'paw' | 'wear' | 'interior';
export type AnimalId = 'sheep' | 'cat' | 'stoat' | 'axolotl' | 'seal' | 'otter';

export interface Work {
  id: string;
  name: string;
  department: DepartmentId;
  /** 種類名(マフラー、帽子など) */
  kind: string;
  partner: AnimalId;
  status: 'wip' | 'done';
  /** 並び順(小さいほど上) */
  order: number;
  /** 作品の色 */
  color: string;
  /** 目標の段数。目標なしは null */
  goalRows: number | null;
  /** 1段の目数。入れていなければ null(段だけ数える) */
  stitchesPerRow: number | null;
  count: Count;
  /** 目標なしの作品の「今このくらい」(0〜100%) */
  manualProgress: number;
  /** 取り消し用:操作前の状態(直近50件) */
  history: Count[];
  /** 始めた日(ISO文字列) */
  startedAt: string;
  updatedAt: string;
}

export interface Settings {
  key: 'app';
  dataVersion: number;
  /** 「+N」に登録した数 */
  quickAdds: number[];
}

/** 動物ごとに1匹のパートナーの個体データ */
export interface PartnerData {
  animal: AnimalId;
  /** 一緒に編んだことがあるか(初めて編むときに出会う) */
  met: boolean;
  metAt: string | null;
  decoration: DecorationId;
  /** 体の色・目の色・身につけている作品(フェーズ4で使う。null は素材のまま) */
  bodyColor: string | null;
  eyeColor: string | null;
  wearingWorkId: string | null;
  /** 名前(任意) */
  name: string;
}

interface FutariDB extends DBSchema {
  works: { key: string; value: Work };
  settings: { key: string; value: Settings };
  partners: { key: string; value: PartnerData };
}

const DB_NAME = 'futari-hitome';
const DB_SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  key: 'app',
  dataVersion: CURRENT_DATA_VERSION,
  quickAdds: [10],
};

let dbPromise: Promise<IDBPDatabase<FutariDB>> | null = null;

function db(): Promise<IDBPDatabase<FutariDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FutariDB>(DB_NAME, DB_SCHEMA_VERSION, {
      upgrade(database, oldVersion) {
        // 入れ物を増やすときは DB_SCHEMA_VERSION を上げて、ここに足していく
        if (oldVersion < 1) {
          database.createObjectStore('works', { keyPath: 'id' });
          database.createObjectStore('settings', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          database.createObjectStore('partners', { keyPath: 'animal' });
        }
      },
    }).then(async (database) => {
      await migrate(database);
      return database;
    });
  }
  return dbPromise;
}

export async function getSettings(): Promise<Settings> {
  return (await (await db()).get('settings', 'app')) ?? { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await db()).put('settings', settings);
}

export async function listWorks(): Promise<Work[]> {
  const works = await (await db()).getAll('works');
  return works.sort((a, b) => a.order - b.order);
}

export async function getWork(id: string): Promise<Work | undefined> {
  return (await db()).get('works', id);
}

export async function saveWork(work: Work): Promise<void> {
  await (await db()).put('works', work);
}

/** 新しい作品を一覧の一番上に入れる */
export async function addWork(work: Omit<Work, 'order'>): Promise<Work> {
  const works = await listWorks();
  const order = works.length ? works[0].order - 1 : 0;
  const saved = { ...work, order };
  await saveWork(saved);
  return saved;
}

export async function listPartners(): Promise<Record<AnimalId, PartnerData>> {
  const list = await (await db()).getAll('partners');
  const map = {} as Record<AnimalId, PartnerData>;
  for (const a of ANIMALS) map[a] = list.find((p) => p.animal === a) ?? newPartner(a);
  return map;
}

export async function getPartner(animal: AnimalId): Promise<PartnerData> {
  return (await (await db()).get('partners', animal)) ?? newPartner(animal);
}

/** その子と初めて編むときに「出会う」 */
export async function meetPartner(animal: AnimalId): Promise<void> {
  const p = await getPartner(animal);
  if (p.met) return;
  await (await db()).put('partners', { ...p, met: true, metAt: new Date().toISOString() });
}
