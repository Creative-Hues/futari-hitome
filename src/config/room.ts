// 部屋の模様替えと、パートナーの体・目の色の設定。色の候補や濃くする割合はここを変える。
import palettes from '../../assets/backgrounds/room_palettes.json';
import type { DecorationId } from '../data/animals';

export type RoomPart = 'wall' | 'floor' | 'curtain' | 'rug' | 'yarn1' | 'yarn2';
export const ROOM_PARTS: { id: RoomPart; name: string }[] = [
  { id: 'wall', name: '壁' },
  { id: 'floor', name: '床' },
  { id: 'curtain', name: 'カーテン' },
  { id: 'rug', name: 'ラグ' },
  { id: 'yarn1', name: '毛糸玉1' },
  { id: 'yarn2', name: '毛糸玉2' },
];

export interface RoomPalette extends Record<RoomPart, string> {
  name: string;
  flower: DecorationId;
}

/** おすすめの色の組み合わせ(assets/backgrounds/room_palettes.json) */
export const ROOM_PALETTES = palettes as RoomPalette[];

const YARN = ['#5aa3df', '#f2a6b4', '#f6c94a', '#ffffff', '#9fc4f3', '#f9a03f', '#7cc768', '#e8505c', '#a99ad6', '#c9a46a'];

/** 部品ごとの色の候補(おすすめ4通りの色を含む)。最後に「自由に選ぶ」が付く */
export const ROOM_SWATCHES: Record<RoomPart, string[]> = {
  wall: ['#f8efe3', '#eef6ef', '#f3eef8', '#eef5fb', '#fdf0f2', '#fbf6e2', '#f1ebe4', '#e8eef0', '#fffaf3', '#e9e4dc'],
  floor: ['#e3c39d', '#d9c6a8', '#cfc3d8', '#e8dccb', '#c9a77e', '#b88e66', '#e6d3b8', '#d8d2cc', '#c9d6c4', '#ead1c1'],
  curtain: ['#f6c3cf', '#a9dcc4', '#c9b6e8', '#a3c6f4', '#f9d98a', '#f6b99a', '#ffffff', '#d9d2c8', '#b7d98f', '#e8a1a1'],
  rug: ['#f2a6b4', '#8fcfb0', '#b49ddf', '#f9c97a', '#9fc4f3', '#f4b183', '#d9cbb8', '#c7e3a1', '#e8505c', '#a99ad6'],
  yarn1: YARN,
  yarn2: YARN,
};

/**
 * 影や境目の色:選んだ色の赤・緑・青をこの倍率にする(素材の見本「はじめの部屋」と同じ色になる値)
 * 壁の影(腰のライン)・床の境目・毛糸玉の線
 */
export const ROOM_SHADE = { wall: 0.96, floor: 0.86, yarn: 0.85 };

/** 鉢植えの花にできる頭飾り(花と葉っぱ) */
export const POT_FLOWERS: DecorationId[] = ['tulip', 'cosmos', 'hydrangea', 'sakura', 'daisy', 'sprout', 'clover'];

/** 作品の色から、編み目の線の色を作る倍率(約15%暗く) */
export const ITEM_SHADE = 0.85;

/**
 * パートナーの体の色(null はもとの色)。選んだ色から、明るい色 → 影の色のグラデーションと編み目の線を作る。
 * 新しい絵(PNG)でも同じ候補を使い、白く描いた体にこの色を掛け合わせる
 */
export const BODY_COLORS: { value: string | null; name: string }[] = [
  { value: null, name: 'もとの色' },
  { value: '#f7dc9c', name: 'クリーム' },
  { value: '#f5b3c2', name: 'さくら' },
  { value: '#a6dcc0', name: 'ミント' },
  { value: '#a9cdf2', name: 'そら' },
  { value: '#c7b5ea', name: 'ラベンダー' },
  { value: '#d9b994', name: 'ミルクティー' },
  { value: '#b9b4c2', name: 'グレー' },
];

/** 修正2より前の体の色(うすすぎた色)→ 同じ名前の今の色。データを直すときに使う */
export const OLD_BODY_COLORS: Record<string, string> = {
  '#fbefd5': '#f7dc9c',
  '#fbe2e8': '#f5b3c2',
  '#e0f3e6': '#a6dcc0',
  '#dfedfa': '#a9cdf2',
  '#ece4f7': '#c7b5ea',
  '#eee0cf': '#d9b994',
  '#e5e2ea': '#b9b4c2',
};

/** 体の色のグラデーションと線の作り方 */
export const BODY_TONE = {
  /** いちばん明るいところ:選んだ色に白を混ぜる割合 */
  light: 0.45,
  /** 影のところの倍率 */
  shadow: 0.84,
  /** 編み目の線の倍率 */
  stitch: 0.8,
  /** ねこ・オコジョのしっぽの白い線:選んだ色に白を混ぜる割合 */
  tail: 0.25,
};

/** 目の色(null はもとの色)。ひつじは目が白い点なので別の候補 */
export const EYE_COLORS: { value: string | null; name: string }[] = [
  { value: null, name: 'くろ(もとの色)' },
  { value: '#5a3a2a', name: 'こげちゃ' },
  { value: '#2f6aa3', name: 'あお' },
  { value: '#3f7d4f', name: 'みどり' },
  { value: '#5b3f8a', name: 'むらさき' },
];

export const SHEEP_EYE_COLORS: { value: string | null; name: string }[] = [
  { value: null, name: 'しろ(もとの色)' },
  { value: '#f6d36b', name: 'きいろ' },
  { value: '#9fd3f5', name: 'みずいろ' },
  { value: '#f7c1cc', name: 'ピンク' },
];
