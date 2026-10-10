// 編んだ時間の目安。編む画面で数が変わるたびに、前に変わったときから間があいていなければその間を足す。
import { KNIT_GAP_MS } from '../config/tuning';

export function addKnitTime(
  knitMs: number,
  lastAt: number | null,
  now: number,
  gap = KNIT_GAP_MS,
): { knitMs: number; lastAt: number } {
  const d = lastAt === null ? -1 : now - lastAt;
  return { knitMs: d >= 0 && d <= gap ? knitMs + d : knitMs, lastAt: now };
}

/** 「約 3時間20分」。10分きざみ(10分未満は「10分未満」) */
export function formatKnitTime(ms: number): string {
  const min = Math.round(ms / 60000 / 10) * 10;
  if (ms <= 0) return '記録なし';
  if (min < 10) return '10分未満';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `約 ${h ? `${h}時間` : ''}${m ? `${m}分` : ''}`;
}

/** 始めた日から完成した日までの日数(同じ日なら1日)。端末の日付で数える */
export function daysBetween(startIso: string, endIso: string): number {
  const day = (iso: string) => {
    const d = new Date(iso);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.max(1, Math.round((day(endIso) - day(startIso)) / 86400000) + 1);
}

/** 「2026年10月10日」 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
