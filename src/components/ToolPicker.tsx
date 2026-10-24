// 編み方(棒針/かぎ針)を選ぶ。新しく編む画面と、編む画面のメモで同じ部品
import type { KnitTool } from '../lib/db';

export function ToolPicker({ value, onChange }: { value: KnitTool; onChange: (tool: KnitTool) => void }) {
  return (
    <fieldset class="field">
      <legend>編み方</legend>
      <div class="chips">
        <button type="button" class="chip" aria-pressed={value === 'knit'} onClick={() => onChange('knit')}>
          棒針
        </button>
        <button type="button" class="chip" aria-pressed={value === 'crochet'} onClick={() => onChange('crochet')}>
          かぎ針
        </button>
      </div>
    </fieldset>
  );
}
