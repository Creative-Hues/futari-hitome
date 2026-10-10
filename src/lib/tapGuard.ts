// どこでもタップの誤タッチ防止。
// ・触れている間に指が MAX_POINTERS 本を超えたタッチは数えない(全部の指が離れるまで)
// ・前に数えてから TAP_MERGE_MS 以内のタッチは同じ1回とみなす
// 2本目の指が触れる前に1本目を数えてしまわないよう、指が全部離れた時点で数える。
import { MAX_POINTERS, TAP_MERGE_MS } from '../config/tuning';

export class TapGuard {
  private active = new Set<number>();
  private spoiled = false;
  private lastCountAt = -Infinity;

  constructor(
    private maxPointers = MAX_POINTERS,
    private mergeMs = TAP_MERGE_MS,
  ) {}

  /** 指が触れた */
  down(pointerId: number): void {
    this.active.add(pointerId);
    if (this.active.size > this.maxPointers) this.spoiled = true;
  }

  /** 指が離れた。数えてよいときは true */
  up(pointerId: number, time: number): boolean {
    if (!this.active.delete(pointerId)) return false;
    if (this.active.size > 0) return false;
    const spoiled = this.spoiled;
    this.spoiled = false;
    if (spoiled) return false;
    if (time - this.lastCountAt < this.mergeMs) return false;
    this.lastCountAt = time;
    return true;
  }

  /** タッチが取り消された(スクロールなど)。このタッチは数えない */
  cancel(pointerId: number): void {
    if (!this.active.delete(pointerId)) return;
    this.spoiled = true;
    if (this.active.size === 0) this.spoiled = false;
  }
}
