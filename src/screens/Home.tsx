import { useEffect, useState } from 'preact/hooks';
import { BottomNav } from '../components/BottomNav';
import { Partner } from '../components/Partner';
import { Scene } from '../components/Scene';
import { ANIMAL_NAMES } from '../data/animals';
import { departmentName } from '../data/departments';
import { workProgress } from '../lib/counter';
import { listPartners, listWorks, reorderWorks, type AnimalId, type PartnerData, type Work } from '../lib/db';
import { go, routes } from '../lib/router';
import { useDragSort } from '../lib/useDragSort';

export function Home() {
  const [works, setWorks] = useState<Work[] | null>(null);
  const [partners, setPartners] = useState<Record<AnimalId, PartnerData> | null>(null);

  useEffect(() => {
    listWorks().then(setWorks);
    listPartners().then(setPartners);
  }, []);

  const wip = works?.filter((w) => w.status === 'wip') ?? [];
  // 編みかけの作品は長押しで並び替え(編む画面のタブも同じ並びになる)
  const drag = useDragSort(
    wip,
    (w) => w.id,
    (next) => {
      const done = works?.filter((w) => w.status !== 'wip') ?? [];
      setWorks(next.map((w, i) => ({ ...w, order: i })).concat(done));
      reorderWorks(next.map((w) => w.id));
    },
  );

  // 部屋にいるのは最後に編んだ子(いちばん最近数えた作品の子)。持っているのはその子が今編んでいる作品
  const last = works?.reduce<Work | null>((a, w) => (!a || w.updatedAt > a.updatedAt ? w : a), null);
  const animal = last?.partner ?? 'sheep';
  const holding = works?.find((w) => w.id === partners?.[animal].knittingWorkId && w.status === 'wip');

  return (
    <main class="screen with-nav">
      <header class="home-header">
        <h1>ふたりひとめ</h1>
      </header>

      <section class="room" aria-label="パートナーの部屋">
        <Scene kind="room" />
        {works && partners && (
          <Partner
            animal={animal}
            decoration={partners[animal].decoration}
            color={holding?.color ?? last?.color}
            progress={holding ? workProgress(holding) : 0}
            live
            interactive
          />
        )}
        <p class="bubble">
          きょうも
          <br />
          いっしょに
          <br />
          あもうね
        </p>
      </section>

      <section class="wip" aria-labelledby="wip-title">
        <h2 id="wip-title">編みかけの作品</h2>
        {works && wip.length === 0 && <p class="wip-empty">まだありません。下のボタンから始めましょう</p>}
        {drag.items.map((w) => (
          <WorkCard
            key={w.id}
            work={w}
            partner={partners?.[w.partner]}
            knittingOther={!!partners && !!partners[w.partner].knittingWorkId && partners[w.partner].knittingWorkId !== w.id}
            bind={drag.bind(w.id)}
          />
        ))}
        {wip.length > 1 && <p class="wip-hint">長押しして動かすと、並びを変えられます</p>}
        <button class="primary-button" onClick={() => go(routes.newWork())}>
          ＋ 新しく編む
        </button>
      </section>

      <BottomNav current="home" />
    </main>
  );
}

function WorkCard({
  work,
  partner,
  knittingOther,
  bind,
}: {
  work: Work;
  partner?: PartnerData;
  /** その子がいま別の作品を編んでいる */
  knittingOther: boolean;
  bind: object;
}) {
  const p = workProgress(work);
  const name = ANIMAL_NAMES[work.partner];
  return (
    <a class="work-card card" href={routes.knit(work.id)} draggable={false} {...bind}>
      <span class="thumb">
        <Partner animal={work.partner} decoration={partner?.decoration} color={work.color} progress={p} />
      </span>
      <span class="info">
        <span class="name">{work.name}</span>
        <span class="sub">
          {departmentName(work.department)} ・ {knittingOther ? `${name} は べつの作品を編み中` : `${name} と 編んでいる`}
        </span>
        <span class="bar">
          <span style={{ width: `${p * 100}%`, background: work.color }} />
        </span>
      </span>
      <span class="amount">
        {work.goalRows ? `${work.count.row}/${work.goalRows}段` : `${work.count.row}段`}
      </span>
    </a>
  );
}
