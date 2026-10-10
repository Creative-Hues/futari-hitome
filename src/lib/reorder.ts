// ドラッグ並び替えの計算(画面と切り離してテストする)

/** from 番目の項目を to 番目に動かした新しい並び */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

type Rect = { left: number; top: number; right: number; bottom: number };

/** 指の位置にある項目の番号。どれにも重なっていなければ -1 */
export function indexAt(rects: Rect[], x: number, y: number): number {
  return rects.findIndex((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
}
