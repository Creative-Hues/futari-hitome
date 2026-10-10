// 作品メモ(使った毛糸・針の号数・自由メモ)。入力するたびに保存する
import type { WorkMemo } from '../lib/db';

export function MemoFields({ memo, onChange }: { memo: WorkMemo; onChange: (memo: WorkMemo) => void }) {
  return (
    <>
      <div class="field">
        <label for="memo-yarn">使った毛糸</label>
        <input
          id="memo-yarn"
          class="text-input"
          type="text"
          placeholder="例:メリノウール 並太 水色"
          value={memo.yarn}
          onInput={(e) => onChange({ ...memo, yarn: e.currentTarget.value })}
        />
      </div>
      <div class="field">
        <label for="memo-needle">針の号数</label>
        <input
          id="memo-needle"
          class="text-input"
          type="text"
          placeholder="例:8号"
          value={memo.needle}
          onInput={(e) => onChange({ ...memo, needle: e.currentTarget.value })}
        />
      </div>
      <div class="field">
        <label for="memo-note">メモ</label>
        <textarea
          id="memo-note"
          class="text-input textarea"
          rows={3}
          placeholder="気づいたことなど"
          value={memo.note}
          onInput={(e) => onChange({ ...memo, note: e.currentTarget.value })}
        />
      </div>
    </>
  );
}
