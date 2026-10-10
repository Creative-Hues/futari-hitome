// 原っぱ(編む画面)とホームの部屋。時間帯で空と雲の色が変わり、夜は星が出る。
import { useMemo } from 'preact/hooks';
import meadowSvg from '../../assets/backgrounds/meadow.svg?raw';
import roomSvg from '../../assets/backgrounds/room_example_0.svg?raw';
import { SKY } from '../config/sky';
import { prepareScene, type SceneKind } from '../lib/sceneSvg';
import { uniquePrefix } from '../lib/svgPrep';
import { useTimeOfDay } from '../lib/timeOfDay';

const RAW: Record<SceneKind, string> = { meadow: meadowSvg, room: roomSvg };

export function Scene({ kind }: { kind: SceneKind }) {
  const markup = useMemo(() => prepareScene(RAW[kind], kind, uniquePrefix(kind[0])), [kind]);
  const time = useTimeOfDay();
  const c = SKY[time];

  const vars: Record<string, string> = { '--scene-dim': String(c.dim[kind]) };
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
