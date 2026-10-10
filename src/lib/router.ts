// 画面の行き先(アドレスの # のあとで決める。サーバーがなくても動く)
import { useEffect, useState } from 'preact/hooks';

export const routes = {
  home: () => '#/',
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

export function go(hash: string, replace = false) {
  if (replace) location.replace(hash);
  else location.hash = hash;
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
