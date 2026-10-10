import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { Partner } from '../components/Partner';
import { ANIMAL_NAMES } from '../data/animals';
import { DEPARTMENTS, WORK_COLORS } from '../data/departments';
import { addWork, listPartners, meetPartner, type AnimalId, type DepartmentId, type PartnerData } from '../lib/db';
import { go, routes } from '../lib/router';

/** 数字だけを取り出す(全角も半角に) */
function toPositiveInt(s: string): number | null {
  const half = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const n = parseInt(half, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const CUSTOM = '__custom__';

/** 作品のID。crypto.randomUUID は https でないと使えないので、なければ代わりの作り方で */
function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  const [partners, setPartners] = useState<Record<AnimalId, PartnerData> | null>(null);

  useEffect(() => {
    listPartners().then(setPartners);
  }, []);

  const department = DEPARTMENTS.find((d) => d.id === dept);
  const kind = kindChoice === CUSTOM ? customKind.trim() : (kindChoice ?? '');
  const goalRows = hasGoal ? toPositiveInt(rows) : null;
  const stitchesPerRow = toPositiveInt(perRow);
  const ready = !!dept && !!partner && !!kind && (!hasGoal || goalRows !== null) && !saving;

  const selectDept = (id: DepartmentId) => {
    setDept(id);
    setKindChoice(null);
    setPartner(null);
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!ready || !dept || !partner) return;
    setSaving(true);
    const now = new Date().toISOString();
    const work = await addWork({
      id: newId(),
      name: name.trim() || kind,
      department: dept,
      kind,
      partner,
      status: 'wip',
      color,
      goalRows,
      stitchesPerRow,
      count: { row: 0, stitch: 0 },
      manualProgress: 0,
      history: [],
      startedAt: now,
      updatedAt: now,
    });
    await meetPartner(partner);
    go(routes.knit(work.id), true);
  };

  return (
    <main class="screen">
      <div class="top-bar">
        <a class="round-button" href={routes.home()} aria-label="ホームへ戻る">
          <Icon name="back" />
        </a>
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
                {d.name}
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
                    <Partner animal={a} decoration={partners?.[a].decoration} color={color} progress={0.5} />
                  </span>
                  <span class="name">{ANIMAL_NAMES[a]}</span>
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

        <fieldset class="field">
          <legend>目標</legend>
          <div class="chips">
            <button type="button" class="chip" aria-pressed={hasGoal} onClick={() => setHasGoal(true)}>
              段数を決める
            </button>
            <button type="button" class="chip" aria-pressed={!hasGoal} onClick={() => setHasGoal(false)}>
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
                onInput={(e) => setRows(e.currentTarget.value)}
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
              onInput={(e) => setPerRow(e.currentTarget.value)}
            />
            目
          </label>
          <p class="field-note">
            1段の目数を入れると、目を数え終わったとき段が自動で進みます。入れなければ段だけを数えます
          </p>
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
    </main>
  );
}
