// なかま:6匹の一覧(Partners.mock.html の見た目)。まだ一緒に編んでいない子は「まだ会っていない」
import { BottomNav } from '../components/BottomNav';
import { Partner } from '../components/Partner';
import { ANIMALS, DECORATION_NAMES } from '../data/animals';
import { DEPARTMENTS } from '../data/departments';
import type { AnimalId } from '../lib/db';
import { useLooks } from '../lib/looks';
import { routes } from '../lib/router';

/** その子の担当の部門(「頭 ・ 小物やインテリア」) */
export function partsOf(animal: AnimalId): string {
  return DEPARTMENTS.filter((d) => d.partners.includes(animal))
    .map((d) => d.name)
    .join(' ・ ');
}

export function Partners() {
  const looks = useLooks();

  return (
    <main class="screen with-nav">
      <header class="home-header">
        <h1>なかま</h1>
      </header>

      <div class="friends-grid">
        {looks &&
          ANIMALS.map((a) => {
            const p = looks.partners[a];
            const name = looks.name(a);
            return (
              <a class="friend-card card" href={routes.partner(a)} data-unmet={!p.met || undefined}>
                <span class="pic">
                  <Partner animal={a} look={looks.look(a)} name={name} progress={0.5} live />
                </span>
                <span class="name">{name}</span>
                {p.met ? (
                  <>
                    <span class="sub">{partsOf(a)}</span>
                    <span class="sub">頭飾り:{DECORATION_NAMES[p.decoration]}</span>
                  </>
                ) : (
                  <>
                    <span class="sub">{partsOf(a)}</span>
                    <span class="unmet">まだ会っていない</span>
                  </>
                )}
              </a>
            );
          })}
      </div>

      <BottomNav current="partners" />
    </main>
  );
}
