// 端末の時計から、朝・昼・夕方・夜を決める(天気には連動しない)
import { useEffect, useState } from 'preact/hooks';
import { PERIOD_START, type TimeOfDay } from '../config/sky';

const ORDER: TimeOfDay[] = ['morning', 'day', 'evening', 'night'];
const CHECK_MS = 60_000;

export function timeOfDay(date: Date): TimeOfDay {
  const h = date.getHours();
  // 始まる時刻が h 以下で、いちばん遅いもの。どれにも当たらなければ(0〜5時)夜
  let found: TimeOfDay = 'night';
  for (const t of ORDER) if (PERIOD_START[t] <= h) found = t;
  return found;
}

/** アドレスの ?sky=… を読む(# の前でも後ろでもよい)。正しくない値は null */
export function skyParam(search: string, hash: string): TimeOfDay | null {
  const query = (h: string) => (h.includes('?') ? h.slice(h.indexOf('?') + 1) : '');
  for (const q of [search.replace(/^\?/, ''), query(hash)]) {
    const t = new URLSearchParams(q).get('sky');
    if (ORDER.includes(t as TimeOfDay)) return t as TimeOfDay;
  }
  return null;
}

/** 確認用:アドレスの最後に ?sky=morning / day / evening / night を付けると、その時間帯の空で表示する。
 *  保存はしないので、付けたアドレスで開いた画面だけに効く */
function override(): TimeOfDay | null {
  return skyParam(location.search, location.hash);
}

/** 今の時間帯。1分ごとと、アプリに戻ってきたときに確かめ直す */
export function useTimeOfDay(): TimeOfDay {
  const [t, setT] = useState(() => override() ?? timeOfDay(new Date()));
  useEffect(() => {
    if (override()) return;
    const check = () => setT(timeOfDay(new Date()));
    const id = setInterval(check, CHECK_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return t;
}
