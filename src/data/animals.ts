// 6匹と頭飾り10種類の素材(assets/ のSVGを文字として読み込む。中身は変えない)
import anchors from '../../assets/animals/anchors.json';
import type { AnimalId } from '../lib/db';

export const ANIMALS: AnimalId[] = ['sheep', 'cat', 'stoat', 'axolotl', 'seal', 'otter'];

export const ANIMAL_NAMES: Record<AnimalId, string> = {
  sheep: 'ひつじ',
  cat: 'ねこ',
  stoat: 'オコジョ',
  axolotl: 'ウーパールーパー',
  seal: 'アザラシ',
  otter: 'ラッコ',
};

export type DecorationId =
  | 'tulip'
  | 'cosmos'
  | 'hydrangea'
  | 'sakura'
  | 'daisy'
  | 'sprout'
  | 'clover'
  | 'seaweed'
  | 'coral'
  | 'shell';

const animalFiles = import.meta.glob('../../assets/animals/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const decorationFiles = import.meta.glob('../../assets/decorations/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function animalSvg(animal: AnimalId): string {
  return animalFiles[`../../assets/animals/${animal}.svg`];
}

export function decorationSvg(id: DecorationId): string {
  return decorationFiles[`../../assets/decorations/${id}.svg`];
}

/** 頭飾りをつける位置(どうぶつの絵の中の座標) */
export function decorationAnchor(animal: AnimalId): { x: number; y: number } {
  return anchors.anchors[animal];
}

export const DECORATION_SCALE = anchors.decorationScale;

/** その子の最初の頭飾り */
export function defaultDecoration(animal: AnimalId): DecorationId {
  return anchors.defaultDecoration[animal] as DecorationId;
}

export const DECORATION_NAMES: Record<DecorationId, string> = {
  tulip: 'チューリップ',
  cosmos: 'コスモス',
  hydrangea: 'アジサイ',
  sakura: 'サクラ',
  daisy: 'デイジー',
  sprout: '新芽',
  clover: 'クローバー',
  seaweed: '水草',
  coral: 'サンゴ',
  shell: '貝殻',
};

/** 頭飾りを選ぶ画面の分け方 */
export const DECORATION_GROUPS: { name: string; items: DecorationId[] }[] = [
  { name: '花', items: ['tulip', 'cosmos', 'hydrangea', 'sakura', 'daisy'] },
  { name: '葉っぱ', items: ['sprout', 'clover'] },
  { name: '海', items: ['seaweed', 'coral', 'shell'] },
];

/** パートナーの呼び名:名前があれば名前、なければ動物名 */
export function partnerName(animal: AnimalId, partner?: { name: string } | null): string {
  return partner?.name.trim() || ANIMAL_NAMES[animal];
}

/** 頭飾りを小さな絵として出すSVG(外側の大きさの指定だけ外す。中身は変えない) */
export function decorationIcon(id: DecorationId): string {
  return decorationSvg(id).replace(/<svg\b[^>]*>/, (tag) =>
    tag.replace(/\s(width|height)="[^"]*"/g, '').replace('<svg', '<svg aria-hidden="true" focusable="false"'),
  );
}
