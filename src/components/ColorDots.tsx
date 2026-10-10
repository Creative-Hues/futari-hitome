// 色の丸を並べて1つ選ぶ。free を付けると、最後に「自由に選ぶ」(iPhone の色選び)が付く
import { normalizeHex } from '../lib/color';

export interface ColorOption {
  /** null は「もとの色」 */
  value: string | null;
  name: string;
}

export function ColorDots({
  label,
  options,
  value,
  onChange,
  free = false,
  original,
}: {
  label: string;
  options: ColorOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  free?: boolean;
  /** 「もとの色」の丸に出す色 */
  original?: string;
}) {
  const current = value ? normalizeHex(value) : null;
  const inList = options.some((o) => (o.value ? normalizeHex(o.value) : null) === current);
  const custom = free && current && !inList ? current : null;

  return (
    <div class="colors" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          class={`color-swatch${o.value ? '' : ' original'}`}
          style={{ background: o.value ?? original ?? '#ffffff' }}
          aria-label={o.name}
          aria-pressed={(o.value ? normalizeHex(o.value) : null) === current}
          onClick={() => onChange(o.value)}
        />
      ))}
      {free && (
        <label
          class="color-swatch free"
          style={custom ? { background: custom } : undefined}
          data-on={custom ? true : undefined}
          title="自由に選ぶ"
        >
          <span class="free-label">{custom ? '' : '自由'}</span>
          <input
            type="color"
            aria-label={`${label}を自由に選ぶ`}
            value={current ?? '#ffffff'}
            onInput={(e) => {
              const c = normalizeHex(e.currentTarget.value);
              if (c) onChange(c);
            }}
            onChange={(e) => {
              const c = normalizeHex(e.currentTarget.value);
              if (c) onChange(c);
            }}
          />
        </label>
      )}
    </div>
  );
}
