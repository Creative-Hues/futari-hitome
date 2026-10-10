// 下のメニュー(試作の見た目):ホーム・アルバム・なかま
import { routes } from '../lib/router';
import { Icon } from './Icon';

export function BottomNav({ current }: { current: 'home' | 'album' | 'partners' }) {
  return (
    <nav class="bottom-nav" aria-label="メニュー">
      <a href={routes.home()} aria-current={current === 'home' ? 'page' : undefined}>
        <Icon name="home" />
        ホーム
      </a>
      <a href={routes.album()} aria-current={current === 'album' ? 'page' : undefined}>
        <Icon name="album" />
        アルバム
      </a>
      <a href={routes.partners()} aria-current={current === 'partners' ? 'page' : undefined}>
        <Icon name="friends" />
        なかま
      </a>
    </nav>
  );
}
