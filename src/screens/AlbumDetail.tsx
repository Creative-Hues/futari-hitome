// アルバムの記録の画面:完成記録の中身をすべて表示する。完成の取り消し(編みかけに戻す)と、記録を消すのもここ
import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { Partner } from '../components/Partner';
import { PhotoList } from '../components/PhotoList';
import { RecordFacts } from '../components/RecordFacts';
import { ConfirmSheet } from '../components/Sheet';
import { deleteWork, getWork, listPhotos, reopenWork, type Photo, type Work } from '../lib/db';
import { useLooks } from '../lib/looks';
import { go, routes } from '../lib/router';
import { Missing } from './Record';

export function AlbumDetail({ id }: { id: string }) {
  const [work, setWork] = useState<Work | null>(null);
  const looks = useLooks();
  const [missing, setMissing] = useState(false);
  const [finished, setFinished] = useState<Photo[] | null>(null);
  const [patterns, setPatterns] = useState<Photo[] | null>(null);
  const [confirm, setConfirm] = useState<'reopen' | 'delete' | null>(null);

  useEffect(() => {
    getWork(id).then((w) => {
      if (!w) return setMissing(true);
      if (w.status !== 'done') return go(routes.knit(w.id), true);
      setWork(w);
      listPhotos(w.id, 'finished').then(setFinished);
      listPhotos(w.id, 'pattern').then(setPatterns);
    });
  }, [id]);

  const reopen = async () => {
    setConfirm(null);
    const w = await reopenWork(id);
    if (w) go(routes.knit(w.id), true);
  };

  const remove = async () => {
    setConfirm(null);
    await deleteWork(id);
    go(routes.album(), true);
  };

  if (missing) return <Missing />;
  if (!work) return <main class="screen" />;
  const animal = work.giftedTo ?? work.partner;
  const name = looks?.name(animal) ?? '';
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
            {looks && (
              <Partner animal={animal} look={looks.look(animal)} name={name} color={work.color} progress={1} live />
            )}
          </div>
        )}
        <PhotoList workId={work.id} kind="finished" editable={false} />
        <p class="gift-line">
          {name}が もらってくれました
          <a class="gift-link" href={routes.partner(animal)}>
            {work.department === 'interior' ? '部屋に飾る' : '身につける'}
          </a>
        </p>

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
        <button class="link-button reopen" onClick={() => setConfirm('reopen')}>
          編みかけに戻す
        </button>
        <button class="link-button delete-link" onClick={() => setConfirm('delete')}>
          この記録を消す
        </button>
      </div>

      {confirm === 'reopen' && (
        <ConfirmSheet
          title="編みかけに戻しますか?"
          message={`完成した日と、${name}がもらった記録を消して、編みかけの作品に戻します。${work.department === 'interior' ? '部屋に飾っていれば、はずします。' : '身につけていれば、外します。'}写真と感想は残ります`}
          ok="編みかけに戻す"
          onOk={reopen}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmSheet
          title="この記録を消しますか?"
          message={`「${work.name}」の作品・感想・メモ・写真(編み図と完成写真)がすべて消えます。${
            work.department === 'interior'
              ? '部屋に飾っていれば、はずします。'
              : `${name}が身につけていれば外します。`
          }元に戻せません`}
          ok="消す"
          danger
          onOk={remove}
          onClose={() => setConfirm(null)}
        />
      )}
    </main>
  );
}

