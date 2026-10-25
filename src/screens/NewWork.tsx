import { createPortal } from 'preact/compat';
import { useState } from 'preact/hooks';
import { BackButton } from '../components/BackButton';
import { InteriorShapePicker } from '../components/InteriorShapePicker';
import { Partner } from '../components/Partner';
import { GoalFields, PartForm, PartsEditor, toPositiveInt } from '../components/PartsEditor';
import { ToolPicker } from '../components/ToolPicker';
import { ANIMAL_NAMES } from '../data/animals';
import { DEPARTMENTS, WORK_COLORS } from '../data/departments';
import { PARTS_NOTE } from '../data/help';
import { defaultInteriorShape, type InteriorShape } from '../data/wear';
import { addWork, meetPartner, newId, type AnimalId, type DepartmentId, type KnitTool, type Part, type Work } from '../lib/db';
import { useLooks } from '../lib/looks';
import { newPart } from '../lib/parts';
import { go, routes } from '../lib/router';

/** 前に作った作品(いちばん新しく始めた作品)の編み方。作品がなければ棒針 */
export function lastTool(works: Pick<Work, 'startedAt' | 'tool'>[]): KnitTool {
  const last = works.reduce<Pick<Work, 'startedAt' | 'tool'> | null>((a, w) => (!a || w.startedAt > a.startedAt ? w : a), null);
  return last?.tool ?? 'knit';
}

const CUSTOM = '__custom__';

/** 部門のボタンで2行にするときの区切り(ここでだけ折り返す) */
const breakable = (name: string) => name.replace('身につける', '身につける\u200b').replace('小物や', '小物や\u200b');

export function NewWork() {
  const [dept, setDept] = useState<DepartmentId | null>(null);
  const [kindChoice, setKindChoice] = useState<string | null>(null);
  const [customKind, setCustomKind] = useState('');
  const [name, setName] = useState('');
  const [hasGoal, setHasGoal] = useState(true);
  const [rows, setRows] = useState('');
  const [perRow, setPerRow] = useState('');
  const [color, setColor] = useState(WORK_COLORS[0].value);
  const [saving, setSaving] = useState(false);
  const [partner, setPartner] = useState<AnimalId | null>(null);
  /** 部屋に飾るときの絵。自分で選ぶまでは種類名に合わせる */
  const [pickedShape, setPickedShape] = useState<InteriorShape | null>(null);
  const [pickedTool, setPickedTool] = useState<KnitTool | null>(null);
  /** パーツに分けたとき(分けないときは null) */
  const [parts, setParts] = useState<Part[] | null>(null);
  const [firstPart, setFirstPart] = useState(false);
  const looks = useLooks();
  const partners = looks?.partners;
  const tool = pickedTool ?? lastTool(looks?.works ?? []);

  const department = DEPARTMENTS.find((d) => d.id === dept);
  const kind = kindChoice === CUSTOM ? customKind.trim() : (kindChoice ?? '');
  const goalRows = hasGoal ? toPositiveInt(rows) : null;
  const stitchesPerRow = toPositiveInt(perRow);
  const shape = pickedShape ?? defaultInteriorShape(kind);
  const goalReady = parts ? parts.length > 0 : !hasGoal || goalRows !== null;
  const ready = !!dept && !!partner && !!kind && goalReady && !saving;

  const selectDept = (id: DepartmentId) => {
    setDept(id);
    setKindChoice(null);
    setPartner(null);
    setPickedShape(null);
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!ready || !dept || !partner) return;
    setSaving(true);
    const now = new Date().toISOString();
    const workParts = parts ?? [newPart({ goalRows, stitchesPerRow })];
    const work = await addWork({
      id: newId(),
      name: name.trim() || kind,
      department: dept,
      kind,
      partner,
      status: 'wip',
      color,
      tool,
      parts: workParts,
      currentPartId: workParts[0].id,
      memo: { yarn: '', needle: '', note: '' },
      impression: '',
      lastCountAt: null,
      startedAt: now,
      finishedAt: null,
      pausedAt: null,
      giftedTo: null,
      interiorShape: dept === 'interior' ? shape : null,
      updatedAt: now,
    });
    await meetPartner(partner);
    go(routes.knit(work.id), true);
  };

  return (
    <main class="screen">
      <div class="top-bar">
        <BackButton fallback={routes.home()} />
        <h1>新しく編む</h1>
      </div>

      <form class="form" onSubmit={submit}>
        <fieldset class="field">
          <legend>どこにつけるもの?</legend>
          <div class="dept-grid">
            {DEPARTMENTS.map((d) => (
              <button
                type="button"
                class="chip"
                aria-pressed={dept === d.id}
                onClick={() => selectDept(d.id)}
              >
                {breakable(d.name)}
              </button>
            ))}
          </div>
        </fieldset>

        {department && (
          <fieldset class="field">
            <legend>だれと編む?</legend>
            <div class="partner-pick">
              {department.partners.map((a) => (
                <button
                  type="button"
                  class="partner-choice card"
                  aria-pressed={partner === a}
                  onClick={() => setPartner(a)}
                >
                  <span class="thumb">
                    {looks && <Partner animal={a} look={looks.look(a)} name={looks.name(a)} color={color} tool={tool} progress={0.5} />}
                  </span>
                  <span class="name">{ANIMAL_NAMES[a]}</span>
                  {partners?.[a].name.trim() && <span class="nickname">{partners[a].name.trim()}</span>}
                  {partners && !partners[a].met && <span class="first">はじめまして</span>}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {department && (
          <fieldset class="field">
            <legend>なにを編む?</legend>
            <div class="chips">
              {department.examples.map((ex) => (
                <button
                  type="button"
                  class="chip"
                  aria-pressed={kindChoice === ex}
                  onClick={() => setKindChoice(ex)}
                >
                  {ex}
                </button>
              ))}
              <button
                type="button"
                class="chip"
                aria-pressed={kindChoice === CUSTOM}
                onClick={() => setKindChoice(CUSTOM)}
              >
                ほかのもの
              </button>
            </div>
            {kindChoice === CUSTOM && (
              <input
                class="text-input"
                type="text"
                placeholder="例:ミトン"
                aria-label="編むものの名前"
                value={customKind}
                onInput={(e) => setCustomKind(e.currentTarget.value)}
              />
            )}
          </fieldset>
        )}

        {dept === 'interior' && (
          <fieldset class="field">
            <legend>部屋に飾るときの絵</legend>
            <InteriorShapePicker value={shape} color={color} onChange={setPickedShape} />
            <p class="field-note">完成したら、ホームの部屋に飾れます。あとから選び直せます</p>
          </fieldset>
        )}

        <div class="field">
          <label for="work-name">作品の名前</label>
          <input
            id="work-name"
            class="text-input"
            type="text"
            placeholder={kind ? `例:青い${kind}` : '例:青いマフラー'}
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <p class="field-note">入れなければ「{kind || '編むもの'}」になります</p>
        </div>

        <ToolPicker value={tool} onChange={setPickedTool} />

        {!parts && (
          <GoalFields
            hasGoal={hasGoal}
            rows={rows}
            perRow={perRow}
            onHasGoal={setHasGoal}
            onRows={setRows}
            onPerRow={setPerRow}
          />
        )}

        <fieldset class="field">
          <legend>パーツ</legend>
          {parts ? (
            <>
              <PartsEditor
                parts={parts}
                onChange={setParts}
                onRemove={(id) => setParts(parts.length > 1 ? parts.filter((p) => p.id !== id) : parts)}
              />
              <p class="field-note">目標はパーツごとに入れます。あとから編む画面のメモでも直せます</p>
              <button type="button" class="link-button" onClick={() => setParts(null)}>
                パーツに分けない
              </button>
            </>
          ) : (
            <>
              <p class="field-note">{PARTS_NOTE}。あとから編む画面のメモでも分けられます</p>
              <button type="button" class="secondary-button" onClick={() => setFirstPart(true)}>
                パーツに分ける
              </button>
            </>
          )}
        </fieldset>

        <fieldset class="field">
          <legend>作品の色</legend>
          <div class="colors">
            {WORK_COLORS.map((c) => (
              <button
                type="button"
                class="color-swatch"
                style={{ background: c.value }}
                aria-label={c.name}
                aria-pressed={color === c.value}
                onClick={() => setColor(c.value)}
              />
            ))}
          </div>
        </fieldset>

        <button class="primary-button" type="submit" disabled={!ready}>
          編みはじめる
        </button>
      </form>

      {firstPart &&
        createPortal(
          <PartForm
            part={newPart({ goalRows, stitchesPerRow })}
            isNew
            groups={[]}
            canRemove={false}
            title="パーツに分ける"
            ok="次へ"
            note="最初のパーツを入れてください(例:まとまり「右手」、パーツ「親指」)"
            onSave={(p) => {
              setParts([p]);
              setFirstPart(false);
            }}
            onClose={() => setFirstPart(false)}
          />,
          document.body,
        )}
    </main>
  );
}
