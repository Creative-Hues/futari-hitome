// iPhoneで、ダブルタップや2本指で画面が拡大されないようにする。
// CSS の touch-action: manipulation と viewport の設定に加えて、ここで止めきれない分を止める。

/** 文字を入力する場所。ここには何もしない(タップしても文字が打てなくなるのを防ぐ) */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** ボタンなど押す場所。続けて押す操作(取り消しを2回など)を止めないよう、ここも何もしない */
const CONTROLS = 'button, a, label, summary, [role="button"]:not(.tap-zone)';

const DOUBLE_TAP_MS = 300;

export function preventZoom(): void {
  // 2本指で広げる拡大(iPhoneのSafariだけにある gesture イベント)
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }

  // ダブルタップ拡大。ボタンや入力欄以外で、0.3秒以内に2回触れたら2回目の標準の動きを止める
  // (カウントする場所は指が離れたとき pointerup で数えているので、ここで止めても数はずれない)
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = e.timeStamp;
      const quick = now - lastTouchEnd < DOUBLE_TAP_MS;
      lastTouchEnd = now;
      if (!quick || e.touches.length > 0) return;
      const target = e.target as Element | null;
      if (target?.closest?.(TEXT_ENTRY) || target?.closest?.(CONTROLS)) return;
      e.preventDefault();
    },
    { passive: false },
  );

  // PCなどでのダブルクリック拡大・文字選択も止める(入力欄は除く)
  document.addEventListener('dblclick', (e) => {
    if (!(e.target as Element | null)?.closest?.(TEXT_ENTRY)) e.preventDefault();
  });
}
