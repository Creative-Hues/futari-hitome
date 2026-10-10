// 写真の一覧(編み図・完成写真)。カメラ/写真ライブラリから足す、長押しで並び替え、押すと大きく見る。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { addPhoto, deletePhoto, listPhotos, newId, reorderPhotos, type Photo } from '../lib/db';
import { requestPersist } from '../lib/persist';
import { preparePhoto } from '../lib/photo';
import { useDragSort } from '../lib/useDragSort';
import { Icon } from './Icon';
import { PhotoViewer } from './PhotoViewer';

/** Blob を画面に出すためのアドレス(使い終わったら片づける) */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  return url;
}

export function PhotoThumb({ photo }: { photo: Photo }) {
  const url = useObjectUrl(photo.thumb);
  return url ? <img src={url} alt="" draggable={false} /> : null;
}

export function PhotoList({
  workId,
  kind,
  editable = true,
  onChange,
}: {
  workId: string;
  kind: Photo['kind'];
  editable?: boolean;
  /** 写真が増えた・減った・並びが変わったとき */
  onChange?: (photos: Photo[]) => void;
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [busy, setBusy] = useState(0);
  const [notice, setNotice] = useState('');
  const [viewing, setViewing] = useState<number | null>(null);

  useEffect(() => {
    listPhotos(workId, kind).then(setPhotos);
  }, [workId, kind]);

  const update = (next: Photo[]) => {
    setPhotos(next);
    onChange?.(next);
  };

  const drag = useDragSort(
    photos ?? [],
    (p) => p.id,
    (next) => {
      update(next);
      reorderPhotos(next.map((p) => p.id));
    },
  );

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setNotice('');
    setBusy(list.length);
    let failed = 0;
    let added: Photo[] = photos ?? [];
    for (const file of list) {
      try {
        const p = await preparePhoto(file);
        const saved = await addPhoto({ id: newId(), workId, kind, createdAt: new Date().toISOString(), ...p });
        added = added.concat(saved);
        update(added);
      } catch {
        failed++;
      }
      setBusy((n) => n - 1);
    }
    if (failed) setNotice(failed === list.length ? 'この写真は読み込めませんでした' : `${failed}枚の写真は読み込めませんでした`);
    // 写真が入ったら、端末に消されにくくしてもらう(まだのとき)
    requestPersist();
  };

  const remove = async (photo: Photo) => {
    await deletePhoto(photo.id);
    const next = (photos ?? []).filter((p) => p.id !== photo.id);
    update(next);
    if (!next.length) setViewing(null);
    else if (viewing !== null) setViewing(Math.min(viewing, next.length - 1));
  };

  const shown = editable ? drag.items : (photos ?? []);

  return (
    <div class="photo-list">
      {shown.length > 0 && (
        <div class="photo-grid">
          {shown.map((p, i) => (
            <button
              key={p.id}
              type="button"
              class="photo-thumb"
              aria-label={`写真 ${i + 1}枚目を大きく見る`}
              onClick={() => setViewing(i)}
              {...(editable ? drag.bind(p.id) : {})}
            >
              <PhotoThumb photo={p} />
            </button>
          ))}
        </div>
      )}
      {editable && shown.length > 1 && <p class="field-note">長押しして動かすと、並びを変えられます</p>}
      {busy > 0 && <p class="field-note">写真を読み込んでいます…</p>}
      {notice && <p class="field-note warn">{notice}</p>}
      {editable && (
        <div class="photo-add">
          <label class="secondary-button small">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              class="visually-hidden"
              onChange={(e) => {
                add(e.currentTarget.files);
                e.currentTarget.value = '';
              }}
            />
            <Icon name="camera" size={20} />
            カメラで撮る
          </label>
          <label class="secondary-button small">
            <input
              type="file"
              accept="image/*"
              multiple
              class="visually-hidden"
              onChange={(e) => {
                add(e.currentTarget.files);
                e.currentTarget.value = '';
              }}
            />
            <Icon name="album" size={20} />
            写真から選ぶ
          </label>
        </div>
      )}
      {viewing !== null && photos && photos[viewing] && (
        <PhotoViewer
          photos={photos}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onDelete={editable ? remove : undefined}
        />
      )}
    </div>
  );
}
