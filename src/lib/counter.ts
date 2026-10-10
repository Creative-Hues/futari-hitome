// カウントの計算。画面とは切り離して、ここだけでテストできるようにしている。
import { UNDO_LIMIT } from '../config/tuning';

export interface Count {
  /** 編み終えた段の数 */
  row: number;
  /** 今の段で編んだ目の数(1段の目数がない作品では常に0) */
  stitch: number;
}

/**
 * n 目(1段の目数がない作品では n 段)進める。マイナスなら戻す。
 * 1段の目数がある作品は、目数が満ちると段が1つ進む。0より下には戻らない。
 */
export function add(count: Count, n: number, stitchesPerRow: number | null): Count {
  if (!stitchesPerRow) {
    return { row: Math.max(0, count.row + n), stitch: 0 };
  }
  const total = Math.max(0, count.row * stitchesPerRow + count.stitch + n);
  return { row: Math.floor(total / stitchesPerRow), stitch: total % stitchesPerRow };
}

/** 指定した目数・段数をほどく */
export function unravel(
  count: Count,
  unit: 'stitch' | 'row',
  n: number,
  stitchesPerRow: number | null,
): Count {
  if (unit === 'row' && stitchesPerRow) return add(count, -n * stitchesPerRow, stitchesPerRow);
  return add(count, -n, stitchesPerRow);
}

/** 取り消し用の履歴に、操作前の状態を積む(古いものから捨てる) */
export function pushHistory(history: Count[], before: Count, limit = UNDO_LIMIT): Count[] {
  const next = history.concat([{ row: before.row, stitch: before.stitch }]);
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** 直前の操作を1つ戻す。戻せるものがなければ null */
export function undo(history: Count[]): { count: Count; history: Count[] } | null {
  if (history.length === 0) return null;
  return { count: history[history.length - 1], history: history.slice(0, -1) };
}

/** 目標に対する進み具合(0〜1)。目標がなければ null */
export function progress(
  count: Count,
  goalRows: number | null,
  stitchesPerRow: number | null,
): number | null {
  if (!goalRows) return null;
  const done = stitchesPerRow ? count.row + count.stitch / stitchesPerRow : count.row;
  return Math.min(1, done / goalRows);
}

/** 「今このくらい」の進行度(0〜100%)を5%きざみにそろえる */
export function snapProgress(percent: number, step = 5): number {
  return Math.min(100, Math.max(0, Math.round(percent / step) * step));
}

/** パートナーの編み地の進み具合(0〜1)。目標があれば達成率、なければ「今このくらい」 */
export function workProgress(w: {
  count: Count;
  goalRows: number | null;
  stitchesPerRow: number | null;
  manualProgress?: number;
}): number {
  return progress(w.count, w.goalRows, w.stitchesPerRow) ?? (w.manualProgress ?? 0) / 100;
}
