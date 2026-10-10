// 遊び方のヘルプ。文は src/data/help.ts に書く
import { Icon } from '../components/Icon';
import { HELP, HELP_LEAD } from '../data/help';
import { routes } from '../lib/router';

export function Help() {
  return (
    <main class="screen">
      <div class="top-bar">
        <a class="round-button" href={routes.settings()} aria-label="設定へ戻る">
          <Icon name="back" />
        </a>
        <h1>遊び方のヘルプ</h1>
      </div>

      <div class="help">
        <p class="help-lead card">{HELP_LEAD}</p>
        {HELP.map((group) => (
          <section class="help-group">
            <h2>{group.title}</h2>
            {group.items.map((item) => (
              <div class="help-item card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
