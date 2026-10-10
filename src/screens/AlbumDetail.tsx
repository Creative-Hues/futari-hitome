// アルバムの記録の画面:完成記録の中身をすべて表示する。完成の取り消し(編みかけに戻す)もここ
import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { Partner } from '../components/Partner';
import { PhotoList } from '../components/PhotoList';
import { RecordFacts } from '../components/RecordFacts';
import { ConfirmSheet } from '../components/Sheet';
import { ANIMAL_NAMES } from '../data/animals';
import { getPartner, getWork, listPhotos, reopenWork, type PartnerData, type Photo, type Work } from '../lib/db';
import { go, routes } from '../lib/router';
import { Missing } from './Record';

export function AlbumDetail({ id }: { id: string }) {
  const [work, setWork] = useState<Work | null>(null);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [missing, setMissing] = useState(false);
  const [finished, setFinished] = useState<Photo[] | null>(null);
  const [patterns, setPatterns] = useState<Photo[] | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    getWork(id).then((w) => {
      if (!w) return setMissing(true);
      if (w.status !== 'done') return go(routes.knit(w.id), true);
      setWork(w);
      getPartner(w.giftedTo ?? w.partner).then(setPartner);
      listPhotos(w.id, 'finished').then(setFinished);
      listPhotos(w.id, 'pattern').then(setPatterns);
    });
  }, [id]);

  const reopen = async () => {
    setConfirm(false);
    const w = await reopenWork(id);
    if (w) go(routes.knit(w.id), true);
  };

  if (missing) return <Missing />;
  if (!work) return <main class="screen" />;
  const animal = work.giftedTo ?? work.partner;
  const memo = [
    ['使った毛糸', work.memo.yarn],
    ['針の号数', work.memo.needle],
    ['メモ', work.memo.note],
  ].filter(([, v]) => v.trim());

  return (
    <main class="screen">
      <div class="top-bar">
        <a class="round-button" href={routes.album()} aria-label="アルバムへ戻る">
          <Icon name="back" />
        </a>
        <h1>{work.name}</h1>
      </div>

      <div class="record">
        {/* 完成写真がなければ、パートナーが作品を持っている絵 */}
        {finished?.length === 0 && (
          <div class="album-hero card">
            <Partner animal={animal} decoration={partner?.decoration} color={work.color} progress={1} live />
          </div>
        )}
        <PhotoList workId={work.id} kind="finished" editable={false} />
        <p class="gift-line">{ANIMAL_NAMES[animal]}が もらってくれました</p>

        {work.impression.trim() && (
          <section class="field">
            <h2 class="field-title">感想</h2>
            <p class="text-block card">{work.impression}</p>
          </section>
        )}

        <section class="field">
          <h2 class="field-title">記録</h2>
          <RecordFacts work={work} />
        </section>

        {memo.length > 0 && (
          <section class="field">
            <h2 class="field-title">作品メモ</h2>
            <dl class="facts card">
              {memo.map(([k, v]) => (
                <div class="fact">
                  <dt>{k}</dt>
                  <dd class="pre">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section class="field" hidden={!patterns?.length}>
          <h2 class="field-title">編み図の写真</h2>
          <PhotoList workId={work.id} kind="pattern" editable={false} />
        </section>

        <button class="primary-button" onClick={() => go(routes.record(work.id))}>
          記録を直す
        </button>
        <button class="link-button reopen" onClick={() => setConfirm(true)}>
          編みかけに戻す
        </button>
      </div>

      {confirm && (
        <ConfirmSheet
          title="編みかけに戻しますか?"
          message={`完成した日と、${ANIMAL_NAMES[animal]}がもらった記録を消して、編みかけの作品に戻します。写真と感想は残ります`}
          ok="編みかけに戻す"
          onOk={reopen}
          onClose={() => setConfirm(false)}
        />
      )}
    </main>
  );
}

