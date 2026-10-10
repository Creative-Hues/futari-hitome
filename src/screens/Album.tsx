// 作品アルバム:完成した作品を完成した日の新しい順に並べる。パートナーごとに絞り込める
import { useEffect, useState } from 'preact/hooks';
import { BottomNav } from '../components/BottomNav';
import { Partner } from '../components/Partner';
import { PhotoThumb } from '../components/PhotoList';
import { ANIMALS } from '../data/animals';
import { coverPhotos, type AnimalId, type Photo, type Work } from '../lib/db';
import { useLooks } from '../lib/looks';
import { formatDate } from '../lib/knitTime';
import { isPersisted } from '../lib/persist';
import { routes } from '../lib/router';

export function Album() {
  const looks = useLooks();
  const [covers, setCovers] = useState<Record<string, Photo>>({});
  const [filter, setFilter] = useState<AnimalId | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  const done: Work[] | null = looks
    ? looks.works
        .filter((w) => w.status === 'done')
        .sort((a, b) => ((a.finishedAt ?? '') < (b.finishedAt ?? '') ? 1 : -1))
    : null;

  useEffect(() => {
    isPersisted().then(setPersisted);
  }, []);
  useEffect(() => {
    if (done) coverPhotos(done.map((w) => w.id)).then(setCovers);
  }, [looks]);

  const owner = (w: Work) => w.giftedTo ?? w.partner;
  const animals = ANIMALS.filter((a) => done?.some((w) => owner(w) === a));
  const shown = done?.filter((w) => !filter || owner(w) === filter) ?? [];

  return (
    <main class="screen with-nav">
      <header class="home-header">
        <h1>アルバム</h1>
      </header>

      {animals.length > 1 && (
        <div class="chips album-filter" role="group" aria-label="パートナーで絞り込む">
          <button class="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            すべて
          </button>
          {animals.map((a) => (
            <button class="chip" aria-pressed={filter === a} onClick={() => setFilter(a)}>
              {looks?.name(a)}
            </button>
          ))}
        </div>
      )}

      {done && done.length === 0 && (
        <p class="wip-empty album-empty">まだ完成した作品はありません。編み終わったら、編む画面の「完成!」から記録できます</p>
      )}

      <div class="album-grid">
        {shown.map((w) => (
          <a class="album-card card" href={routes.albumWork(w.id)}>
            <span class="cover">
              {covers[w.id] ? (
                <PhotoThumb photo={covers[w.id]} />
              ) : (
                <Partner
                  animal={owner(w)}
                  look={looks?.look(owner(w))}
                  name={looks?.name(owner(w))}
                  color={w.color}
                  progress={1}
                />
              )}
            </span>
            <span class="name">{w.name}</span>
            <span class="sub">
              {w.finishedAt ? formatDate(w.finishedAt) : ''} ・ {looks?.name(owner(w))}
            </span>
          </a>
        ))}
      </div>

      <p class="storage-note">
        記録と写真はこの端末の中に保存しています
        {persisted === true && '(消されにくい設定:オン)'}
        {persisted === false && '(消されにくい設定:まだ)'}
      </p>

      <BottomNav current="album" />
    </main>
  );
}
