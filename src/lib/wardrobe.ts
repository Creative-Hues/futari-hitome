// 身につける・部屋に飾るの決め方(画面と切り離してテストする)
import type { DecorationId } from '../data/animals';
import { MAX_DISPLAY, WEAR_DEPTS, type WearDept } from '../data/wear';
import type { AnimalId, KnitTool, PartnerData, RoomData, Work } from './db';

type DoneWork = Pick<Work, 'id' | 'department' | 'status' | 'giftedTo' | 'finishedAt'>;

const newestFirst = (a: DoneWork, b: DoneWork) => ((a.finishedAt ?? '') < (b.finishedAt ?? '') ? 1 : -1);

/** その子がその部門で身につけられる作品(もらった完成作品。完成した日の新しい順) */
export function wearableWorks<T extends DoneWork>(animal: AnimalId, dept: WearDept, works: T[]): T[] {
  return works
    .filter((w) => w.status === 'done' && w.giftedTo === animal && w.department === dept)
    .sort(newestFirst);
}

/** 部屋に飾れる作品(小物やインテリアの完成作品。完成した日の新しい順) */
export function displayableWorks<T extends DoneWork>(works: T[]): T[] {
  return works.filter((w) => w.status === 'done' && w.department === 'interior').sort(newestFirst);
}

/** フェーズ3までのデータを直すとき:部門ごとに、完成した日がいちばん新しい作品を身につける */
export function initialWearing(animal: AnimalId, works: DoneWork[]): PartnerData['wearing'] {
  const out: PartnerData['wearing'] = {};
  for (const dept of WEAR_DEPTS) {
    const [first] = wearableWorks(animal, dept, works);
    if (first) out[dept] = first.id;
  }
  return out;
}

/** フェーズ3までのデータを直すとき:新しい順に3つまで飾る(いちばん新しい作品が1つ目=床の右) */
export function initialDisplay(works: DoneWork[]): string[] {
  return displayableWorks(works)
    .slice(0, MAX_DISPLAY)
    .map((w) => w.id);
}

/** 完成したとき:その部門でまだ何も身につけていなければ身につける */
export function wearOnComplete(p: PartnerData, w: Pick<Work, 'id' | 'department'>): PartnerData {
  if (w.department === 'interior' || p.wearing[w.department]) return p;
  return { ...p, wearing: { ...p.wearing, [w.department]: w.id } };
}

/** 完成したとき:小物やインテリアは、空いている置き場所に飾る */
export function displayOnComplete(room: RoomData, w: Pick<Work, 'id' | 'department'>): RoomData {
  if (w.department !== 'interior' || room.displayed.includes(w.id) || room.displayed.length >= MAX_DISPLAY) {
    return room;
  }
  return { ...room, displayed: room.displayed.concat(w.id) };
}

/** 編みかけに戻したとき:身につけていれば外す */
export function unwear(p: PartnerData, workId: string): PartnerData {
  const entries = Object.entries(p.wearing).filter(([, id]) => id !== workId);
  if (entries.length === Object.keys(p.wearing).length) return p;
  return { ...p, wearing: Object.fromEntries(entries) };
}

/** 編みかけに戻したとき:飾っていればはずす(あとの作品は前に詰める) */
export function undisplay(room: RoomData, workId: string): RoomData {
  if (!room.displayed.includes(workId)) return room;
  return { ...room, displayed: room.displayed.filter((id) => id !== workId) };
}

/** 身につけた作品の絵の材料(部門と色) */
export interface WornItem {
  dept: WearDept;
  color: string;
}

/** パートナーの見た目(頭飾り・体の色・目の色・身につけているもの・手に持つ道具) */
export interface Look {
  decoration: DecorationId;
  bodyColor: string | null;
  eyeColor: string | null;
  wear: WornItem[];
  /** 今編んでいる作品の編み方(なければ棒針)。新しい絵の手の道具に使う */
  tool: KnitTool;
}

/** 個体データと作品から、今の見た目を作る(なくなった作品・完成でなくなった作品は外して考える) */
export function lookOf(
  p: PartnerData,
  works: (Pick<Work, 'id' | 'department' | 'status' | 'giftedTo' | 'color'> & { tool?: KnitTool })[],
): Look {
  const byId = new Map(works.map((w) => [w.id, w]));
  const wear: WornItem[] = [];
  for (const dept of WEAR_DEPTS) {
    const w = byId.get(p.wearing[dept] ?? '');
    if (w && w.status === 'done' && w.giftedTo === p.animal && w.department === dept) {
      wear.push({ dept, color: w.color });
    }
  }
  const knitting = byId.get(p.knittingWorkId ?? '');
  const tool = (knitting?.status === 'wip' && knitting.tool) || 'knit';
  return { decoration: p.decoration, bodyColor: p.bodyColor, eyeColor: p.eyeColor, wear, tool };
}
