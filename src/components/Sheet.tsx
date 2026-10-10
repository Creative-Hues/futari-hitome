import type { ComponentChildren } from 'preact';

/** 下から出るシート。外側を押すと閉じる。tall は中身が多いとき(高めに開き、中でスクロールする) */
export function Sheet({
  title,
  onClose,
  tall = false,
  children,
}: {
  title: string;
  onClose: () => void;
  tall?: boolean;
  children: ComponentChildren;
}) {
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class={`sheet${tall ? ' tall' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** 「〜しますか?」の確認 */
export function ConfirmSheet({
  title,
  message,
  ok,
  onOk,
  onClose,
}: {
  title: string;
  message?: ComponentChildren;
  ok: string;
  onOk: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      {message && <p class="sheet-message">{message}</p>}
      <div class="actions">
        <button class="secondary-button" onClick={onClose}>
          やめる
        </button>
        <button class="primary-button" onClick={onOk}>
          {ok}
        </button>
      </div>
    </Sheet>
  );
}
