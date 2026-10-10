import { useEffect, useState } from 'preact/hooks';
import roomUrl from '../../assets/backgrounds/room_example_0.svg';
import { Partner } from '../components/Partner';
import { ANIMAL_NAMES, departmentName } from '../data/departments';
import { progress } from '../lib/counter';
import { listWorks, type Work } from '../lib/db';
import { go, routes } from '../lib/router';

export function Home() {
  const [works, setWorks] = useState<Work[] | null>(null);

  useEffect(() => {
    listWorks().then((all) => setWorks(all.filter((w) => w.status === 'wip')));
  }, []);

  return (
    <main class="screen">
      <header class="home-header">
        <h1>ふたりひとめ</h1>
      </header>

      <section class="room" aria-label="パートナーの部屋">
        <img class="room-bg" src={roomUrl} alt="" draggable={false} />
        <Partner label="ひつじ" />
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
        {works && works.length === 0 && <p class="wip-empty">まだありません。下のボタンから始めましょう</p>}
        {works?.map((w) => <WorkCard key={w.id} work={w} />)}
        <button class="primary-button" onClick={() => go(routes.newWork())}>
          ＋ 新しく編む
        </button>
      </section>
    </main>
  );
}

function WorkCard({ work }: { work: Work }) {
  const p = progress(work.count, work.goalRows, work.stitchesPerRow);
  return (
    <a class="work-card card" href={routes.knit(work.id)}>
      <span class="thumb">
        <Partner />
      </span>
      <span class="info">
        <span class="name">{work.name}</span>
        <span class="sub">
          {departmentName(work.department)} ・ {ANIMAL_NAMES[work.partner]} と 編んでいる
        </span>
        {p !== null && (
          <span class="bar">
            <span style={{ width: `${p * 100}%`, background: work.color }} />
          </span>
        )}
      </span>
      <span class="amount">
        {work.goalRows ? `${work.count.row}/${work.goalRows}段` : `${work.count.row}段`}
      </span>
    </a>
  );
}
