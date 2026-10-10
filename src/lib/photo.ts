// 写真の取り込み。長辺を縮小した JPEG にして保存する(元の写真は保存しない)。
import { PHOTO_MAX_SIDE, PHOTO_QUALITY, PHOTO_THUMB_SIDE } from '../config/tuning';

/** 長辺が max を超えないように縮めた大きさ(小さい写真は大きくしない) */
export function shrinkSize(w: number, h: number, max: number): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

export interface PreparedPhoto {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

/** 写真を読み込む。<img> で読むと、iPhone で撮った写真の向き(縦・横)がそのまま反映される */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  return img
    .decode()
    .then(() => img)
    .finally(() => URL.revokeObjectURL(url));
}

function draw(img: HTMLImageElement, max: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const { w, h } = shrinkSize(img.naturalWidth, img.naturalHeight, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas'));
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        // iPhone はキャンバスのメモリが少ないので、使い終わったらすぐ小さくする
        canvas.width = canvas.height = 0;
        if (blob) resolve({ blob, w, h });
        else reject(new Error('toBlob'));
      },
      'image/jpeg',
      quality,
    ),
  );
}

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const img = await loadImage(file);
  const big = await draw(img, PHOTO_MAX_SIDE, PHOTO_QUALITY);
  const small = await draw(img, PHOTO_THUMB_SIDE, PHOTO_QUALITY);
  return { blob: big.blob, thumb: small.blob, width: big.w, height: big.h };
}
