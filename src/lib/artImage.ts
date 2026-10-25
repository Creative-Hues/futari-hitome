// 新しい絵(PNG)を読み込み、色を付けた画像を作って使い回す。
// 色の付いた画像は canvas で1回だけ作り、アプリを開いている間は同じ絵・同じ色なら使い回す。
// 呼吸などの動きのたびに色の計算(ブレンドやフィルター)をさせないため。
import { useEffect, useState } from 'preact/hooks';
import type { Placed } from './artConfig';
import { hexToRgb } from './color';
import { multiply, multiplyMasked, paint } from './tint';

export type ArtTint =
  | { mode: 'multiply' | 'paint'; color: string }
  /** body と mask は同じ絵の座標で、mask の白いところにだけ色を付ける */
  | { mode: 'masked'; color: string; body: Placed; mask: Placed };

export interface ArtRequest {
  href: string;
  tint?: ArtTint;
}

const done = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
const images = new Map<string, Promise<HTMLImageElement>>();

export function requestKey(r: ArtRequest): string {
  const t = r.tint;
  if (!t) return r.href;
  return `${r.href}|${t.mode}|${t.color}${t.mode === 'masked' ? `|${t.mask.href}` : ''}`;
}

function load(href: string): Promise<HTMLImageElement> {
  let p = images.get(href);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => img.decode().then(() => resolve(img), () => resolve(img));
      img.onerror = () => reject(new Error(`絵が読み込めません:${href}`));
      img.src = href;
    });
    images.set(href, p);
    p.catch(() => images.delete(href));
  }
  return p;
}

async function make(r: ArtRequest): Promise<string> {
  const img = await load(r.href);
  const t = r.tint;
  if (!t) return r.href;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas が使えません');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const rgb = hexToRgb(t.color);
  if (t.mode === 'masked') {
    // マスクを体の画像と同じ大きさ・同じ位置に並べてから読む
    const { body, mask } = t;
    const m = await load(mask.href);
    const k = w / body.width;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(m, (mask.x - body.x) * k, (mask.y - body.y) * k, mask.width * k, mask.height * k);
    multiplyMasked(data.data, ctx.getImageData(0, 0, w, h).data, rgb);
  } else if (t.mode === 'multiply') multiply(data.data, rgb);
  else paint(data.data, rgb);
  ctx.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('色を付けた絵が作れません');
  return URL.createObjectURL(blob);
}

/** 色を付けた画像のアドレス(作り終わっていれば、待たずに返す) */
export function resolveArt(r: ArtRequest): Promise<string> {
  const key = requestKey(r);
  const ready = done.get(key);
  if (ready) return Promise.resolve(ready);
  let p = pending.get(key);
  if (!p) {
    p = make(r).then((url) => {
      done.set(key, url);
      pending.delete(key);
      return url;
    });
    p.catch(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

export type ArtUrls = { state: 'ready'; urls: string[] } | { state: 'loading' } | { state: 'failed' };

/**
 * 絵の画像をそろえる。全部そろうまでは loading(絵の場所を空けたまま待つ)。読めなければ failed(今のSVGに戻す)。
 * reqs が null のときは何もしない(ready、空)
 */
export function useArtUrls(reqs: ArtRequest[] | null): ArtUrls {
  const key = reqs?.map(requestKey).join('\n') ?? '';
  const cached = reqs?.every((r) => done.has(requestKey(r))) ? reqs.map((r) => done.get(requestKey(r))!) : null;
  const [got, setGot] = useState<{ key: string; result: ArtUrls } | null>(null);
  useEffect(() => {
    if (!reqs || cached) return;
    let alive = true;
    Promise.all(reqs.map(resolveArt)).then(
      (urls) => alive && setGot({ key, result: { state: 'ready', urls } }),
      (e) => {
        console.warn(e);
        if (alive) setGot({ key, result: { state: 'failed' } });
      },
    );
    return () => {
      alive = false;
    };
  }, [key]);
  if (!reqs) return { state: 'ready', urls: [] };
  if (cached) return { state: 'ready', urls: cached };
  return got?.key === key ? got.result : { state: 'loading' };
}
