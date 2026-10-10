// 端末の保存領域を「消されにくい」設定にしてもらう(navigator.storage.persist)。
// 使えないブラウザでは何もしない。

/** まだなら頼む。結果:true=消されにくい / false=ふつう / null=この端末ではわからない */
export async function requestPersist(): Promise<boolean | null> {
  const s = navigator.storage;
  if (!s?.persist || !s.persisted) return null;
  try {
    if (await s.persisted()) return true;
    return await s.persist();
  } catch {
    return null;
  }
}

/** 今の状態を見るだけ */
export async function isPersisted(): Promise<boolean | null> {
  const s = navigator.storage;
  if (!s?.persisted) return null;
  try {
    return await s.persisted();
  } catch {
    return null;
  }
}
