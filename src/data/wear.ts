// 身につける作品・部屋に飾る作品の素材(assets/wear/ のSVGを文字として読み込む。中身は変えない)
import wear from '../../assets/wear/wear.json';
import type { AnimalId, DepartmentId } from '../lib/db';

/** 身につける部門(小物やインテリアは部屋に飾るので入らない) */
export type WearDept = Exclude<DepartmentId, 'interior'>;
export const WEAR_DEPTS: WearDept[] = ['head', 'neck', 'body', 'paw', 'wear'];

/** 部屋に飾る作品の絵 */
export type InteriorShape = 'cushion' | 'blanket' | 'amigurumi';
export const INTERIOR_SHAPES: InteriorShape[] = ['cushion', 'blanket', 'amigurumi'];

export const INTERIOR_NAMES: Record<InteriorShape, string> = {
  cushion: wear.interior.shapes.cushion.name,
  blanket: wear.interior.shapes.blanket.name,
  amigurumi: wear.interior.shapes.amigurumi.name,
};

/** 部門 → 素材の名前の頭(例:前足 → paws_cat) */
const FILE_PREFIX: Record<WearDept, string> = {
  head: 'head',
  neck: 'neck',
  body: 'body',
  paw: 'paws',
  wear: 'feet',
};

/** 2つ以上身につけたときの重ね順(下から):セーター → くつした → マフラー → 帽子。手袋は手の中なので関係しない */
export const WEAR_STACK: WearDept[] = ['body', 'wear', 'neck', 'head', 'paw'];

const files = import.meta.glob('../../assets/wear/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

type WornKey = keyof typeof wear.worn;

export function wornKey(dept: WearDept, animal: AnimalId): WornKey | null {
  const key = `${FILE_PREFIX[dept]}_${animal}`;
  return key in wear.worn ? (key as WornKey) : null;
}

/** その子がその部門で身につける絵(担当でない組み合わせは null) */
export function wornSvg(dept: WearDept, animal: AnimalId): string | null {
  const key = wornKey(dept, animal);
  return key ? files[`../../assets/wear/${wear.worn[key].file}`] : null;
}

/** 帽子をかぶっているときの頭飾りの y(帽子でなければ null) */
export function hatDecorationY(animal: AnimalId): number | null {
  const key = wornKey('head', animal);
  const entry = key ? (wear.worn[key] as { decorationAnchorY?: number }) : null;
  return entry?.decorationAnchorY ?? null;
}

export function interiorSvg(shape: InteriorShape): string {
  return files[`../../assets/wear/${wear.interior.shapes[shape].file}`];
}

export const INTERIOR_VIEWBOX = wear.interior.viewBox;

/** 種類名から最初に選んでおく絵(クッション/ブランケット/あみぐるみ → その絵、それ以外 → クッション) */
export function defaultInteriorShape(kind: string): InteriorShape {
  const map = wear.interior.defaultShapeByKind as Record<string, string>;
  return (map[kind.trim()] ?? map['*']) as InteriorShape;
}

/** 部屋に飾る場所(room_template.svg の座標)。並び順 = 飾っている作品の順 */
export const ROOM_SPOTS = wear.interior.roomSpots;
export const ROOM_SPOT_NAMES = ['床の右', 'ラグの左手前', '窓辺'];
export const MAX_DISPLAY = ROOM_SPOTS.length;
