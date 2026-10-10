// データの書き出し・読み込み。5つの入れ物を1つの JSON にまとめる(写真は文字 base64 にして入れる)。
// 読み込みは、今のデータに触らずにメモリの中で確かめて今の形に直すところまでをここでやる。
import { ANIMALS } from '../data/animals';
import { DEPARTMENTS } from '../data/departments';
import { DEFAULT_SETTINGS, type Photo, type Snapshot } from './db';
import { CURRENT_DATA_VERSION, newPartner, newRoom, runSteps, type AnyDB } from './migrate';

/** ふたりひとめのファイルの目印 */
export const APP_ID = 'futari-hitome';
/** ファイルの形の番号(中のデータの番号 dataVersion とは別) */
export const FILE_VERSION = 1;

export const REASONS = {
  notJson: 'このファイルは読み込めません。ふたりひとめで書き出したファイル(.json)を選んでください',
  notOurs: 'ふたりひとめのデータではないようです',
  tooNew: '新しい版のアプリで書き出したファイルです。アプリを開き直して最新にしてから、もう一度読み込んでください',
  broken: (what: string) => `ファイルの一部が壊れているため読み込めません(${what}が読めません)`,
};

/** futari-hitome-2026-10-11.json(端末の時計の日付) */
export function exportFileName(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${APP_ID}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

// ---------- 書き出し ----------

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

/**
 * ファイルの部品の配列。大きな1つの文字列にはつなげず、new Blob(部品) / new File(部品) でファイルにする
 * (写真が多くても iPhone のメモリが足りなくならないように)。写真の画像の文字は1枚ずつ別の部品
 */
export async function backupParts(snap: Snapshot, exportedAt: string): Promise<string[]> {
  const head = JSON.stringify({
    app: APP_ID,
    fileVersion: FILE_VERSION,
    dataVersion: CURRENT_DATA_VERSION,
    exportedAt,
    settings: snap.settings,
    works: snap.works,
    partners: snap.partners,
    room: snap.room,
  });
  const parts = [head.slice(0, -1), ',"photos":['];
  for (const [i, p] of snap.photos.entries()) {
    const { blob, thumb, ...meta } = p;
    parts.push(`${i ? ',' : ''}${JSON.stringify(meta).slice(0, -1)},"blob":"data:${blob.type || 'image/jpeg'};base64,`);
    parts.push(await blobToBase64(blob));
    parts.push(`","thumb":"data:${thumb.type || 'image/jpeg'};base64,`);
    parts.push(await blobToBase64(thumb));
    parts.push('"}');
  }
  parts.push(']}');
  return parts;
}

// ---------- 読み込み ----------

export interface BackupSummary {
  exportedAt: string | null;
  wip: number;
  done: number;
  photos: number;
  met: number;
}

export type ParseResult = { ok: true; snapshot: Snapshot; summary: BackupSummary } | { ok: false; reason: string };

class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const DEPT_IDS: string[] = DEPARTMENTS.map((d) => d.id);
const ANIMAL_IDS: string[] = ANIMALS;

function dataUrlToBlob(v: unknown): Blob | null {
  if (!isStr(v)) return null;
  const m = /^data:([\w.+-]+\/[\w.+-]+);base64,/.exec(v);
  if (!m) return null;
  try {
    const bin = atob(v.slice(m[0].length));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] });
  } catch {
    return null;
  }
}

function checkWork(w: unknown) {
  if (
    !isObj(w) ||
    !isStr(w.id) ||
    !w.id ||
    !isStr(w.name) ||
    !DEPT_IDS.includes(w.department) ||
    !ANIMAL_IDS.includes(w.partner) ||
    (w.status !== 'wip' && w.status !== 'done') ||
    !isObj(w.count) ||
    !isCount(w.count.row) ||
    !isCount(w.count.stitch)
  ) {
    throw new BackupError(REASONS.broken('作品'));
  }
}

/** ファイルの中身を、メモリの中で IndexedDB と同じ get / getAll / put が使える入れ物に見せかける(STEPS をそのまま動かすため) */
function memoryDb(): { db: AnyDB; stores: Record<string, Map<string, any>> } {
  const keys: Record<string, string> = { settings: 'key', works: 'id', partners: 'animal', photos: 'id', room: 'key' };
  const stores: Record<string, Map<string, any>> = {};
  for (const s of Object.keys(keys)) stores[s] = new Map();
  const db = {
    get: async (s: string, k: string) => stores[s].get(k),
    getAll: async (s: string) => [...stores[s].values()],
    put: async (s: string, v: any) => {
      stores[s].set(v[keys[s]], v);
      return v[keys[s]];
    },
  } as unknown as AnyDB;
  return { db, stores };
}

/** ファイルの文字を確かめ、今の形に直す。今のデータには触らない */
export async function parseBackup(text: string): Promise<ParseResult> {
  try {
    return { ok: true, ...(await parse(text)) };
  } catch (e) {
    if (e instanceof BackupError) return { ok: false, reason: e.message };
    return { ok: false, reason: REASONS.broken('データ') };
  }
}

async function parse(text: string): Promise<{ snapshot: Snapshot; summary: BackupSummary }> {
  let file: unknown;
  try {
    file = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new BackupError(REASONS.notJson);
  }
  if (!isObj(file) || file.app !== APP_ID) throw new BackupError(REASONS.notOurs);

  const { fileVersion, dataVersion } = file;
  if (!Number.isInteger(fileVersion) || fileVersion < 1) throw new BackupError(REASONS.notOurs);
  if (!Number.isInteger(dataVersion) || dataVersion < 1) throw new BackupError(REASONS.notOurs);
  if (fileVersion > FILE_VERSION || dataVersion > CURRENT_DATA_VERSION) throw new BackupError(REASONS.tooNew);

  // そのバージョンのデータにあるはずの入れ物(パートナーは2から、写真は3から、部屋は4から)
  if (!isObj(file.settings) || !Array.isArray(file.works)) throw new BackupError(REASONS.notOurs);
  if (dataVersion >= 2 && !Array.isArray(file.partners)) throw new BackupError(REASONS.notOurs);
  if (dataVersion >= 3 && !Array.isArray(file.photos)) throw new BackupError(REASONS.notOurs);
  if (dataVersion >= 4 && !isObj(file.room)) throw new BackupError(REASONS.notOurs);

  // アプリが動くのに必要なところだけ確かめる(知らない項目はそのまま残す)
  const works: any[] = file.works;
  works.forEach(checkWork);
  const workIds = new Set(works.map((w) => w.id));
  if (workIds.size !== works.length) throw new BackupError(REASONS.broken('作品'));
  const partners: any[] = file.partners ?? [];
  if (!partners.every((p) => isObj(p) && ANIMAL_IDS.includes(p.animal))) {
    throw new BackupError(REASONS.broken('なかま'));
  }

  // 写真:画像を戻す。どの作品のものでもない写真は飛ばす
  const photos: Photo[] = [];
  for (const p of (file.photos ?? []) as unknown[]) {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.workId) || (p.kind !== 'pattern' && p.kind !== 'finished')) {
      throw new BackupError(REASONS.broken('写真'));
    }
    const blob = dataUrlToBlob(p.blob);
    const thumb = dataUrlToBlob(p.thumb);
    if (!blob || !thumb) throw new BackupError(REASONS.broken('写真'));
    if (workIds.has(p.workId)) photos.push({ ...(p as Photo), blob, thumb });
  }

  // 古いバージョンなら、端末のデータを直すときと同じ直し方(STEPS)で今の形にする
  const { db, stores } = memoryDb();
  stores.settings.set('app', { ...file.settings, key: 'app', dataVersion });
  for (const w of works) stores.works.set(w.id, w);
  for (const p of partners) stores.partners.set(p.animal, p);
  if (isObj(file.room)) stores.room.set('room', { ...file.room, key: 'room' });
  try {
    await runSteps(db, dataVersion);
  } catch {
    throw new BackupError(REASONS.broken('データ'));
  }

  const s = stores.settings.get('app');
  const settings = {
    ...DEFAULT_SETTINGS,
    ...s,
    key: 'app' as const,
    dataVersion: CURRENT_DATA_VERSION,
    quickAdds: Array.isArray(s.quickAdds) && s.quickAdds.every(isCount) && s.quickAdds.length ? s.quickAdds : DEFAULT_SETTINGS.quickAdds,
    voiceWords:
      Array.isArray(s.voiceWords) && s.voiceWords.every(isStr) && s.voiceWords.length ? s.voiceWords : DEFAULT_SETTINGS.voiceWords,
  };
  const room = { ...newRoom(), ...stores.room.get('room'), key: 'room' as const };
  if (!Array.isArray(room.displayed)) room.displayed = [];
  const snapshot: Snapshot = {
    settings,
    works: [...stores.works.values()],
    partners: ANIMALS.map((a) => stores.partners.get(a) ?? newPartner(a)),
    photos,
    room,
  };

  return {
    snapshot,
    summary: {
      exportedAt: isStr(file.exportedAt) ? file.exportedAt : null,
      wip: snapshot.works.filter((w) => w.status === 'wip').length,
      done: snapshot.works.filter((w) => w.status === 'done').length,
      photos: photos.length,
      met: snapshot.partners.filter((p) => p.met).length,
    },
  };
}
