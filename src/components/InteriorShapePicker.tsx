// 「小物やインテリア」の作品を部屋に飾るときの絵(クッション・ブランケット・あみぐるみ)を選ぶ
import { useMemo } from 'preact/hooks';
import { ITEM_SHADE } from '../config/room';
import { INTERIOR_NAMES, INTERIOR_SHAPES, INTERIOR_VIEWBOX, interiorSvg, type InteriorShape } from '../data/wear';
import { shade } from '../lib/color';
import { uniquePrefix } from '../lib/svgPrep';
import { interiorPreview } from '../lib/wearSvg';

/** 部屋に飾る作品の小さな絵(作品の色で) */
export function InteriorThumb({ shape, color }: { shape: InteriorShape; color: string }) {
  const markup = useMemo(
    () => interiorPreview(interiorSvg(shape), INTERIOR_VIEWBOX, color, shade(color, ITEM_SHADE), uniquePrefix('i')),
    [shape, color],
  );
  return <span class="interior-thumb" dangerouslySetInnerHTML={{ __html: markup }} />;
}

export function InteriorShapePicker({
  value,
  color,
  onChange,
}: {
  value: InteriorShape;
  color: string;
  onChange: (shape: InteriorShape) => void;
}) {
  return (
    <div class="shape-pick" role="group" aria-label="部屋に飾るときの絵">
      {INTERIOR_SHAPES.map((s) => (
        <button type="button" class="shape-choice card" aria-pressed={value === s} onClick={() => onChange(s)}>
          <InteriorThumb shape={s} color={color} />
          <span class="name">{INTERIOR_NAMES[s]}</span>
        </button>
      ))}
    </div>
  );
}
