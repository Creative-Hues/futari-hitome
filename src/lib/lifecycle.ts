// 作品をお休みにする・再開する・消すときの、作品・パートナー・部屋の直し方。画面とは切り離して、ここだけでテストする。
import type { PartnerData, RoomData, Work } from './db';
import { pickKnitting } from './migrate';
import { undisplay, unwear } from './wardrobe';

type Listed = Pick<Work, 'id' | 'partner' | 'status' | 'updatedAt' | 'order'>;

/** その作品がその子の「今編んでいる作品」なら、その子のほかの編みかけ(最後に数えたもの)に移す。なければ「なし」 */
export function releaseKnitting(p: PartnerData, workId: string, works: Listed[]): PartnerData {
  if (p.knittingWorkId !== workId) return p;
  return { ...p, knittingWorkId: pickKnitting(p.animal, works.filter((w) => w.id !== workId)) };
}

/** お休みにする。数・模様・メモ・取り消しの履歴・数えた時刻は変えない */
export function paused<T extends Work>(w: T, now: string): T {
  return { ...w, status: 'paused', pausedAt: now };
}

/** 再開する:編みかけに戻し、ホームの一覧の一番上に入れる */
export function resumed<T extends Work>(w: T, works: Listed[]): T {
  const top = Math.min(0, ...works.filter((x) => x.status === 'wip').map((x) => x.order));
  return { ...w, status: 'wip', pausedAt: null, order: top - 1 };
}

/** 再開したとき:その子の「今編んでいる作品」がなければ(編みかけでなければ)、この作品にする */
export function knitOnResume(p: PartnerData, workId: string, works: Listed[]): PartnerData {
  const current = works.find((w) => w.id === p.knittingWorkId);
  if (current && current.status === 'wip' && current.id !== workId) return p;
  return { ...p, knittingWorkId: workId };
}

/** 消したとき:身につけていれば外し、今編んでいる作品ならほかへ移す */
export function partnerAfterDelete(p: PartnerData, workId: string, works: Listed[]): PartnerData {
  return releaseKnitting(unwear(p, workId), workId, works);
}

/** 消したとき:飾っていればはずす(あとの作品は前に詰める) */
export function roomAfterDelete(room: RoomData, workId: string): RoomData {
  return undisplay(room, workId);
}

/** お休み中の作品:お休みにした日の新しい順 */
export function pausedWorks<T extends Pick<Work, 'status' | 'pausedAt'>>(works: T[]): T[] {
  return works
    .filter((w) => w.status === 'paused')
    .sort((a, b) => ((a.pausedAt ?? '') < (b.pausedAt ?? '') ? 1 : -1));
}
