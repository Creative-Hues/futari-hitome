// 写真を大きく見る画面の、拡大・移動の計算(画面と切り離してテストする)。
// 写真は枠の中央を中心に translate(x, y) scale(scale) で動かす。x, y は枠の中央からのずれ(px)。
import { PHOTO_MAX_ZOOM } from '../config/tuning';

export interface View {
  scale: number;
  x: number;
  y: number;
}

export const FIT: View = { scale: 1, x: 0, y: 0 };

/** 写真が枠の外へ行きすぎないように位置を止める。w, h は枠に収めたときの写真の大きさ、bw, bh は枠の大きさ */
export function clampView(v: View, w: number, h: number, bw: number, bh: number, max = PHOTO_MAX_ZOOM): View {
  const scale = Math.min(max, Math.max(1, v.scale));
  const limX = Math.max(0, (w * scale - bw) / 2);
  const limY = Math.max(0, (h * scale - bh) / 2);
  return {
    scale,
    x: Math.min(limX, Math.max(-limX, v.x)),
    y: Math.min(limY, Math.max(-limY, v.y)),
  };
}

/** 点 (fx, fy)(枠の中央からのずれ)を動かさずに、倍率を scale にする */
export function zoomAt(v: View, scale: number, fx: number, fy: number): View {
  const r = scale / v.scale;
  return { scale, x: fx - (fx - v.x) * r, y: fy - (fy - v.y) * r };
}

/** 2本指の動き。前の2点 a0,b0 と今の2点 a1,b1(どれも枠の中央からのずれ)から、新しい見え方を出す */
export function pinch(
  v: View,
  a0: { x: number; y: number },
  b0: { x: number; y: number },
  a1: { x: number; y: number },
  b1: { x: number; y: number },
): View {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  const zoomed = d0 > 0 ? zoomAt(v, v.scale * (d1 / d0), m0.x, m0.y) : v;
  // 2本指の真ん中が動いた分だけ写真も動かす
  return { ...zoomed, x: zoomed.x + m1.x - m0.x, y: zoomed.y + m1.y - m0.y };
}

/** 写真を枠に収めたときの大きさ */
export function fitSize(iw: number, ih: number, bw: number, bh: number): { w: number; h: number } {
  if (!iw || !ih) return { w: bw, h: bh };
  const s = Math.min(bw / iw, bh / ih);
  return { w: iw * s, h: ih * s };
}
