// 完成記録:写真・感想を入れる。日付・日数・編んだ時間・最後の数は自動で入る
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { MemoFields } from '../components/MemoFields';
import { Partner } from '../components/Partner';
import { PhotoList } from '../components/PhotoList';
import { RecordFacts } from '../components/RecordFacts';
import { ANIMAL_NAMES } from '../data/animals';
import { getPartner, getWork, saveWork, type PartnerData, type Work } from '../lib/db';
import { go, routes } from '../lib/router';

export function Record({ id }: { id: string }) {
  const [work, setWork] = useState<Work | null>(null);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [missing, setMissing] = useState(false);
  const workRef = useRef<Work | null>(null);

  useEffect(() => {
    getWork(id).then((w) => {
      if (!w) return setMissing(true);
      if (w.status !== 'done') return go(routes.knit(w.id), true);
      workRef.current = w;
      setWork(w);
      getPartner(w.giftedTo ?? w.partner).then(setPartner);
    });
  }, [id]);

  /** 入れた分はその場で保存 */
  const update = (patch: Partial<Work>) => {
    const w = workRef.current;
    if (!w) return;
    const updated = { ...w, ...patch };
    workRef.current = updated;
    setWork(updated);
    saveWork(updated);
  };

  if (missing) return <Missing />;
  if (!work) return <main class="screen" />;
  const animal = work.giftedTo ?? work.partner;

  return (
    <main class="screen">
      <div class="top-bar">
        <a class="round-button" href={routes.albumWork(work.id)} aria-label="記録へ戻る">
          <Icon name="back" />
        </a>
        <h1>完成記録</h1>
      </div>

      <div class="record">
        <div class="gift card">
          <span class="thumb">
            <Partner animal={animal} decoration={partner?.decoration} color={work.color} progress={1} />
          </span>
          <span>
            <span class="gift-name">{work.name}</span>
            <span class="gift-sub">{ANIMAL_NAMES[animal]}が もらってくれました</span>
          </span>
        </div>

        <section class="field">
          <h2 class="field-title">完成した作品の写真</h2>
          <PhotoList workId={work.id} kind="finished" />
          <p class="field-note">1枚目がアルバムの表紙になります</p>
        </section>

        <div class="field">
          <label for="impression">感想</label>
          <textarea
            id="impression"
            class="text-input textarea"
            rows={4}
            placeholder="編んでみてどうだった?"
            value={work.impression}
            onInput={(e) => update({ impression: e.currentTarget.value })}
          />
        </div>

        <section class="field">
          <h2 class="field-title">記録</h2>
          <RecordFacts work={work} />
        </section>

        <section class="field">
          <h2 class="field-title">作品メモ</h2>
          <MemoFields memo={work.memo} onChange={(memo) => update({ memo })} />
        </section>

        <section class="field">
          <h2 class="field-title">編み図の写真</h2>
          <PhotoList workId={work.id} kind="pattern" />
        </section>

        <button class="primary-button" onClick={() => go(routes.albumWork(work.id), true)}>
          アルバムで見る
        </button>
      </div>
    </main>
  );
}

export function Missing() {
  return (
    <main class="screen">
      <div class="top-bar">
        <a class="round-button" href={routes.home()} aria-label="ホームへ戻る">
          <Icon name="back" />
        </a>
      </div>
      <p>作品が見つかりませんでした</p>
    </main>
  );
}
