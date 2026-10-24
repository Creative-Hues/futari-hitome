// パーツを作る・直す(新しく編む画面と、編む画面のシートで同じ部品を使う)。
// まとまり(右手など)の中にパーツ(親指など)を入れる。まとまりごと・パーツごとに長押しで並び替え、複製できる。
import { createPortal } from 'preact/compat';
import { useState } from 'preact/hooks';
import {
  addPart,
  copyPart,
  duplicateGroup,
  duplicatePart,
  editPart,
  flattenGroups,
  groupParts,
  mirrorName,
  newPart,
  partLabel,
  type Part,
  type PartGroup,
} from '../lib/parts';
import { useDragSort } from '../lib/useDragSort';
import { ConfirmSheet, Sheet } from './Sheet';

/** 数字だけを取り出す(全角も半角に) */
export function toPositiveInt(s: string): number | null {
  const half = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const n = parseInt(half, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 「20段 ・ 1段24目」「目標なし」 */
export function goalText(p: Pick<Part, 'goalRows' | 'stitchesPerRow'>): string {
  const goal = p.goalRows ? `${p.goalRows}段` : '目標なし';
  return p.stitchesPerRow ? `${goal} ・ 1段${p.stitchesPerRow}目` : goal;
}

type Form =
  | { kind: 'add'; group: string }
  | { kind: 'edit'; part: Part }
  | { kind: 'copyPart'; part: Part }
  | { kind: 'copyGroup'; group: string }
  | { kind: 'renameGroup'; group: string };

export function PartsEditor({
  parts,
  currentPartId,
  onChange,
  onRemove,
}: {
  parts: Part[];
  /** 今編んでいるパーツ(編む画面のとき) */
  currentPartId?: string;
  onChange: (parts: Part[]) => void;
  /** パーツを消す(最後の1つは消せない) */
  onRemove: (id: string) => void;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [removing, setRemoving] = useState<Part | null>(null);
  const groups = groupParts(parts);
  const showHeads = groups.length > 1 || groups[0]?.group !== '';
  const drag = useDragSort(groups, (g) => g.group, (next) => onChange(flattenGroups(next)));

  const close = () => setForm(null);
  const last = parts[parts.length - 1];

  return (
    <div class="parts-editor">
      {drag.items.map((g) => (
        <GroupBlock
          key={g.group}
          group={g}
          showHead={showHeads}
          currentPartId={currentPartId}
          bind={drag.bind(g.group)}
          onReorder={(ps) => onChange(flattenGroups(groups.map((x) => (x.group === g.group ? { ...x, parts: ps } : x))))}
          onForm={setForm}
        />
      ))}
      {groups.length > 1 && <p class="field-note">まとまりの見出しやパーツを長押しして動かすと、並びを変えられます</p>}
      <button
        type="button"
        class="secondary-button"
        onClick={() => setForm({ kind: 'add', group: last?.group ?? '' })}
      >
        ＋ パーツを足す
      </button>

      {form &&
        createPortal(
          form.kind === 'add' || form.kind === 'edit' ? (
            <PartForm
              part={form.kind === 'edit' ? form.part : copyPart(last ?? newPart(), { group: form.group, name: '' })}
              isNew={form.kind === 'add'}
              groups={groups.map((g) => g.group).filter(Boolean)}
              canRemove={parts.length > 1}
              onSave={(p) => {
                onChange(form.kind === 'add' ? addPart(parts, p) : editPart(parts, p.id, p));
                close();
              }}
              onRemove={() => {
                if (form.kind !== 'edit') return;
                const p = parts.find((x) => x.id === form.part.id);
                close();
                // 数えていないパーツはすぐ消す。数えたパーツは確かめてから
                if (p && (p.count.row || p.count.stitch || p.history.length)) setRemoving(p);
                else if (p) onRemove(p.id);
              }}
              onClose={close}
            />
          ) : (
            <NameForm
              title={
                form.kind === 'copyPart'
                  ? `「${partLabel(form.part)}」を複製`
                  : form.kind === 'copyGroup'
                    ? `「${form.group}」をまとめて複製`
                    : 'まとまりの名前'
              }
              label={form.kind === 'copyPart' ? 'パーツの名前' : 'まとまりの名前'}
              note={
                form.kind === 'renameGroup'
                  ? undefined
                  : '目標と模様の回数の設定は同じで、数は0から始まります'
              }
              initial={
                form.kind === 'copyPart'
                  ? mirrorName(form.part.name)
                  : form.kind === 'copyGroup'
                    ? mirrorName(form.group)
                    : form.group
              }
              ok={form.kind === 'renameGroup' ? '決める' : '複製する'}
              onSave={(name) => {
                if (form.kind === 'copyPart') onChange(duplicatePart(parts, form.part.id, name));
                else if (form.kind === 'copyGroup') onChange(duplicateGroup(parts, form.group, name));
                else onChange(parts.map((p) => (p.group === form.group ? { ...p, group: name } : p)));
                close();
              }}
              onClose={close}
            />
          ),
          document.body,
        )}
      {removing &&
        createPortal(
          <ConfirmSheet
            title="このパーツを消しますか?"
            message={`「${partLabel(removing)}」の数・取り消しの履歴・模様の回数が消えます。元に戻せません`}
            ok="消す"
            danger
            onOk={() => {
              onRemove(removing.id);
              setRemoving(null);
            }}
            onClose={() => setRemoving(null)}
          />,
          document.body,
        )}
    </div>
  );
}

function GroupBlock({
  group,
  showHead,
  currentPartId,
  bind,
  onReorder,
  onForm,
}: {
  group: PartGroup;
  showHead: boolean;
  currentPartId?: string;
  bind: object;
  onReorder: (parts: Part[]) => void;
  onForm: (f: Form) => void;
}) {
  const drag = useDragSort(group.parts, (p) => p.id, onReorder);
  return (
    <div class="part-group card" {...bind}>
      {showHead && (
        <div class="part-group-head">
          <span class="part-group-name">{group.group || 'まとまりなし'}</span>
          {group.group && (
            <>
              <button type="button" class="link-button" onClick={() => onForm({ kind: 'renameGroup', group: group.group })}>
                名前
              </button>
              <button type="button" class="link-button" onClick={() => onForm({ kind: 'copyGroup', group: group.group })}>
                まとめて複製
              </button>
            </>
          )}
        </div>
      )}
      {drag.items.map((p) => {
        const b = drag.bind(p.id) as { onPointerDown: (e: PointerEvent) => void };
        return (
          <div
            key={p.id}
            class="part-row"
            data-current={p.id === currentPartId || undefined}
            {...b}
            // まとまりの並び替えと重ならないよう、パーツを押したときはまとまりに伝えない
            onPointerDown={(e: PointerEvent) => {
              b.onPointerDown(e);
              e.stopPropagation();
            }}
          >
            <span class="part-info">
              <span class="part-name">{p.name.trim() || 'パーツ'}</span>
              <span class="part-sub">
                {goalText(p)}
                {p.count.row || p.count.stitch ? ` ・ いま ${p.count.row}段` : ''}
              </span>
            </span>
            <button type="button" class="link-button" onClick={() => onForm({ kind: 'copyPart', part: p })}>
              複製
            </button>
            <button type="button" class="link-button" onClick={() => onForm({ kind: 'edit', part: p })}>
              直す
            </button>
          </div>
        );
      })}
      <button type="button" class="link-button part-add" onClick={() => onForm({ kind: 'add', group: group.group })}>
        ＋ {group.group ? `「${group.group}」に` : ''}パーツを足す
      </button>
    </div>
  );
}

/** パーツの名前・まとまり・目標 */
export function PartForm({
  part,
  isNew,
  groups,
  canRemove,
  title,
  ok,
  note,
  onSave,
  onRemove,
  onClose,
}: {
  part: Part;
  isNew: boolean;
  /** 今あるまとまりの名前 */
  groups: string[];
  canRemove: boolean;
  title?: string;
  ok?: string;
  /** シートの一番上に出す説明 */
  note?: string;
  onSave: (p: Part) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState(part.group);
  const [name, setName] = useState(part.name);
  const [hasGoal, setHasGoal] = useState(part.goalRows !== null);
  const [rows, setRows] = useState(part.goalRows ? String(part.goalRows) : '');
  const [perRow, setPerRow] = useState(part.stitchesPerRow ? String(part.stitchesPerRow) : '');
  const goalRows = hasGoal ? toPositiveInt(rows) : null;
  const ready = !!name.trim() && (!hasGoal || goalRows !== null);

  return (
    <Sheet title={title ?? (isNew ? 'パーツを足す' : 'パーツを直す')} tall onClose={onClose}>
      {note && <p class="sheet-message">{note}</p>}
      <div class="field">
        <span class="field-title">まとまり(右手など。なくてもよい)</span>
        {groups.length > 0 && (
          <div class="chips">
            <button type="button" class="chip" aria-pressed={group === ''} onClick={() => setGroup('')}>
              なし
            </button>
            {groups.map((g) => (
              <button type="button" class="chip" aria-pressed={group === g} onClick={() => setGroup(g)}>
                {g}
              </button>
            ))}
          </div>
        )}
        <input
          class="text-input"
          type="text"
          aria-label="まとまりの名前"
          placeholder="例:右手"
          value={group}
          onInput={(e) => setGroup(e.currentTarget.value)}
        />
      </div>
      <div class="field">
        <span class="field-title">パーツの名前</span>
        <input
          class="text-input"
          type="text"
          aria-label="パーツの名前"
          placeholder="例:親指"
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </div>
      <GoalFields
        hasGoal={hasGoal}
        rows={rows}
        perRow={perRow}
        onHasGoal={setHasGoal}
        onRows={setRows}
        onPerRow={setPerRow}
      />
      <div class="actions">
        <button type="button" class="secondary-button" onClick={onClose}>
          やめる
        </button>
        <button
          type="button"
          class="primary-button"
          disabled={!ready}
          onClick={() =>
            onSave({ ...part, group: group.trim(), name: name.trim(), goalRows, stitchesPerRow: toPositiveInt(perRow) })
          }
        >
          {ok ?? (isNew ? '足す' : '決める')}
        </button>
      </div>
      {!isNew && canRemove && onRemove && (
        <button type="button" class="link-button delete-link" onClick={onRemove}>
          このパーツを消す
        </button>
      )}
    </Sheet>
  );
}

/** 目標(段数を決める/目標なし+1段の目数)。新しく編む画面とパーツで同じ */
export function GoalFields({
  hasGoal,
  rows,
  perRow,
  onHasGoal,
  onRows,
  onPerRow,
}: {
  hasGoal: boolean;
  rows: string;
  perRow: string;
  onHasGoal: (v: boolean) => void;
  onRows: (v: string) => void;
  onPerRow: (v: string) => void;
}) {
  return (
    <fieldset class="field">
      <legend>目標</legend>
      <div class="chips">
        <button type="button" class="chip" aria-pressed={hasGoal} onClick={() => onHasGoal(true)}>
          段数を決める
        </button>
        <button type="button" class="chip" aria-pressed={!hasGoal} onClick={() => onHasGoal(false)}>
          目標なし
        </button>
      </div>
      {hasGoal && (
        <label class="goal-row">
          <input
            class="text-input number-input"
            type="text"
            inputMode="numeric"
            placeholder="80"
            value={rows}
            onInput={(e) => onRows(e.currentTarget.value)}
          />
          段まで
        </label>
      )}
      <label class="goal-row">
        1段
        <input
          class="text-input number-input"
          type="text"
          inputMode="numeric"
          placeholder="30"
          value={perRow}
          onInput={(e) => onPerRow(e.currentTarget.value)}
        />
        目
      </label>
      <p class="field-note">
        1段の目数を入れると、目を数え終わったとき段が自動で進みます。入れなければ段だけを数えます
      </p>
    </fieldset>
  );
}

function NameForm({
  title,
  label,
  note,
  initial,
  ok,
  onSave,
  onClose,
}: {
  title: string;
  label: string;
  note?: string;
  initial: string;
  ok: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <Sheet title={title} onClose={onClose}>
      <input
        class="text-input"
        type="text"
        aria-label={label}
        placeholder={label}
        value={name}
        onInput={(e) => setName(e.currentTarget.value)}
      />
      {note && <p class="field-note">{note}</p>}
      <div class="actions">
        <button type="button" class="secondary-button" onClick={onClose}>
          やめる
        </button>
        <button type="button" class="primary-button" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
          {ok}
        </button>
      </div>
    </Sheet>
  );
}
