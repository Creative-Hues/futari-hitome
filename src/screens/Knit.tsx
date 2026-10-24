import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BackButton } from '../components/BackButton';
import { Celebration } from '../components/Celebration';
import { Icon } from '../components/Icon';
import { InteriorShapePicker } from '../components/InteriorShapePicker';
import { MemoFields } from '../components/MemoFields';
import { Partner, type PartnerMotion } from '../components/Partner';
import { PartForm, PartsEditor, toPositiveInt } from '../components/PartsEditor';
import { PhotoList, PhotoThumb } from '../components/PhotoList';
import { PhotoViewer } from '../components/PhotoViewer';
import { Scene } from '../components/Scene';
import { ConfirmSheet, Sheet } from '../components/Sheet';
import { ToolPicker } from '../components/ToolPicker';
import { partnerName } from '../data/animals';
import { PARTS_NOTE } from '../data/help';
import { defaultInteriorShape } from '../data/wear';
import { add, progress, pushHistory, undo, unravel, snapProgress, type Count } from '../lib/counter';
import {
  completeWork,
  deleteWork,
  getPartner,
  getSettings,
  getWork,
  listPartners,
  listPhotos,
  listWorks,
  pauseWork,
  saveSettings,
  saveWork,
  setKnitting,
  type AnimalId,
  type HistoryEntry,
  type Part,
  type PartnerData,
  type Photo,
  type Settings,
  type Work,
} from '../lib/db';
import { addKnitTime } from '../lib/knitTime';
import {
  currentPart,
  editPart,
  groupParts,
  hasParts,
  nextPartId,
  overallProgress,
  partLabel,
  partReached,
  removePart,
  updatePart,
} from '../lib/parts';
import { advancePattern, newPattern, type Pattern } from '../lib/pattern';
import { go, routes } from '../lib/router';
import { TapGuard } from '../lib/tapGuard';
import { useDragSort } from '../lib/useDragSort';
import { VoiceSession, type VoiceStatus } from '../lib/voice';
import { countWordsFor } from '../lib/voiceWords';
import { lookOf } from '../lib/wardrobe';
import { useWakeLock } from '../lib/wakeLock';

type Pop = { id: number; x: number; y: number; text: string };

export function Knit({ id }: { id: string }) {
  const [work, setWork] = useState<Work | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [missing, setMissing] = useState(false);
  const [sheet, setSheet] = useState<
    'plus' | 'unravel' | 'pattern' | 'memo' | 'complete' | 'pause' | 'delete' | 'parts' | 'partsEdit' | 'firstPart' | null
  >(null);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  /** 編みかけの作品(タブと、同じ子が編んでいる別の作品) */
  const [wip, setWip] = useState<Work[]>([]);
  /** すべての作品(身につけている完成作品の色を知るため)と、6匹の呼び名 */
  const [allWorks, setAllWorks] = useState<Work[]>([]);
  const [names, setNames] = useState<Partial<Record<AnimalId, string>>>({});
  const [motion, setMotion] = useState<PartnerMotion | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  /** 編み図の写真(原っぱの小さな写真と、大きく見る画面) */
  const [patternPhotos, setPatternPhotos] = useState<Photo[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  /** パーツを切り替えたときに小さく出す「親指を数えます」 */
  const [partNote, setPartNote] = useState<{ text: string; n: number } | null>(null);
  const motionCount = useRef(0);
  const workRef = useRef<Work | null>(null);
  const wakeLock = useWakeLock();
  useVoiceAutoOff();

  useEffect(() => {
    getWork(id).then(async (w) => {
      if (!w) return setMissing(true);
      // 完成した作品はアルバムで見る
      if (w.status === 'done') return go(routes.albumWork(w.id), true);
      // お休みの作品は数えられない。ホームの「お休み中」へ
      if (w.status === 'paused') return go(routes.pausedHome(), true);
      workRef.current = w;
      setWork(w);
      const [p, works, ps] = await Promise.all([getPartner(w.partner), listWorks(), listPartners()]);
      const mine = works.filter((x) => x.status === 'wip');
      setWip(mine);
      setAllWorks(works);
      setNames(Object.fromEntries(Object.values(ps).map((x) => [x.animal, partnerName(x.animal, x)])));
      // その子の「今編んでいる作品」がなくなっていたら、この作品を編む
      const knitting = mine.some((x) => x.id === p.knittingWorkId && x.partner === w.partner);
      setPartner(knitting ? p : await setKnitting(w.partner, w.id));
    });
    getSettings().then((s) => {
      setSettings(s);
      voiceWords = s.voiceWords;
    });
    listPhotos(id, 'pattern').then(setPatternPhotos);
  }, [id]);

  /** その子が別の作品を編んでいるときは、その作品 */
  const other =
    work && partner && partner.knittingWorkId !== work.id
      ? wip.find((x) => x.id === partner.knittingWorkId)
      : undefined;

  /** パートナーに編む・ほどくの動きをさせる(数え方には関わらない。別の作品を編んでいるときは動かない) */
  const move = (kind: PartnerMotion['kind']) => {
    if (!other) setMotion({ kind, n: ++motionCount.current });
  };

  const show = (updated: Work) => {
    workRef.current = updated;
    setWork(updated);
  };

  /** 数・模様が変わったときの保存(今のパーツ)。取り消し用に変える前の状態を残し、編んだ時間を足す */
  const commit = (w: Work, patch: Partial<Part>) => {
    const part = currentPart(w);
    const t = addKnitTime(part.knitMs, w.lastCountAt, Date.now());
    const updated = updatePart({ ...w, lastCountAt: t.lastAt, updatedAt: new Date().toISOString() }, part.id, {
      ...patch,
      history: pushHistory<HistoryEntry>(part.history, { ...part.count, repeat: part.pattern?.count }),
      knitMs: t.knitMs,
    });
    show(updated);
    saveWork(updated);
  };

  /** 取り消しの対象にしない変更(メモ・模様の設定・パーツの切り替えなど) */
  const update = (patch: Partial<Work>) => {
    const w = workRef.current;
    if (!w) return;
    const updated = { ...w, ...patch };
    show(updated);
    saveWork(updated);
  };

  /** 今のパーツの、取り消しの対象にしない変更(模様の設定など) */
  const updateCurrent = (patch: Partial<Part>) => {
    const w = workRef.current;
    if (w) update({ parts: updatePart(w, currentPart(w).id, patch).parts });
  };

  /** 今のパーツの数を変えて保存する。変わったら true */
  const change = (next: (c: Count, p: Part) => Count): boolean => {
    const w = workRef.current;
    if (!w || w.status !== 'wip') return false;
    const part = currentPart(w);
    const count = next(part.count, part);
    if (count.row === part.count.row && count.stitch === part.count.stitch) return false;
    commit(w, { count, pattern: part.pattern && advancePattern(part.pattern, part.count.row, count.row) });
    return true;
  };

  const countUp = (n: number) => {
    if (change((c, p) => add(c, n, p.stitchesPerRow))) move('knit');
  };

  /** 模様の回数を手で ±1 */
  const stepPattern = (d: number) => {
    const w = workRef.current;
    const pattern = w && currentPart(w).pattern;
    if (!w || !pattern || w.status !== 'wip') return;
    const count = Math.max(0, pattern.count + d);
    if (count !== pattern.count) commit(w, { pattern: { ...pattern, count } });
  };

  /** 目標なしのパーツの「今このくらい」。数とは別なので取り消しの対象にはしない */
  const setManual = (percent: number, save: boolean) => {
    const w = workRef.current;
    if (!w) return;
    const updated = updatePart(
      { ...w, updatedAt: save ? new Date().toISOString() : w.updatedAt },
      currentPart(w).id,
      { manualProgress: percent },
    );
    show(updated);
    if (save) saveWork(updated);
  };

  const undoLast = () => {
    const w = workRef.current;
    if (!w || w.status !== 'wip') return;
    const part = currentPart(w);
    const r = undo(part.history);
    if (!r) return;
    const { repeat, ...count } = r.count;
    const t = addKnitTime(part.knitMs, w.lastCountAt, Date.now());
    const updated = updatePart({ ...w, lastCountAt: t.lastAt, updatedAt: new Date().toISOString() }, part.id, {
      count,
      pattern: part.pattern && repeat !== undefined ? { ...part.pattern, count: repeat } : part.pattern,
      history: r.history,
      knitMs: t.knitMs,
    });
    show(updated);
    saveWork(updated);
  };

  /** 編むパーツを切り替える(数・履歴はパーツごとなので混ざらない) */
  const switchPart = (partId: string) => {
    const w = workRef.current;
    if (!w || partId === w.currentPartId) return;
    update({ currentPartId: partId });
    const p = w.parts.find((x) => x.id === partId);
    if (p) setPartNote((n) => ({ text: `${partLabel(p)}を数えます`, n: (n?.n ?? 0) + 1 }));
  };

  /** パーツを直したとき。今のパーツがなくなっていたら1つ目にする */
  const changeParts = (parts: Part[]) => {
    const w = workRef.current;
    if (!w) return;
    update({ parts, currentPartId: parts.some((p) => p.id === w.currentPartId) ? w.currentPartId : parts[0].id });
  };

  /** 同じ子のワンタップ切り替え:この作品を編んでもらう(編み地が今の進み具合まで追いつく) */
  const knitThis = async () => {
    const w = workRef.current;
    if (w) setPartner(await setKnitting(w.partner, w.id));
  };

  const finish = async () => {
    setSheet(null);
    stopVoice();
    const done = await completeWork(id);
    if (!done) return;
    show(done);
    setCelebrating(true);
  };

  const pause = async () => {
    setSheet(null);
    stopVoice();
    if (await pauseWork(id)) go(routes.home(), true);
  };

  const remove = async () => {
    setSheet(null);
    stopVoice();
    await deleteWork(id);
    go(routes.home(), true);
  };

  if (missing) {
    return (
      <main class="screen">
        <div class="top-bar">
          <BackButton fallback={routes.home()} />
        </div>
        <p>作品が見つかりませんでした</p>
      </main>
    );
  }
  if (!work || !settings) return <main class="screen knit" />;

  const part = currentPart(work);
  const perRow = part.stitchesPerRow;
  const p = progress(part.count, part.goalRows, perRow);
  const unit = perRow ? '目' : '段';
  const quick = settings.quickAdds[0];
  const canFinish = work.status === 'wip' && overallProgress(work) >= 1 - 1e-9;
  const next = nextPartId(work);
  const canNext = hasParts(work) && partReached(part) && next !== null;
  const shown = other ?? work;
  const name = partnerName(work.partner, partner);
  const pattern = part.pattern;

  return (
    <main class="screen knit">
      <div class="top-bar">
        <BackButton fallback={routes.home()} />
        {wip.length >= 2 ? <WorkTabs works={wip} current={work.id} names={names} /> : <h1>{work.name}</h1>}
      </div>

      <section class="meadow" aria-label="パートナー">
        <Scene kind="meadow" />
        <Partner
          animal={work.partner}
          look={partner ? lookOf(partner, allWorks) : undefined}
          name={name}
          color={shown.color}
          progress={overallProgress(shown)}
          motion={motion}
          live
          interactive
        />
        {patternPhotos[0] && (
          <button class="pattern-thumb" aria-label="編み図の写真を大きく見る" onClick={() => setViewing(0)}>
            <PhotoThumb photo={patternPhotos[0]} />
          </button>
        )}
        {canFinish && (
          <button class="finish-button" onClick={() => setSheet('complete')}>
            完成!
          </button>
        )}
        {partNote && (
          <p key={partNote.n} class="part-note" aria-live="polite" onAnimationEnd={() => setPartNote(null)}>
            {partNote.text}
          </p>
        )}
        {other && (
          <div class="knitting-other">
            <span>
              {name}は「{other.name}」を編んでいます
            </span>
            <button class="primary-button small" onClick={knitThis}>
              こっちを編む
            </button>
          </div>
        )}
      </section>

      <div class="stats">
        {hasParts(work) && (
          <div class="part-line">
            <button
              class="part-chip"
              aria-label={`今のパーツ ${partLabel(part)}。押すとパーツの一覧`}
              onClick={() => setSheet('parts')}
            >
              <span>{partLabel(part)}</span>
              <Icon name="down" size={16} />
            </button>
            {canNext && (
              <button class="primary-button small next-part" onClick={() => switchPart(next)}>
                次のパーツへ
              </button>
            )}
          </div>
        )}
        {p === null && <ProgressPicker value={part.manualProgress} color={work.color} onChange={setManual} />}
        {p !== null && (
          <div class="bar" role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${p * 100}%`, background: work.color }} />
          </div>
        )}
        <div class="numbers" aria-live="polite">
          <span class="big">
            {part.count.row}
            <span class="unit">{part.goalRows ? ` / ${part.goalRows}段` : ' 段'}</span>
          </span>
          {perRow && (
            <span class="mid">
              {part.count.stitch}
              <span class="unit"> / {perRow}目</span>
            </span>
          )}
          <button
            class={`pattern-chip${pattern ? '' : ' empty'}`}
            aria-label={pattern ? `模様の回数 ${pattern.name} ${pattern.count}回` : '模様の回数を数える'}
            onClick={() => setSheet('pattern')}
          >
            <span>{pattern ? `${pattern.name} ${pattern.count}回` : '＋ 模様の回数'}</span>
          </button>
        </div>
      </div>

      <TapZone onCount={() => countUp(1)} unit={unit} onVoiceCount={countUp} />

      <div class="tools">
        <button class="tool" onClick={undoLast} disabled={part.history.length === 0}>
          取り消し
        </button>
        <button class="tool" onClick={() => setSheet('plus')}>
          {quick ? `＋${quick}` : '＋N'}
        </button>
        <button class="tool" onClick={() => setSheet('unravel')}>
          ほどく
        </button>
        <VoiceButton />
        <button class="tool" onClick={() => setSheet('memo')}>
          メモ
        </button>
      </div>
      <KnitNote wakeLock={wakeLock} />

      {sheet === 'plus' && (
        <PlusSheet
          unit={unit}
          settings={settings}
          onSettings={(s) => {
            setSettings(s);
            saveSettings(s);
          }}
          onAdd={(n) => {
            countUp(n);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'unravel' && (
        <UnravelSheet
          hasStitches={!!perRow}
          onUnravel={(u, n) => {
            if (change((c, pt) => unravel(c, u, n, pt.stitchesPerRow))) move('unravel');
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'pattern' && (
        <PatternSheet
          key={part.id}
          pattern={pattern}
          row={part.count.row}
          partName={hasParts(work) ? partLabel(part) : null}
          onUpdate={(pt) => updateCurrent({ pattern: pt })}
          onStep={stepPattern}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'parts' && (
        <Sheet title="パーツ" tall onClose={() => setSheet(null)}>
          <div class="part-list">
            {groupParts(work.parts).map((g) => (
              <div class="part-group card">
                {g.group && (
                  <div class="part-group-head">
                    <span class="part-group-name">{g.group}</span>
                  </div>
                )}
                {g.parts.map((pt) => (
                  <button
                    class="part-pick"
                    aria-pressed={pt.id === part.id}
                    onClick={() => {
                      switchPart(pt.id);
                      setSheet(null);
                    }}
                  >
                    <span class="part-name">{pt.name.trim() || 'パーツ'}</span>
                    <span class="part-amount">
                      {pt.goalRows ? `${pt.count.row}/${pt.goalRows}段` : `${pt.count.row}段`}
                      {partReached(pt) ? ' ・ できた' : ''}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <p class="field-note">作品全体 {Math.round(overallProgress(work) * 100)}%</p>
          <div class="actions">
            <button class="secondary-button" onClick={() => setSheet('partsEdit')}>
              直す
            </button>
            <button class="primary-button" onClick={() => setSheet(null)}>
              とじる
            </button>
          </div>
        </Sheet>
      )}
      {sheet === 'partsEdit' && (
        <Sheet title="パーツを直す" tall onClose={() => setSheet(null)}>
          <PartsEditor
            parts={work.parts}
            currentPartId={part.id}
            onChange={changeParts}
            onRemove={(pid) => {
              const w = workRef.current;
              if (!w) return;
              const r = removePart(w, pid);
              update({ parts: r.parts, currentPartId: r.currentPartId });
            }}
          />
          <button class="primary-button" onClick={() => setSheet(null)}>
            とじる
          </button>
        </Sheet>
      )}
      {sheet === 'firstPart' && (
        <PartForm
          part={work.parts[0]}
          isNew={false}
          groups={[]}
          canRemove={false}
          title="パーツに分ける"
          ok="次へ"
          note="いま数えている分は、このパーツの数になります"
          onSave={(pt) => {
            changeParts(editPart(work.parts, pt.id, pt));
            setSheet('partsEdit');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'memo' && (
        <Sheet title="メモ" tall onClose={() => setSheet(null)}>
          <ToolPicker value={work.tool} onChange={(tool) => update({ tool })} />
          <MemoFields memo={work.memo} onChange={(memo) => update({ memo })} />
          {work.department === 'interior' && (
            <div class="field">
              <span class="field-title">部屋に飾るときの絵</span>
              <InteriorShapePicker
                value={work.interiorShape ?? defaultInteriorShape(work.kind)}
                color={work.color}
                onChange={(interiorShape) => update({ interiorShape })}
              />
            </div>
          )}
          <div class="field">
            <span class="field-title">編み図の写真</span>
            <PhotoList workId={work.id} kind="pattern" onChange={setPatternPhotos} />
            <p class="field-note">1枚目が、原っぱの左上に小さく出ます。押すと大きく見られます</p>
          </div>
          <div class="field">
            <span class="field-title">パーツ</span>
            {hasParts(work) ? (
              <button class="secondary-button" onClick={() => setSheet('partsEdit')}>
                パーツを直す
              </button>
            ) : (
              <>
                <p class="field-note">{PARTS_NOTE}。</p>
                <button class="secondary-button" onClick={() => setSheet('firstPart')}>
                  パーツに分ける
                </button>
              </>
            )}
          </div>
          <button class="primary-button" onClick={() => setSheet(null)}>
            とじる
          </button>
          <button class="link-button finish-link" onClick={() => setSheet('complete')}>
            この作品を完成にする
          </button>
          <button class="link-button pause-link" onClick={() => setSheet('pause')}>
            お休みにする
          </button>
          <button class="link-button delete-link" onClick={() => setSheet('delete')}>
            この作品を消す
          </button>
        </Sheet>
      )}
      {sheet === 'complete' && (
        <ConfirmSheet
          title="完成にしますか?"
          message={`「${work.name}」を完成にして、${name}にわたします。まちがえたときは、アルバムから編みかけに戻せます`}
          ok="完成!"
          onOk={finish}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'pause' && (
        <ConfirmSheet
          title="お休みにしますか?"
          message="数・模様・メモ・写真・取り消しの履歴はそのまま残ります。ホームの一番下の「お休み中」から、いつでも再開できます"
          ok="お休みにする"
          onOk={pause}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'delete' && (
        <ConfirmSheet
          title="この作品を消しますか?"
          message={`「${work.name}」の数・メモ・写真(編み図)がすべて消えます。元に戻せません`}
          ok="消す"
          danger
          onOk={remove}
          onClose={() => setSheet(null)}
        />
      )}
      {viewing !== null && patternPhotos[viewing] && (
        <PhotoViewer photos={patternPhotos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
      {celebrating && (
        <Celebration
          work={work}
          onRecord={() => go(routes.record(work.id), true)}
          onLater={() => go(routes.home(), true)}
        />
      )}
    </main>
  );
}

// ---------- 作品タブ(編みかけが2つ以上のとき) ----------

function WorkTabs({
  works,
  current,
  names,
}: {
  works: Work[];
  current: string;
  names: Partial<Record<AnimalId, string>>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const labels = works.map((w) => `${w.kind}・${names[w.partner] ?? partnerName(w.partner)}`);

  // 今の作品のタブが見えるように、タブの列だけを横にずらす
  useLayoutEffect(() => {
    const el = box.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el && tab) el.scrollLeft = tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2;
  }, [current]);

  return (
    <div class="tabs" role="tablist" aria-label="編みかけの作品" ref={box}>
      {works.map((w, i) => (
        <button
          role="tab"
          aria-selected={w.id === current}
          onClick={() => w.id !== current && go(routes.knit(w.id), true)}
        >
          {labels.filter((l) => l === labels[i]).length > 1 ? w.name : labels[i]}
        </button>
      ))}
    </div>
  );
}

// ---------- 模様の回数(2つ目のカウンター) ----------

function PatternSheet({
  pattern,
  row,
  partName,
  onUpdate,
  onStep,
  onClose,
}: {
  pattern: Pattern | null;
  row: number;
  /** パーツがあるときは、どのパーツのカウンターか */
  partName: string | null;
  onUpdate: (p: Pattern | null) => void;
  onStep: (d: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(pattern?.name ?? '模様');
  const [every, setEvery] = useState(pattern?.everyRows ? String(pattern.everyRows) : '');

  /** 名前と「○段ごと」を反映する。「○段ごと」を変えたら、今の段から数え直す */
  const apply = (n: string, e: string) => {
    const base = pattern ?? newPattern(row);
    const everyRows = toPositiveInt(e);
    onUpdate({
      ...base,
      name: n.trim() || '模様',
      everyRows,
      baseRow: everyRows !== base.everyRows ? row : base.baseRow,
    });
  };

  const fields = (
    <>
      <div class="row">
        <input
          class="text-input"
          type="text"
          aria-label="カウンターの名前"
          placeholder="模様"
          value={name}
          onInput={(e) => {
            setName(e.currentTarget.value);
            if (pattern) apply(e.currentTarget.value, every);
          }}
        />
      </div>
      <div class="row">
        <input
          class="text-input number-input"
          type="text"
          inputMode="numeric"
          aria-label="何段ごとに1回進めるか"
          placeholder="4"
          value={every}
          onInput={(e) => {
            setEvery(e.currentTarget.value);
            if (pattern) apply(name, e.currentTarget.value);
          }}
        />
        段ごとに1回 自動で進める
      </div>
      <p class="field-note">入れなければ、「＋1回」で手で数えます</p>
      {partName && <p class="field-note">このカウンターは「{partName}」のものです</p>}
    </>
  );

  if (!pattern) {
    return (
      <Sheet title="模様の回数" onClose={onClose}>
        <p class="sheet-message">
          模様のくり返し回数など、段とは別に数えたいものに使います。「8段ごとに1回」のように入れると、段に合わせて自動で進みます
        </p>
        {fields}
        <div class="actions">
          <button class="secondary-button" onClick={onClose}>
            やめる
          </button>
          <button class="primary-button" onClick={() => apply(name, every)}>
            使いはじめる
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="模様の回数" onClose={onClose}>
      <p class="sheet-message">
        {pattern.everyRows ? `${pattern.everyRows}段ごとに自動で進みます` : '「＋1回」で手で数えます'}
      </p>
      <div class="pattern-count">
        <button class="secondary-button" aria-label="1回もどす" onClick={() => onStep(-1)} disabled={pattern.count === 0}>
          −1回
        </button>
        <span class="value" aria-live="polite">
          {pattern.count}
          <span class="unit">回</span>
        </span>
        <button class="primary-button" aria-label="1回すすめる" onClick={() => onStep(1)}>
          ＋1回
        </button>
      </div>
      {fields}
      <div class="actions">
        <button
          class="secondary-button"
          onClick={() => {
            onUpdate(null);
            onClose();
          }}
        >
          使わない
        </button>
        <button class="primary-button" onClick={onClose}>
          とじる
        </button>
      </div>
    </Sheet>
  );
}

// ---------- 音声入力(編む画面の中だけで使う) ----------

// 音声のボタンと、タップ場所に出す確かめ用の欄が同じ状態を見るための小さな入れ物
type VoiceState = {
  on: boolean;
  status: VoiceStatus;
  finalText: string;
  interim: string;
  /** 続けられずにオフになった理由(次にボタンを押すと消える) */
  notice: string;
};
const voiceListeners = new Set<(s: VoiceState) => void>();
let voiceState: VoiceState = { on: false, status: { kind: 'idle' }, finalText: '', interim: '', notice: '' };
let voiceSession: VoiceSession | null = null;
let voiceCount: ((n: number) => void) | null = null;
/** 1カウントになる言葉(設定で変えられる) */
let voiceWords: string[] = ['あみ'];

function setVoice(patch: Partial<VoiceState>) {
  voiceState = { ...voiceState, ...patch };
  voiceListeners.forEach((l) => l(voiceState));
}

function useVoice(): VoiceState {
  const [s, setS] = useState(voiceState);
  useEffect(() => {
    voiceListeners.add(setS);
    return () => {
      voiceListeners.delete(setS);
    };
  }, []);
  return s;
}

function startVoice() {
  setVoice({ on: true, finalText: '', interim: '', notice: '' });
  const session = new VoiceSession({
    words: countWordsFor(voiceWords),
    onCount: (n) => voiceCount?.(n),
    onStatus: (status) => voiceSession === session && setVoice({ status }),
    onTranscript: (finalText, interim) => voiceSession === session && setVoice({ finalText, interim }),
    onGiveUp: (message) => stopVoice(`音声:${message}`),
  });
  voiceSession = session;
  session.start();
}

function stopVoice(notice = '') {
  const session = voiceSession;
  voiceSession = null;
  session?.stop();
  setVoice({ on: false, status: { kind: 'idle' }, finalText: '', interim: '', notice });
}

function toggleVoice() {
  if (voiceState.on) stopVoice();
  else startVoice();
}

/** 編む画面から離れたとき・アプリを閉じたり切り替えたりしたときは、音声を自動でオフにする */
function useVoiceAutoOff() {
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden' && voiceState.on) stopVoice();
    };
    const onPageHide = () => voiceState.on && stopVoice();
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
      stopVoice();
    };
  }, []);
}

function VoiceButton() {
  const v = useVoice();
  return (
    <button
      class="tool voice"
      aria-pressed={v.on}
      aria-label={v.on ? '音声をとめる' : '音声で数える'}
      onClick={toggleVoice}
    >
      {v.on ? (
        <>
          <span class="live-dot" aria-hidden="true" />
          音声を
          <br />
          とめる
        </>
      ) : (
        '音声'
      )}
    </button>
  );
}

function KnitNote({ wakeLock }: { wakeLock: boolean }) {
  const v = useVoice();
  return <p class="knit-note">{v.notice || (wakeLock ? '編んでいる間は画面がスリープしません' : '')}</p>;
}

const STATUS_TEXT: Record<VoiceStatus['kind'], string> = {
  idle: '止まっています',
  starting: '準備しています…',
  listening: '聞いています',
  restarting: 'つなぎ直しています…',
  error: '',
};

function VoicePanel() {
  const v = useVoice();
  if (!v.on) return null;
  const isError = v.status.kind === 'error';
  return (
    <div class="voice-panel" aria-live="polite">
      <div class={`status${isError ? ' error' : ''}`}>
        <span class="on-label">音声オン</span>
        {v.status.kind === 'error'
          ? v.status.message
          : v.status.kind === 'listening'
            ? `${STATUS_TEXT.listening}。「${voiceWords[0]}」で1目`
            : STATUS_TEXT[v.status.kind]}
      </div>
      <div class="heard">
        <span>{v.finalText.slice(-40) || '…'}</span>
        {v.interim && <span class="interim"> {v.interim}</span>}
      </div>
    </div>
  );
}

// ---------- どこでもタップ ----------

function TapZone({
  onCount,
  onVoiceCount,
  unit,
}: {
  onCount: () => void;
  onVoiceCount: (n: number) => void;
  unit: string;
}) {
  const guard = useRef(new TapGuard());
  const [pressed, setPressed] = useState(false);
  const [pops, setPops] = useState<Pop[]>([]);
  const nextPop = useRef(0);

  // 音声で数えたときも同じ数え方を使う
  useEffect(() => {
    voiceCount = onVoiceCount;
  });
  useEffect(
    () => () => {
      voiceCount = null;
    },
    [],
  );

  const addPop = (x: number, y: number, text: string) => {
    const id = nextPop.current++;
    setPops((ps) => ps.concat({ id, x, y, text }));
  };

  const onDown = (e: PointerEvent) => {
    guard.current.down(e.pointerId);
    setPressed(true);
  };

  const onUp = (e: PointerEvent) => {
    const ok = guard.current.up(e.pointerId, performance.now());
    setPressed(false);
    if (!ok) return;
    onCount();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    addPop(e.clientX - rect.left, e.clientY - rect.top, '+1');
  };

  const onCancel = (e: PointerEvent) => {
    guard.current.cancel(e.pointerId);
    setPressed(false);
  };

  return (
    <div
      class={`tap-zone${pressed ? ' pressed' : ''}`}
      role="button"
      aria-label={`1${unit}カウント`}
      tabIndex={0}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCount();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span class="label">ひとめ ＋1</span>
      <span class="hint">どこをタップしても数えます</span>
      {pops.map((p) => (
        <span
          key={p.id}
          class="pop"
          style={{ left: `${p.x}px`, top: `${p.y}px` }}
          onAnimationEnd={() => setPops((ps) => ps.filter((x) => x.id !== p.id))}
        >
          {p.text}
        </span>
      ))}
      <VoicePanel />
    </div>
  );
}

// ---------- 目標なしの「今このくらい」 ----------

function ProgressPicker({
  value,
  color,
  onChange,
}: {
  value: number;
  color: string;
  /** save が false の間は指でなぞっている途中(離したときに保存する) */
  onChange: (percent: number, save: boolean) => void;
}) {
  const dragging = useRef(false);
  const at = (e: PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return snapProgress(((e.clientX - rect.left) / rect.width) * 100);
  };

  return (
    <div class="progress-pick">
      <div
        class="hit"
        role="slider"
        tabIndex={0}
        aria-label="今このくらい"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`だいたい ${value}%`}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          dragging.current = true;
          onChange(at(e), false);
        }}
        onPointerMove={(e) => dragging.current && onChange(at(e), false)}
        onPointerUp={(e) => {
          if (!dragging.current) return;
          dragging.current = false;
          onChange(at(e), true);
        }}
        onPointerCancel={() => {
          dragging.current = false;
          onChange(value, true);
        }}
        onKeyDown={(e) => {
          const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0;
          if (!d) return;
          e.preventDefault();
          onChange(snapProgress(value + d), true);
        }}
      >
        <span class="bar">
          <span style={{ width: `${value}%`, background: color }} />
        </span>
      </div>
      <span class="label">だいたい {value}%</span>
    </div>
  );
}

// ---------- +N ----------

function PlusSheet({
  unit,
  settings,
  onSettings,
  onAdd,
  onClose,
}: {
  unit: string;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onAdd: (n: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const n = toPositiveInt(text);
  const registered = n !== null && settings.quickAdds.includes(n);
  // 登録した数は長押しで並び替え(一番上=一番左の数が、編む画面のボタンに出る)
  const drag = useDragSort(settings.quickAdds, String, (quickAdds) => onSettings({ ...settings, quickAdds }));

  const register = () => {
    if (n === null || registered) return;
    onSettings({ ...settings, quickAdds: settings.quickAdds.concat(n) });
  };
  const remove = (q: number) =>
    onSettings({ ...settings, quickAdds: settings.quickAdds.filter((x) => x !== q) });

  return (
    <Sheet title={`まとめて数える(${unit})`} onClose={onClose}>
      {settings.quickAdds.length > 0 && (
        <div class="row">
          {drag.items.map((q) => (
            <span class="quick" key={q} {...drag.bind(String(q))}>
              <button class="chip" onClick={() => !editing && onAdd(q)}>
                ＋{q}
              </button>
              {editing && (
                <button class="remove" aria-label={`＋${q}を消す`} onClick={() => remove(q)}>
                  ×
                </button>
              )}
            </span>
          ))}
          <button class="link-button" onClick={() => setEditing(!editing)}>
            {editing ? 'できた' : '消す'}
          </button>
        </div>
      )}
      {settings.quickAdds.length > 1 && (
        <p class="field-note">長押しして動かすと並びを変えられます。一番左の数がボタンに出ます</p>
      )}
      <div class="row">
        ＋
        <input
          class="text-input number-input"
          type="text"
          inputMode="numeric"
          aria-label="数"
          placeholder="5"
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        {unit}
        <button class="link-button" disabled={n === null || registered} onClick={register}>
          {registered ? '登録ずみ' : 'よく使う数に登録'}
        </button>
      </div>
      <div class="actions">
        <button class="secondary-button" onClick={onClose}>
          やめる
        </button>
        <button class="primary-button" disabled={n === null} onClick={() => n && onAdd(n)}>
          {n ? `＋${n}${unit} すすめる` : 'すすめる'}
        </button>
      </div>
    </Sheet>
  );
}

// ---------- ほどく ----------

function UnravelSheet({
  hasStitches,
  onUnravel,
  onClose,
}: {
  hasStitches: boolean;
  onUnravel: (unit: 'stitch' | 'row', n: number) => void;
  onClose: () => void;
}) {
  const [unit, setUnit] = useState<'stitch' | 'row'>(hasStitches ? 'stitch' : 'row');
  const [text, setText] = useState('');
  const n = toPositiveInt(text);
  const label = unit === 'stitch' ? '目' : '段';

  return (
    <Sheet title="ほどく" onClose={onClose}>
      {hasStitches && (
        <div class="row">
          <button class="chip" aria-pressed={unit === 'stitch'} onClick={() => setUnit('stitch')}>
            目でほどく
          </button>
          <button class="chip" aria-pressed={unit === 'row'} onClick={() => setUnit('row')}>
            段でほどく
          </button>
        </div>
      )}
      <div class="row">
        <input
          class="text-input number-input"
          type="text"
          inputMode="numeric"
          aria-label="ほどく数"
          placeholder="1"
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        {label} もどす
      </div>
      <p class="field-note">まちがえてほどいたときは「取り消し」で元に戻せます</p>
      <div class="actions">
        <button class="secondary-button" onClick={onClose}>
          やめる
        </button>
        <button class="primary-button" disabled={n === null} onClick={() => n && onUnravel(unit, n)}>
          {n ? `${n}${label} ほどく` : 'ほどく'}
        </button>
      </div>
    </Sheet>
  );
}

