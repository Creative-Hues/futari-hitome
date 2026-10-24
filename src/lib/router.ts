// 画面の行き先(アドレスの # のあとで決める。サーバーがなくても動く)
import { useEffect, useState } from 'preact/hooks';

export const routes = {
  home: () => '#/',
  /** ホーム(「お休み中」を開いた状態) */
  pausedHome: () => '#/?paused',
  newWork: () => '#/new',
  knit: (id: string) => `#/knit/${encodeURIComponent(id)}`,
  record: (id: string) => `#/record/${encodeURIComponent(id)}`,
  album: () => '#/album',
  albumWork: (id: string) => `#/album/${encodeURIComponent(id)}`,
  partners: () => '#/partners',
  partner: (animal: string) => `#/partner/${animal}`,
  settings: () => '#/settings',
  roomSettings: () => '#/settings/room',
  help: () => '#/settings/help',
};

// ---------- 来た画面へ戻る ----------
// 画面を移るたびに「アプリの中で何画面目か」を history.state に覚えておく。
// 0画面目(アプリを開いてすぐ)でなければ、戻るボタンはブラウザの「戻る」と同じように来た画面へ戻る。

const savedDepth = (): number | null => {
  const d = (history.state as { depth?: unknown } | null)?.depth;
  return typeof d === 'number' ? d : null;
};

let depth = savedDepth() ?? 0;
/** 置き換えで移っている途中(何画面目かは変えない) */
let replacing = false;

if (savedDepth() === null) history.replaceState({ ...history.state, depth }, '');

window.addEventListener('hashchange', () => {
  const d = savedDepth();
  if (d !== null && !replacing) {
    // 戻る・進むで来た画面
    depth = d;
  } else {
    if (!replacing) depth += 1;
    history.replaceState({ ...history.state, depth }, '');
  }
  replacing = false;
});

export function go(hash: string, replace = false) {
  if (replace) {
    // 同じ画面への置き換えでは hashchange が来ないので、印を付けない
    if (location.hash === hash) return;
    replacing = true;
    location.replace(hash);
  } else location.hash = hash;
}

/** アプリの中で来た画面があるか */
export function canGoBack(): boolean {
  return depth > 0;
}

/** 来た画面へ戻る。来た画面がなければ(アプリを開いてすぐなど)、決まった画面へ */
export function back(fallback: string) {
  if (canGoBack()) history.back();
  else go(fallback, true);
}

/** # のあとの行き先。確認用の ?sky=… などは行き先に含めない */
const route = () => location.hash.split('?')[0];

export function useHash(): string {
  const [hash, setHash] = useState(route);
  useEffect(() => {
    const onChange = () => setHash(route());
    window.addEventListener('hashchange', onChange);
    // 最初に表示してから、ここで見張り始めるまでの間に行き先が変わっていても取りこぼさない
    onChange();
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}
