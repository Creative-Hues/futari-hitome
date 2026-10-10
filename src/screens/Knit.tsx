import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { Partner, type PartnerMotion } from '../components/Partner';
import { Scene } from '../components/Scene';
import { Sheet } from '../components/Sheet';
import { add, progress, pushHistory, snapProgress, undo, unravel, workProgress, type Count } from '../lib/counter';
import {
  getPartner,
  getSettings,
  getWork,
  saveSettings,
  saveWork,
  type PartnerData,
  type Settings,
  type Work,
} from '../lib/db';
import { routes } from '../lib/router';
import { TapGuard } from '../lib/tapGuard';
import { VoiceSession, type VoiceStatus } from '../lib/voice';
import { useWakeLock } from '../lib/wakeLock';

type Pop = { id: number; x: number; y: number; text: string };

export function Knit({ id }: { id: string }) {
  const [work, setWork] = useState<Work | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [missing, setMissing] = useState(false);
  const [sheet, setSheet] = useState<'plus' | 'unravel' | null>(null);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [motion, setMotion] = useState<PartnerMotion | null>(null);
  const motionCount = useRef(0);
  const workRef = useRef<Work | null>(null);
  const wakeLock = useWakeLock();
  useVoiceAutoOff();

  useEffect(() => {
    getWork(id).then((w) => {
      if (!w) return setMissing(true);
      workRef.current = w;
      setWork(w);
      getPartner(w.partner).then(setPartner);
    });
    getSettings().then(setSettings);
  }, [id]);

  /** パートナーに編む・ほどくの動きをさせる(数え方には関わらない) */
  const move = (kind: PartnerMotion['kind']) => setMotion({ kind, n: ++motionCount.current });

  /** 数を変えて保存する(取り消し用に、変える前の状態を残す)。変わったら true */
  const change = (next: (c: Count, w: Work) => Count): boolean => {
    const w = workRef.current;
    if (!w) return false;
    const count = next(w.count, w);
    if (count.row === w.count.row && count.stitch === w.count.stitch) return false;
    const updated: Work = {
      ...w,
      count,
      history: pushHistory(w.history, w.count),
      updatedAt: new Date().toISOString(),
    };
    workRef.current = updated;
    setWork(updated);
    saveWork(updated);
    return true;
  };

  const countUp = (n: number) => {
    if (change((c, w) => add(c, n, w.stitchesPerRow))) move('knit');
  };

  /** 目標なしの作品の「今このくらい」。数とは別なので取り消しの対象にはしない */
  const setManual = (percent: number, save: boolean) => {
    const w = workRef.current;
    if (!w) return;
    const updated: Work = { ...w, manualProgress: percent, updatedAt: save ? new Date().toISOString() : w.updatedAt };
    workRef.current = updated;
    setWork(updated);
    if (save) saveWork(updated);
  };

  const undoLast = () => {
    const w = workRef.current;
    if (!w) return;
    const r = undo(w.history);
    if (!r) return;
    const updated: Work = { ...w, count: r.count, history: r.history, updatedAt: new Date().toISOString() };
    workRef.current = updated;
    setWork(updated);
    saveWork(updated);
  };

  if (missing) {
    return (
      <main class="screen">
        <div class="top-bar">
          <a class="round-button" href={routes.home()} aria-label="ホームへ戻る">
            <Icon name="back" />
          </a>
        </div>
        <p>作品が見つかりませんでした</p>
      </main>
    );
  }
  if (!work || !settings) return <main class="screen knit" />;

  const perRow = work.stitchesPerRow;
  const p = progress(work.count, work.goalRows, perRow);
  const unit = perRow ? '目' : '段';
  const quick = settings.quickAdds[0];

  return (
    <main class="screen knit">
      <div class="top-bar">
        <a class="round-button" href={routes.home()} aria-label="ホームへ戻る">
          <Icon name="back" />
        </a>
        <h1>{work.name}</h1>
      </div>

      <section class="meadow" aria-label="パートナー">
        <Scene kind="meadow" />
        <Partner
          animal={work.partner}
          decoration={partner?.decoration}
          color={work.color}
          progress={workProgress(work)}
          motion={motion}
          live
          interactive
        />
      </section>

      <div class="stats">
        {p === null && (
          <ProgressPicker value={work.manualProgress} color={work.color} onChange={setManual} />
        )}
        {p !== null && (
          <div class="bar" role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${p * 100}%`, background: work.color }} />
          </div>
        )}
        <div class="numbers" aria-live="polite">
          <span class="big">
            {work.count.row}
            <span class="unit">{work.goalRows ? ` / ${work.goalRows}段` : ' 段'}</span>
          </span>
          {perRow && (
            <span class="mid">
              {work.count.stitch}
              <span class="unit"> / {perRow}目</span>
            </span>
          )}
        </div>
      </div>

      <TapZone onCount={() => countUp(1)} unit={unit} onVoiceCount={countUp} />

      <div class="tools">
        <button class="tool" onClick={undoLast} disabled={work.history.length === 0}>
          取り消し
        </button>
        <button class="tool" onClick={() => setSheet('plus')}>
          {quick ? `＋${quick}` : '＋N'}
        </button>
        <button class="tool" onClick={() => setSheet('unravel')}>
          ほどく
        </button>
        <VoiceButton />
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
            if (change((c, w) => unravel(c, u, n, w.stitchesPerRow))) move('unravel');
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </main>
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
  listening: '聞いています。「あみ」で1目',
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
        {v.status.kind === 'error' ? v.status.message : STATUS_TEXT[v.status.kind]}
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

function toPositiveInt(s: string): number | null {
  const half = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const n = parseInt(half, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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
          {settings.quickAdds.map((q) => (
            <span class="quick">
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

