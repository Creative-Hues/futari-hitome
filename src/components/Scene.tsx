// 原っぱ(編む画面)とホームの部屋。時間帯で空と雲の色が変わり、夜は星が出る。
// 部屋は room_template.svg を使い、模様替えの色・鉢植えの花・飾った作品を反映する。
import { useMemo } from 'preact/hooks';
import meadowSvg from '../../assets/backgrounds/meadow.svg?raw';
import roomSvg from '../../assets/backgrounds/room_template.svg?raw';
import { ITEM_SHADE, ROOM_SHADE } from '../config/room';
import { SKY } from '../config/sky';
import { decorationSvg } from '../data/animals';
import { decorationArt, roomArt } from '../data/art';
import { useArtUrls } from '../lib/artImage';
import { ROOM_SPOTS, defaultInteriorShape, interiorSvg } from '../data/wear';
import { shade } from '../lib/color';
import type { RoomData, Work } from '../lib/db';
import { prepareScene, type RoomContent, type SceneKind } from '../lib/sceneSvg';
import { uniquePrefix } from '../lib/svgPrep';
import { useTimeOfDay } from '../lib/timeOfDay';

const RAW: Record<SceneKind, string> = { meadow: meadowSvg, room: roomSvg };

/** 飾っている作品(なくなった作品・完成でなくなった作品は除く)。並び順 = 置き場所 */
export function displayedWorks(room: RoomData, works: Work[]): Work[] {
  const byId = new Map(works.map((w) => [w.id, w]));
  return room.displayed
    .map((id) => byId.get(id))
    .filter((w): w is Work => !!w && w.status === 'done' && w.department === 'interior')
    .slice(0, ROOM_SPOTS.length);
}

/** 部屋の色の CSS 変数。影や境目の色は、選んだ色を少し濃くして作る */
export function roomVars(room: RoomData): Record<string, string> {
  return {
    '--wall': room.wall,
    '--wall-shade': shade(room.wall, ROOM_SHADE.wall),
    '--floor': room.floor,
    '--floor-shade': shade(room.floor, ROOM_SHADE.floor),
    '--curtain': room.curtain,
    '--rug': room.rug,
    '--yarn1': room.yarn1,
    '--yarn1-shade': shade(room.yarn1, ROOM_SHADE.yarn),
    '--yarn2': room.yarn2,
    '--yarn2-shade': shade(room.yarn2, ROOM_SHADE.yarn),
  };
}

export function Scene({ kind, room, works = [] }: { kind: SceneKind; room?: RoomData; works?: Work[] }) {
  const items = room ? displayedWorks(room, works) : [];
  const itemsKey = items.map((w) => `${w.id}:${w.interiorShape}:${w.color}`).join(',');
  // 飾った作品の新しい絵(PNG)は、作品の色を付けた画像がそろってから置く
  const shapes = items.map((w) => w.interiorShape ?? defaultInteriorShape(w.kind));
  const pngs = shapes.map((s) => roomArt(s));
  const loaded = useArtUrls(
    pngs.flatMap((p, i) => (p ? [{ href: p.href, tint: { mode: 'multiply' as const, color: items[i].color } }] : [])),
  );
  const urls = loaded.state === 'ready' ? loaded.urls : null;
  const markup = useMemo(() => {
    let content: RoomContent | undefined;
    if (kind === 'room' && room) {
      let n = 0;
      content = {
        flower: decorationSvg(room.flower),
        flowerPng: decorationArt(room.flower),
        // 新しい絵の画像がまだそろっていない作品は、そろうまで置かない(読めなかったときは今のSVG)
        items: items.flatMap((w, i) => {
          const p = pngs[i];
          if (p && loaded.state === 'loading') return [];
          const href = p && urls ? urls[n++] : null;
          return [
            {
              svg: interiorSvg(shapes[i]),
              spot: ROOM_SPOTS[i],
              color: w.color,
              shade: shade(w.color, ITEM_SHADE),
              png: p && href ? { ...p, href } : null,
            },
          ];
        }),
      };
    }
    return prepareScene(RAW[kind], kind, uniquePrefix(kind[0]), content);
  }, [kind, room?.flower, itemsKey, !!room, urls?.join(','), loaded.state]);
  const time = useTimeOfDay();
  const c = SKY[time];

  const vars: Record<string, string> = { '--scene-dim': String(c.dim[kind]), ...(room ? roomVars(room) : {}) };
  c.sky?.forEach((s, i) => (vars[`--sky-${i}`] = s));
  if (c.cloud) vars['--cloud'] = c.cloud;
  if (c.cloudShade) vars['--cloud-shade'] = c.cloudShade;

  return (
    <div
      class={`scene scene-${kind}`}
      data-time={time}
      data-stars={c.stars || undefined}
      style={vars}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
