// 編む画面でスリープを防ぐ(Screen Wake Lock)。使えない端末では何もしない。
import { useEffect, useState } from 'preact/hooks';

export function useWakeLock(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (disposed) {
          sentinel.release();
          return;
        }
        setActive(true);
        sentinel.addEventListener('release', () => setActive(false));
      } catch {
        setActive(false);
      }
    };

    // アプリから離れると自動で外れるので、戻ってきたら取り直す
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release();
    };
  }, []);

  return active;
}
