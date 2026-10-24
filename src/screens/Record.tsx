// 完成記録:写真・感想を入れる。日付・日数・編んだ時間・最後の数は自動で入る
import { useEffect, useRef, useState } from 'preact/hooks';
import { BackButton } from '../components/BackButton';
import { InteriorShapePicker } from '../components/InteriorShapePicker';
import { MemoFields } from '../components/MemoFields';
import { Partner } from '../components/Partner';
import { PhotoList } from '../components/PhotoList';
import { RecordFacts } from '../components/RecordFacts';
import { defaultInteriorShape } from '../data/wear';
import { getWork, saveWork, type Work } from '../lib/db';
import { useLooks } from '../lib/looks';
import { go, routes } from '../lib/router';

export function Record({ id }: { id: string }) {
  const [work, setWork] = useState<Work | null>(null);
  const looks = useLooks();
  const [missing, setMissing] = useState(false);
  const workRef = useRef<Work | null>(null);

  useEffect(() => {
    getWork(id).then((w) => {
      if (!w) return setMissing(true);
      if (w.status !== 'done') return go(routes.knit(w.id), true);
      workRef.current = w;
      setWork(w);
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
  const name = looks?.name(animal) ?? '';

  return (
    <main class="screen">
      <div class="top-bar">
        <BackButton fallback={routes.albumWork(work.id)} />
        <h1>完成記録</h1>
      </div>

      <div class="record">
        <div class="gift card">
          <span class="thumb">
            {looks && <Partner animal={animal} look={looks.look(animal)} name={name} color={work.color} progress={1} />}
          </span>
          <span>
            <span class="gift-name">{work.name}</span>
            <span class="gift-sub">{name}が もらってくれました</span>
            <a class="gift-link" href={routes.partner(animal)}>
              {work.department === 'interior' ? 'パートナーの画面で部屋に飾る' : 'パートナーの画面で身につける'}
            </a>
          </span>
        </div>

        {work.department === 'interior' && (
          <section class="field">
            <h2 class="field-title">部屋に飾るときの絵</h2>
            <InteriorShapePicker
              value={work.interiorShape ?? defaultInteriorShape(work.kind)}
              color={work.color}
              onChange={(interiorShape) => update({ interiorShape })}
            />
          </section>
        )}

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
        <BackButton fallback={routes.home()} />
      </div>
      <p>作品が見つかりませんでした</p>
    </main>
  );
}
