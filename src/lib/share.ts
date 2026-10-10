// ファイルを保存する。iPhone では共有シート(「"ファイル"に保存」など)、使えないときはふつうのダウンロード。
// 共有シートは「ボタンを押した直後」でないと開けないので、ファイルを作り終えてから、別のボタンで呼ぶ。

/** shared=共有シートで何かを選んだ / downloaded=ダウンロードを始めた / cancelled=共有シートを閉じた */
export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

export function canShareFile(file: File): boolean {
  try {
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

export async function saveFile(file: File): Promise<SaveResult> {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // ダウンロードが始まるまで少し待ってから片付ける
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
