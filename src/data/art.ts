// 新しい絵(PNG)。npm run art が assets/art/ から作った軽い版(src/art/generated/)を読む。
// 絵がなければ空で、どの部品も今のSVGの絵を使う。
// (animals.ts からも読まれるので、animals.ts の値はここでは使わず、元の json を読む)
import manifest from '../art/generated/manifest.json';
import anchors from '../../assets/animals/anchors.json';
import wear from '../../assets/wear/wear.json';
import { ArtBook, type AnimalArt, type ArtManifest, type Placed } from '../lib/artConfig';
import type { AnimalId } from '../lib/db';
import type { DecorationId } from './animals';
import { wornKey, type InteriorShape, type WearDept } from './wear';

const files = import.meta.glob('../art/generated/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const urls = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace(/^.*\/([^/]+)\.png$/, '$1'), url]),
);

const book = new ArtBook(manifest as unknown as ArtManifest, urls);

/** 頭飾りの座標1つ分が、頭飾りのキャンバス(272×272)の何点か */
export const DECO_PX = 4 * anchors.decorationScale;

export function animalArt(animal: AnimalId): AnimalArt | null {
  const key = wornKey('head', animal);
  const hatY = key ? ((wear.worn[key] as { decorationAnchorY?: number }).decorationAnchorY ?? null) : null;
  return book.animal(animal, { anchor: anchors.anchors[animal], hatY });
}

export function decorationArt(id: DecorationId): Placed | null {
  return book.decoration(id, DECO_PX);
}

export function wearArt(dept: WearDept, animal: AnimalId) {
  const key = wornKey(dept, animal);
  return key ? book.wear(key) : null;
}

export function roomArt(shape: InteriorShape): Placed | null {
  return book.room(shape);
}
