// 端末内の保存(IndexedDB)。外には何も送らない。
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { ANIMALS, type DecorationId } from '../data/animals';
import type { InteriorShape, WearDept } from '../data/wear';
import { CURRENT_DATA_VERSION, DEFAULT_VOICE_WORDS, migrate, newPartner, newRoom, pickKnitting } from './migrate';
import { knitOnResume, partnerAfterDelete, paused, releaseKnitting, resumed, roomAfterDelete } from './lifecycle';
import type { Part } from './parts';
import { displayOnComplete, undisplay, unwear, wearOnComplete } from './wardrobe';

export type { HistoryEntry, Part } from './parts';

export type DepartmentId = 'head' | 'neck' | 'body' | 'paw' | 'wear' | 'interior';
export type AnimalId = 'sheep' | 'cat' | 'stoat' | 'axolotl' | 'seal' | 'otter';

/** 編み方:棒針 / かぎ針 */
export type KnitTool = 'knit' | 'crochet';

export interface WorkMemo {
  /** 使った毛糸 */
  yarn: string;
  /** 針の号数 */
  needle: string;
  /** 自由メモ */
  note: string;
}

export interface Work {
  id: string;
  name: string;
  department: DepartmentId;
  /** 種類名(マフラー、帽子など) */
  kind: string;
  partner: AnimalId;
  /** 編みかけ / お休み / 完成 */
  status: 'wip' | 'paused' | 'done';
  /** 並び順(小さいほど上) */
  order: number;
  /** 作品の色 */
  color: string;
  /** 棒針 / かぎ針 */
  tool: KnitTool;
  /**
   * パーツ(1つ以上)。段・目・目標・取り消しの履歴・模様の回数・編んだ時間はパーツごとに持つ。
   * パーツを作らない作品は、パーツ1つ(名前は空)
   */
  parts: Part[];
  /** 今編んでいるパーツ */
  currentPartId: string;
  memo: WorkMemo;
  /** 感想 */
  impression: string;
  /** 最後に数が変わった時刻(編んだ時間の目安を足すため) */
  lastCountAt: number | null;
  /** 始めた日(ISO文字列) */
  startedAt: string;
  /** 完成した日(ISO文字列)。編みかけは null */
  finishedAt: string | null;
  /** お休みにした日(ISO文字列)。お休みでなければ null */
  pausedAt: string | null;
  /** 完成した作品をもらった子。編みかけは null */
  giftedTo: AnimalId | null;
  /** 小物やインテリアの作品を部屋に飾るときの絵。ほかの部門は null */
  interiorShape: InteriorShape | null;
  updatedAt: string;
}

export interface Settings {
  key: 'app';
  dataVersion: number;
  /** 「+N」に登録した数(一番上がボタンに出る) */
  quickAdds: number[];
  /** 音声入力で1カウントになる言葉 */
  voiceWords: string[];
  /** この端末で最後に書き出した日(ISO文字列)。まだなら null */
  lastExportedAt: string | null;
}

/** 動物ごとに1匹のパートナーの個体データ */
export interface PartnerData {
  animal: AnimalId;
  /** 一緒に編んだことがあるか(初めて編むときに出会う) */
  met: boolean;
  metAt: string | null;
  decoration: DecorationId;
  /** 体の色・目の色(null は素材のままの色) */
  bodyColor: string | null;
  eyeColor: string | null;
  /** 身につけている作品のID(部門ごとに1つずつ) */
  wearing: Partial<Record<WearDept, string>>;
  /** 名前(任意) */
  name: string;
  /** 今編んでいる作品(同じ子が2つの作品に入っているとき、どちらを編むか) */
  knittingWorkId: string | null;
}

export interface Photo {
  id: string;
  workId: string;
  /** 編み図 / 完成写真 */
  kind: 'pattern' | 'finished';
  order: number;
  /** 長辺を縮小した JPEG と、一覧用の小さい版 */
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
  createdAt: string;
}

/** 部屋(1件):色・鉢植えの花・飾っている作品 */
export interface RoomData {
  key: 'room';
  wall: string;
  floor: string;
  curtain: string;
  rug: string;
  yarn1: string;
  yarn2: string;
  flower: DecorationId;
  /** 飾っている作品のID(最大3つ。並び順 = 置き場所:床の右・ラグの左手前・窓辺) */
  displayed: string[];
}

interface FutariDB extends DBSchema {
  works: { key: string; value: Work };
  settings: { key: string; value: Settings };
  partners: { key: string; value: PartnerData };
  photos: { key: string; value: Photo; indexes: { byWork: string } };
  room: { key: string; value: RoomData };
}

const DB_NAME = 'futari-hitome';
const DB_SCHEMA_VERSION = 4;

export const DEFAULT_SETTINGS: Settings = {
  key: 'app',
  dataVersion: CURRENT_DATA_VERSION,
  quickAdds: [10],
  voiceWords: DEFAULT_VOICE_WORDS,
  lastExportedAt: null,
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
        if (oldVersion < 3) {
          const photos = database.createObjectStore('photos', { keyPath: 'id' });
          photos.createIndex('byWork', 'workId');
        }
        if (oldVersion < 4) {
          database.createObjectStore('room', { keyPath: 'key' });
        }
      },
    }).then(async (database) => {
      await migrate(database);
      return database;
    });
  }
  return dbPromise;
}

/** ID。crypto.randomUUID は https でないと使えないので、なければ代わりの作り方で */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await (await db()).get('settings', 'app')) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await db()).put('settings', settings);
}

// ---------- 作品 ----------

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

/** 新しい作品を一覧の一番上に入れ、その子の「今編んでいる作品」にする */
export async function addWork(work: Omit<Work, 'order'>): Promise<Work> {
  const works = await listWorks();
  const order = works.length ? works[0].order - 1 : 0;
  const saved = { ...work, order };
  await saveWork(saved);
  await setKnitting(saved.partner, saved.id);
  return saved;
}

/** 編みかけの作品の並びを、ids の順にする */
export async function reorderWorks(ids: string[]): Promise<void> {
  const tx = (await db()).transaction('works', 'readwrite');
  await Promise.all(
    ids.map(async (id, i) => {
      const w = await tx.store.get(id);
      if (w && w.order !== i) await tx.store.put({ ...w, order: i });
    }),
  );
  await tx.done;
}

/**
 * 完成にする。もらった子を記録し、その子の「今編んでいる作品」をほかの編みかけに移す。
 * その部門でまだ何も身につけていなければ身につけ、小物やインテリアは空いている置き場所に飾る
 */
export async function completeWork(id: string): Promise<Work | undefined> {
  const tx = (await db()).transaction(['works', 'partners', 'room'], 'readwrite');
  const works = tx.objectStore('works');
  const partners = tx.objectStore('partners');
  const rooms = tx.objectStore('room');
  const w = await works.get(id);
  if (!w) return undefined;
  const now = new Date().toISOString();
  const done: Work = { ...w, status: 'done', finishedAt: now, giftedTo: w.partner, updatedAt: now };
  await works.put(done);
  let p = wearOnComplete((await partners.get(w.partner)) ?? newPartner(w.partner), done);
  if (!p.knittingWorkId || p.knittingWorkId === id) {
    const rest = (await works.getAll()).filter((x) => x.id !== id);
    p = { ...p, knittingWorkId: pickKnitting(w.partner, rest) };
  }
  await partners.put(p);
  await rooms.put(displayOnComplete({ ...newRoom(), ...(await rooms.get('room')) }, done));
  await tx.done;
  return done;
}

/** 完成を取り消して編みかけに戻す(写真・感想・メモ・数は残す)。身につけていた・飾っていたら外す */
export async function reopenWork(id: string): Promise<Work | undefined> {
  const tx = (await db()).transaction(['works', 'partners', 'room'], 'readwrite');
  const works = tx.objectStore('works');
  const partners = tx.objectStore('partners');
  const rooms = tx.objectStore('room');
  const w = await works.get(id);
  if (!w) return undefined;
  const all = await works.getAll();
  const top = Math.min(0, ...all.filter((x) => x.status === 'wip').map((x) => x.order));
  const wip: Work = {
    ...w,
    status: 'wip',
    finishedAt: null,
    giftedTo: null,
    order: top - 1,
    updatedAt: new Date().toISOString(),
  };
  await works.put(wip);
  let p = unwear((await partners.get(w.partner)) ?? newPartner(w.partner), id);
  const current = all.find((x) => x.id === p.knittingWorkId);
  if (!current || current.status !== 'wip') p = { ...p, knittingWorkId: id };
  await partners.put(p);
  const room = await rooms.get('room');
  if (room) await rooms.put(undisplay(room, id));
  await tx.done;
  return wip;
}

/** お休みにする。その子の「今編んでいる作品」だったら、ほかの編みかけ(なければ「なし」)に移す */
export async function pauseWork(id: string): Promise<Work | undefined> {
  const tx = (await db()).transaction(['works', 'partners'], 'readwrite');
  const works = tx.objectStore('works');
  const partners = tx.objectStore('partners');
  const w = await works.get(id);
  if (!w || w.status !== 'wip') return undefined;
  const next = paused(w, new Date().toISOString());
  await works.put(next);
  const p = await partners.get(w.partner);
  if (p) await partners.put(releaseKnitting(p, id, await works.getAll()));
  await tx.done;
  return next;
}

/** 再開する:編みかけに戻して一覧の一番上へ。その子の「今編んでいる作品」がなければ、この作品にする */
export async function resumeWork(id: string): Promise<Work | undefined> {
  const tx = (await db()).transaction(['works', 'partners'], 'readwrite');
  const works = tx.objectStore('works');
  const partners = tx.objectStore('partners');
  const w = await works.get(id);
  if (!w || w.status !== 'paused') return undefined;
  const all = await works.getAll();
  const next = resumed(w, all);
  await works.put(next);
  await partners.put(knitOnResume((await partners.get(w.partner)) ?? newPartner(w.partner), id, all));
  await tx.done;
  return next;
}

/**
 * 作品を消す(編みかけ・お休み・完成どれでも)。その作品の写真もすべて消し、身につけていれば外し、
 * 飾っていればはずす。1つのまとまった保存なので、途中で失敗したら何も消えない
 */
export async function deleteWork(id: string): Promise<void> {
  const tx = (await db()).transaction(['works', 'photos', 'partners', 'room'], 'readwrite');
  const works = tx.objectStore('works');
  const photos = tx.objectStore('photos');
  const partners = tx.objectStore('partners');
  const rooms = tx.objectStore('room');
  const all = await works.getAll();
  await works.delete(id);
  for (const key of await photos.index('byWork').getAllKeys(id)) await photos.delete(key);
  for (const p of await partners.getAll()) {
    const next = partnerAfterDelete(p, id, all);
    if (next !== p) await partners.put(next);
  }
  const room = await rooms.get('room');
  if (room) await rooms.put(roomAfterDelete(room, id));
  await tx.done;
}

// ---------- パートナー ----------

export async function listPartners(): Promise<Record<AnimalId, PartnerData>> {
  const list = await (await db()).getAll('partners');
  const map = {} as Record<AnimalId, PartnerData>;
  for (const a of ANIMALS) map[a] = list.find((p) => p.animal === a) ?? newPartner(a);
  return map;
}

export async function getPartner(animal: AnimalId): Promise<PartnerData> {
  return (await (await db()).get('partners', animal)) ?? newPartner(animal);
}

export async function savePartner(p: PartnerData): Promise<void> {
  await (await db()).put('partners', p);
}

/** その子と初めて編むときに「出会う」 */
export async function meetPartner(animal: AnimalId): Promise<void> {
  const p = await getPartner(animal);
  if (p.met) return;
  await (await db()).put('partners', { ...p, met: true, metAt: new Date().toISOString() });
}

/** その子の「今編んでいる作品」を変える */
export async function setKnitting(animal: AnimalId, workId: string): Promise<PartnerData> {
  const p = { ...(await getPartner(animal)), knittingWorkId: workId };
  await (await db()).put('partners', p);
  return p;
}

// ---------- 写真 ----------

export async function listPhotos(workId: string, kind: Photo['kind']): Promise<Photo[]> {
  const all = await (await db()).getAllFromIndex('photos', 'byWork', workId);
  return all.filter((p) => p.kind === kind).sort((a, b) => a.order - b.order);
}

/** 作品ごとの1枚目の完成写真(アルバムの表紙) */
export async function coverPhotos(workIds: string[]): Promise<Record<string, Photo>> {
  const out: Record<string, Photo> = {};
  for (const id of workIds) {
    const [first] = await listPhotos(id, 'finished');
    if (first) out[id] = first;
  }
  return out;
}

export async function addPhoto(photo: Omit<Photo, 'order'>): Promise<Photo> {
  const now = await listPhotos(photo.workId, photo.kind);
  const saved = { ...photo, order: now.length ? now[now.length - 1].order + 1 : 0 };
  await (await db()).put('photos', saved);
  return saved;
}

export async function deletePhoto(id: string): Promise<void> {
  await (await db()).delete('photos', id);
}

/** 写真の並びを、ids の順にする */
export async function reorderPhotos(ids: string[]): Promise<void> {
  const tx = (await db()).transaction('photos', 'readwrite');
  await Promise.all(
    ids.map(async (id, i) => {
      const p = await tx.store.get(id);
      if (p && p.order !== i) await tx.store.put({ ...p, order: i });
    }),
  );
  await tx.done;
}

// ---------- 部屋 ----------

export async function getRoom(): Promise<RoomData> {
  return { ...newRoom(), ...(await (await db()).get('room', 'room')) };
}

export async function saveRoom(room: RoomData): Promise<void> {
  await (await db()).put('room', room);
}

// ---------- 書き出し・読み込み ----------

/** 5つの入れ物の中身すべて */
export interface Snapshot {
  settings: Settings;
  works: Work[];
  partners: PartnerData[];
  photos: Photo[];
  room: RoomData;
}

/** 書き出し用に、すべてを読み出す */
export async function readAll(): Promise<Snapshot> {
  const tx = (await db()).transaction(['settings', 'works', 'partners', 'photos', 'room'], 'readonly');
  const [settings, works, partners, photos, room] = await Promise.all([
    tx.objectStore('settings').get('app'),
    tx.objectStore('works').getAll(),
    tx.objectStore('partners').getAll(),
    tx.objectStore('photos').getAll(),
    tx.objectStore('room').get('room'),
  ]);
  await tx.done;
  return {
    settings: { ...DEFAULT_SETTINGS, ...settings },
    works,
    partners,
    photos,
    room: { ...newRoom(), ...room },
  };
}

/**
 * すべてを snap の中身に置き換える。1つのまとまった保存なので、途中で失敗したら何も変わらない。
 * 「最後に書き出した日」はこの端末のものを残す
 */
export async function replaceAll(snap: Snapshot): Promise<void> {
  const tx = (await db()).transaction(['settings', 'works', 'partners', 'photos', 'room'], 'readwrite');
  const settings = tx.objectStore('settings');
  const here = await settings.get('app');
  const stores = ['settings', 'works', 'partners', 'photos', 'room'] as const;
  try {
    await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
    await Promise.all([
      settings.put({
        ...snap.settings,
        dataVersion: CURRENT_DATA_VERSION,
        lastExportedAt: here?.lastExportedAt ?? null,
      }),
      ...snap.works.map((w) => tx.objectStore('works').put(w)),
      ...snap.partners.map((p) => tx.objectStore('partners').put(p)),
      ...snap.photos.map((p) => tx.objectStore('photos').put(p)),
      tx.objectStore('room').put(snap.room),
    ]);
  } catch (e) {
    // 途中で失敗したら全部取り消す(消した分も元に戻る)
    try {
      tx.abort();
    } catch {
      // すでに取り消されている
    }
    await tx.done.catch(() => {});
    throw e;
  }
  await tx.done;
}
