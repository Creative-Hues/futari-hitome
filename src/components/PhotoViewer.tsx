// 写真を大きく見る画面。2本指で写真を拡大・移動、1本指で動かす、ダブルタップで1倍に戻す。
// 写真が2枚以上のときは、1倍のときに左右にはらうと前・次の写真に切り替わる。
// 画面全体の拡大ではなく、写真の大きさを変える(画面全体は noZoom.ts で今までどおり拡大しない)。
import { createPortal } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { PHOTO_DOUBLE_TAP_MS, PHOTO_SWIPE_PX } from '../config/tuning';
import type { Photo } from '../lib/db';
import { clampView, FIT, fitSize, pinch, zoomAt, type View } from '../lib/pinch';
import { Icon } from './Icon';
import { useObjectUrl } from './PhotoList';
import { ConfirmSheet } from './Sheet';

type Pt = { x: number; y: number };

/** ダブルタップとみなす、2回のタップの近さ(px) */
const DOUBLE_TAP_SLOP = 30;
/** タップとみなす指の動きの小ささ(px) */
const TAP_SLOP = 10;

export function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
  onDelete,
}: {
  photos: Photo[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDelete?: (photo: Photo) => void;
}) {
  const photo = photos[index];
  const url = useObjectUrl(photo.blob);
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [view, setViewState] = useState<View>(FIT);
  const [animate, setAnimate] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const viewRef = useRef<View>(FIT);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef({ moved: 0, multi: false, start: { x: 0, y: 0 } as Pt });
  const lastTap = useRef<{ t: number; p: Pt } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const r = stage.current?.getBoundingClientRect();
      if (r) setBox({ w: r.width, h: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // 写真を替えたら1倍に戻す
  useLayoutEffect(() => {
    viewRef.current = FIT;
    setViewState(FIT);
  }, [index]);

  const fit = fitSize(photo.width, photo.height, box.w, box.h);
  const setView = (v: View, smooth = false) => {
    const c = clampView(v, fit.w, fit.h, box.w, box.h);
    viewRef.current = c;
    setAnimate(smooth);
    setViewState(c);
  };

  /** 枠の中央からのずれ */
  const local = (e: PointerEvent): Pt => {
    const r = stage.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };

  const onDown = (e: PointerEvent) => {
    try {
      stage.current?.setPointerCapture(e.pointerId);
    } catch {
      // 指がもう離れているときなど。つかめなくても拡大の計算はできる
    }
    if (pointers.current.size === 0) gesture.current = { moved: 0, multi: false, start: local(e) };
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size > 1) gesture.current.multi = true;
  };

  const onMove = (e: PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = local(e);
    const ids = Array.from(pointers.current.keys());
    gesture.current.moved += Math.hypot(now.x - prev.x, now.y - prev.y);
    if (ids.length >= 2) {
      const other = ids.find((id) => id !== e.pointerId)!;
      const o = pointers.current.get(other)!;
      setView(pinch(viewRef.current, prev, o, now, o));
    } else if (viewRef.current.scale > 1) {
      const v = viewRef.current;
      setView({ ...v, x: v.x + now.x - prev.x, y: v.y + now.y - prev.y });
    }
    pointers.current.set(e.pointerId, now);
  };

  const onUp = (e: PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (!p || pointers.current.size > 0) return;
    if (gesture.current.multi) return;
    // 1倍のとき、1本指で左右にはらったら前・次の写真
    const dx = p.x - gesture.current.start.x;
    const dy = p.y - gesture.current.start.y;
    if (viewRef.current.scale <= 1.01 && Math.abs(dx) > PHOTO_SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const to = index + (dx < 0 ? 1 : -1);
      if (to >= 0 && to < photos.length) onIndex(to);
      return;
    }
    // 1本指で、ほとんど動かさずに離したらタップ。続けて2回なら1倍に戻す
    if (gesture.current.moved > TAP_SLOP) return;
    const t = e.timeStamp;
    const last = lastTap.current;
    if (last && t - last.t < PHOTO_DOUBLE_TAP_MS && Math.hypot(p.x - last.p.x, p.y - last.p.y) < DOUBLE_TAP_SLOP) {
      lastTap.current = null;
      setView(FIT, true);
    } else {
      lastTap.current = { t, p };
    }
  };

  const zoomTo = (s: number) => setView(s === 1 ? FIT : zoomAt(viewRef.current, s, 0, 0), true);
  const zoomLabel = Math.round(view.scale * 10) / 10;

  return createPortal(
    <div class="viewer" role="dialog" aria-modal="true" aria-label="写真を大きく見る">
      <div class="viewer-top">
        <button class="round-button" aria-label="閉じる" onClick={onClose}>
          <Icon name="close" />
        </button>
        <span class="viewer-count">
          {photos.length > 1 ? `${index + 1} / ${photos.length}` : ''}
        </span>
        {onDelete ? (
          <button class="round-button" aria-label="この写真を消す" onClick={() => setConfirm(true)}>
            <Icon name="trash" />
          </button>
        ) : (
          <span class="viewer-spacer" />
        )}
      </div>

      <div
        ref={stage}
        class="viewer-stage"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {url && box.w > 0 && (
          <img
            src={url}
            alt=""
            draggable={false}
            class={animate ? 'animate' : undefined}
            style={{
              width: `${fit.w}px`,
              height: `${fit.h}px`,
              left: `${(box.w - fit.w) / 2}px`,
              top: `${(box.h - fit.h) / 2}px`,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
          />
        )}
      </div>

      <div class="viewer-bottom">
        {photos.length > 1 && (
          <button
            class="round-button"
            aria-label="前の写真"
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
          >
            <Icon name="back" />
          </button>
        )}
        <div class="zoom-buttons" role="group" aria-label="大きさ">
          {[1, 2, 3].map((s) => (
            <button class="chip" aria-pressed={zoomLabel === s} onClick={() => zoomTo(s)}>
              {s}倍
            </button>
          ))}
        </div>
        {photos.length > 1 && (
          <button
            class="round-button"
            aria-label="次の写真"
            disabled={index === photos.length - 1}
            onClick={() => onIndex(index + 1)}
          >
            <Icon name="next" />
          </button>
        )}
      </div>
      <p class="viewer-hint">
        2本指で拡大・ダブルタップで元の大きさ{photos.length > 1 ? '・左右にはらうと次の写真' : ''}
      </p>

      {confirm && onDelete && (
        <ConfirmSheet
          title="この写真を消しますか?"
          message="消した写真は元に戻せません"
          ok="消す"
          onOk={() => {
            setConfirm(false);
            onDelete(photo);
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>,
    document.body,
  );
}
