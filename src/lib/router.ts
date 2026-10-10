// 画面の行き先(アドレスの # のあとで決める。サーバーがなくても動く)
import { useEffect, useState } from 'preact/hooks';

export const routes = {
  home: () => '#/',
  newWork: () => '#/new',
  knit: (id: string) => `#/knit/${encodeURIComponent(id)}`,
};

export function go(hash: string, replace = false) {
  if (replace) location.replace(hash);
  else location.hash = hash;
}

export function useHash(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}
