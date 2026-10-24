// パーツ(手袋の指・右手と左手など、1つの作品の中で1段目に戻って編む部分)。画面とは切り離して、ここだけでテストする。
// パーツを作らない作品も、中ではパーツ1つの作品として持つ。
import { progress, type Count } from './counter';
import type { Pattern } from './pattern';

/** 取り消し用に残す、操作前の状態(模様の回数も一緒に戻す) */
export type HistoryEntry = Count & { repeat?: number };

export interface Part {
  id: string;
  /** まとまりの名前(例:右手)。まとまりなしは空 */
  group: string;
  /** パーツの名前(例:親指)。パーツなしの作品の1つだけのパーツは空 */
  name: string;
  /** 目標の段数。目標なしは null */
  goalRows: number | null;
  /** 1段の目数。入れていなければ null(段だけ数える) */
  stitchesPerRow: number | null;
  count: Count;
  /** 目標なしのパーツの「今このくらい」(0〜100%) */
  manualProgress: number;
  /** 取り消し用:操作前の状態(直近50件) */
  history: HistoryEntry[];
  /** 模様の回数(2つ目のカウンター)。使っていなければ null */
  pattern: Pattern | null;
  /** 編んだ時間の目安(ミリ秒) */
  knitMs: number;
}

type HasParts = { parts: Part[]; currentPartId: string };

/** パーツの ID(作品の中で重ならなければよい) */
export function partId(): string {
  return `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newPart(fields: Partial<Part> = {}): Part {
  return {
    id: partId(),
    group: '',
    name: '',
    goalRows: null,
    stitchesPerRow: null,
    count: { row: 0, stitch: 0 },
    manualProgress: 0,
    history: [],
    pattern: null,
    knitMs: 0,
    ...fields,
  };
}

/** 今編んでいるパーツ(見つからなければ1つ目) */
export function currentPart(w: HasParts): Part {
  return w.parts.find((p) => p.id === w.currentPartId) ?? w.parts[0];
}

/** パーツが2つ以上あるか(1つなら、画面にはパーツの表示を出さない) */
export function hasParts(w: { parts: Part[] }): boolean {
  return w.parts.length >= 2;
}

/** 「右手・親指」。まとまりがなければ名前だけ */
export function partLabel(p: Pick<Part, 'group' | 'name'>): string {
  return [p.group.trim(), p.name.trim()].filter(Boolean).join('・') || 'パーツ';
}

/** パーツの進み具合(0〜1)。目標があれば達成率、なければ「今このくらい」 */
export function partProgress(p: Pick<Part, 'count' | 'goalRows' | 'stitchesPerRow' | 'manualProgress'>): number {
  return progress(p.count, p.goalRows, p.stitchesPerRow) ?? p.manualProgress / 100;
}

/** 目標に届いたか(目標なしは「だいたい 100%」) */
export function partReached(p: Part): boolean {
  return partProgress(p) >= 1;
}

/**
 * 作品全体の進み具合(0〜1)。各パーツの進み具合を、目標の段数の重みで平均する。
 * 目標なしのパーツは、目標ありのパーツの平均の段数ぶんとして数える(全部目標なしなら、そのまま平均)
 */
export function overallProgress(w: { parts: Part[] }): number {
  const goals = w.parts.map((p) => p.goalRows).filter((g): g is number => !!g);
  const fallback = goals.length ? goals.reduce((a, b) => a + b, 0) / goals.length : 1;
  let sum = 0;
  let weight = 0;
  for (const p of w.parts) {
    const k = p.goalRows || fallback;
    sum += k * partProgress(p);
    weight += k;
  }
  return weight ? sum / weight : 0;
}

/** 全パーツの編んだ時間の合計 */
export function totalKnitMs(w: { parts: Part[] }): number {
  return w.parts.reduce((a, p) => a + p.knitMs, 0);
}

/** 次のパーツの ID。最後のパーツなら null */
export function nextPartId(w: HasParts): string | null {
  const i = w.parts.findIndex((p) => p.id === currentPart(w).id);
  return w.parts[i + 1]?.id ?? null;
}

/** 1つのパーツを直す */
export function updatePart<T extends HasParts>(w: T, id: string, patch: Partial<Part>): T {
  return { ...w, parts: w.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

// ---------- まとまり ----------

export interface PartGroup {
  group: string;
  parts: Part[];
}

/** まとまりごとに分ける(並びは、そのまとまりのパーツが最初に出てくる順) */
export function groupParts(parts: Part[]): PartGroup[] {
  const out: PartGroup[] = [];
  for (const p of parts) {
    const g = out.find((x) => x.group === p.group);
    if (g) g.parts.push(p);
    else out.push({ group: p.group, parts: [p] });
  }
  return out;
}

/** まとまりの並びを1列に戻す(同じまとまりのパーツは必ず続けて並ぶ) */
export function flattenGroups(groups: PartGroup[]): Part[] {
  return groups.flatMap((g) => g.parts);
}

/** 名前の「右」と「左」を入れ替える。どちらもなければ「○○ 2」 */
export function mirrorName(name: string): string {
  if (/[右左]/.test(name)) return name.replace(/[右左]/g, (c) => (c === '右' ? '左' : '右'));
  return name.trim() ? `${name.trim()} 2` : '';
}

/** 複製:目標と模様の設定は同じ、数・履歴・模様の回数・編んだ時間は0から */
export function copyPart(p: Part, fields: Partial<Part>): Part {
  return newPart({
    group: p.group,
    name: p.name,
    goalRows: p.goalRows,
    stitchesPerRow: p.stitchesPerRow,
    pattern: p.pattern && { ...p.pattern, count: 0, baseRow: 0 },
    ...fields,
  });
}

/** まとまりの中のパーツを1つ足す(まとまりの最後に入る。新しいまとまりなら一番最後) */
export function addPart(parts: Part[], part: Part): Part[] {
  const groups = groupParts(parts);
  const g = groups.find((x) => x.group === part.group);
  if (g) g.parts.push(part);
  else groups.push({ group: part.group, parts: [part] });
  return flattenGroups(groups);
}

/** パーツ1つを複製して、すぐ後ろに入れる */
export function duplicatePart(parts: Part[], id: string, name: string): Part[] {
  const i = parts.findIndex((p) => p.id === id);
  if (i < 0) return parts;
  const copy = copyPart(parts[i], { name });
  return [...parts.slice(0, i + 1), copy, ...parts.slice(i + 1)];
}

/** まとまりごと複製して、そのまとまりのすぐ後ろに新しいまとまりとして入れる */
export function duplicateGroup(parts: Part[], group: string, newGroup: string): Part[] {
  const groups = groupParts(parts);
  const i = groups.findIndex((g) => g.group === group);
  if (i < 0) return parts;
  const copy: PartGroup = { group: newGroup, parts: groups[i].parts.map((p) => copyPart(p, { group: newGroup })) };
  // 同じ名前のまとまりがすでにあれば、その後ろに足す
  const same = groups.find((g) => g.group === newGroup);
  if (same) same.parts.push(...copy.parts);
  else groups.splice(i + 1, 0, copy);
  return flattenGroups(groups);
}

/** パーツを直す。まとまりを変えたら、新しいまとまりの最後へ移す */
export function editPart(parts: Part[], id: string, patch: Partial<Part>): Part[] {
  const old = parts.find((p) => p.id === id);
  if (!old) return parts;
  const next = { ...old, ...patch };
  if (patch.group === undefined || patch.group === old.group) return parts.map((p) => (p.id === id ? next : p));
  return addPart(
    parts.filter((p) => p.id !== id),
    next,
  );
}

/** パーツを消す(最後の1つは消せない)。今のパーツを消したら、その前(なければ次)のパーツにする */
export function removePart<T extends HasParts>(w: T, id: string): T {
  if (w.parts.length <= 1) return w;
  const i = w.parts.findIndex((p) => p.id === id);
  if (i < 0) return w;
  const parts = w.parts.filter((p) => p.id !== id);
  const currentPartId = w.currentPartId === id ? (parts[i - 1] ?? parts[i] ?? parts[0]).id : w.currentPartId;
  return { ...w, parts, currentPartId };
}

/** パーツなしの作品を、パーツに分けるとき:1つだけのパーツに名前を付ける */
export function nameFirstPart(parts: Part[], group: string, name: string): Part[] {
  return parts.map((p, i) => (i === 0 ? { ...p, group, name } : p));
}

/** 作品カードの数:「42/80段」。パーツがあれば今のパーツ(「親指 12/20段」) */
export function amountText(w: HasParts): string {
  const p = currentPart(w);
  const rows = p.goalRows ? `${p.count.row}/${p.goalRows}段` : `${p.count.row}段`;
  return hasParts(w) ? `${p.name.trim() || partLabel(p)} ${rows}` : rows;
}
