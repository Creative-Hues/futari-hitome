// 戻るボタン。アプリの中で来た画面があればそこへ、なければ決まった画面(fallback)へ戻る
import { back } from '../lib/router';
import { Icon } from './Icon';

export function BackButton({ fallback, label = '戻る' }: { fallback: string; label?: string }) {
  return (
    <a
      class="round-button"
      href={fallback}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        back(fallback);
      }}
    >
      <Icon name="back" />
    </a>
  );
}
