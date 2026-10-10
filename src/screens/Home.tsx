import { useEffect, useState } from 'preact/hooks';
import { Partner } from '../components/Partner';
import { Scene } from '../components/Scene';
import { ANIMAL_NAMES } from '../data/animals';
import { departmentName } from '../data/departments';
import { workProgress } from '../lib/counter';
import { listPartners, listWorks, type AnimalId, type PartnerData, type Work } from '../lib/db';
import { go, routes } from '../lib/router';

export function Home() {
  const [works, setWorks] = useState<Work[] | null>(null);
  const [partners, setPartners] = useState<Record<AnimalId, PartnerData> | null>(null);

  useEffect(() => {
    listWorks().then(setWorks);
    listPartners().then(setPartners);
  }, []);

  const wip = works?.filter((w) => w.status === 'wip');
  // 部屋にいるのは最後に編んだ子(いちばん最近数えた作品の子)
  const last = works?.reduce<Work | null>((a, w) => (!a || w.updatedAt > a.updatedAt ? w : a), null);
  const animal = last?.partner ?? 'sheep';

  return (
    <main class="screen">
      <header class="home-header">
        <h1>ふたりひとめ</h1>
      </header>

      <section class="room" aria-label="パートナーの部屋">
        <Scene kind="room" />
        {works && partners && (
          <Partner
            animal={animal}
            decoration={partners[animal].decoration}
            color={last?.color}
            progress={last ? workProgress(last) : 0}
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
        {wip && wip.length === 0 && <p class="wip-empty">まだありません。下のボタンから始めましょう</p>}
        {wip?.map((w) => <WorkCard key={w.id} work={w} partner={partners?.[w.partner]} />)}
        <button class="primary-button" onClick={() => go(routes.newWork())}>
          ＋ 新しく編む
        </button>
      </section>
    </main>
  );
}

function WorkCard({ work, partner }: { work: Work; partner?: PartnerData }) {
  const p = workProgress(work);
  return (
    <a class="work-card card" href={routes.knit(work.id)}>
      <span class="thumb">
        <Partner animal={work.partner} decoration={partner?.decoration} color={work.color} progress={p} />
      </span>
      <span class="info">
        <span class="name">{work.name}</span>
        <span class="sub">
          {departmentName(work.department)} ・ {ANIMAL_NAMES[work.partner]} と 編んでいる
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
