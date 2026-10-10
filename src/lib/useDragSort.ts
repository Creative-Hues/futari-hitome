// ドラッグ並び替え。項目を少し長押しすると持ち上がり、指を動かして好きな位置で離す。
// 長押しの前に指が動けばふつうのスクロール、すぐ離せばふつうのタップ。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { LONG_PRESS_MS, LONG_PRESS_SLOP } from '../config/tuning';
import { indexAt, moveItem } from './reorder';

/** 画面の端からこの距離(px)に指が入ると自動でスクロールする */
const EDGE = 70;
/** 自動スクロールの一番速いとき(px/フレーム) */
const EDGE_SPEED = 12;
/** 指を離してから、この時間(ミリ秒)以内に届いたクリックは、離したときに出るものとみなす */
const DROP_CLICK_MS = 250;

type Press = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  timer: number;
  lifted: boolean;
  grabX: number;
  grabY: number;
  ids: string[];
  scroller: HTMLElement | null;
  frame: number;
};

/** いちばん近い、縦にスクロールできる入れ物(なければページ全体) */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let e = el?.parentElement; e; e = e.parentElement) {
    const oy = getComputedStyle(e).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight) return e;
  }
  return null;
}

export function useDragSort<T>(items: T[], getId: (item: T) => string, onDrop: (items: T[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const latest = useRef({ items, getId, onDrop });
  latest.current = { items, getId, onDrop };

  // 指の動きを受け取る関数は1回だけ作る(付けた関数と外す関数が同じになるように)
  const drag = useMemo(() => {
    let press: Press | null = null;
    /** この時刻までのクリックは、指を離したときに出るものなので数えない */
    let suppressUntil = 0;
    const currentIds = () => latest.current.items.map(latest.current.getId);

    /** 持ち上げた項目を指の位置に置く(並びが変わったあとも、本来の位置から計算し直す) */
    const place = () => {
      const el = press && els.current.get(press.id);
      if (!press?.lifted || !el) return;
      el.style.transform = '';
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${press.x - press.grabX - r.left}px, ${press.y - press.grabY - r.top}px)`;
    };

    /** 指が重なった項目の位置へ動かす */
    const retarget = () => {
      const p = press;
      if (!p?.lifted) return;
      const rects = p.ids.map((id) => {
        const el = id === p.id ? null : els.current.get(id);
        return el ? el.getBoundingClientRect() : { left: 0, top: 0, right: -1, bottom: -1 };
      });
      const to = indexAt(rects, p.x, p.y);
      const from = p.ids.indexOf(p.id);
      if (to < 0 || to === from) return;
      p.ids = moveItem(p.ids, from, to);
      setOrder(p.ids);
    };

    const autoScroll = () => {
      const p = press;
      if (!p?.lifted) return;
      const box = p.scroller?.getBoundingClientRect();
      const top = box ? box.top : 0;
      const bottom = box ? box.bottom : window.innerHeight;
      let d = 0;
      if (p.y < top + EDGE) d = -EDGE_SPEED * (1 - Math.max(0, p.y - top) / EDGE);
      else if (p.y > bottom - EDGE) d = EDGE_SPEED * (1 - Math.max(0, bottom - p.y) / EDGE);
      if (d) {
        if (p.scroller) p.scroller.scrollTop += d;
        else window.scrollBy(0, d);
        place();
        retarget();
      }
      p.frame = requestAnimationFrame(autoScroll);
    };

    const end = (commit: boolean) => {
      const p = press;
      if (!p) return;
      press = null;
      clearTimeout(p.timer);
      cancelAnimationFrame(p.frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (!p.lifted) return;
      const el = els.current.get(p.id);
      if (el) el.style.transform = '';
      // 持ち上げたあとに指を離したときのタップ(作品を開くなど)は数えない。次のふつうのタップは数える
      suppressUntil = performance.now() + DROP_CLICK_MS;
      if (commit && p.ids.join('\n') !== currentIds().join('\n')) {
        const { items, getId, onDrop } = latest.current;
        const byId = new Map(items.map((it) => [getId(it), it]));
        onDrop(p.ids.map((id) => byId.get(id)!).filter(Boolean));
      }
      setOrder(null);
      setDragId(null);
    };

    function onMove(e: PointerEvent) {
      if (!press || e.pointerId !== press.pointerId) return;
      press.x = e.clientX;
      press.y = e.clientY;
      if (!press.lifted) {
        if (Math.hypot(press.x - press.startX, press.y - press.startY) > LONG_PRESS_SLOP) end(false);
        return;
      }
      place();
      retarget();
    }

    /** 指を離したとき。持ち上げたあとに止められたとき(pointercancel)も、そこまでの並びを残す */
    function onUp(e: PointerEvent) {
      if (press && e.pointerId === press.pointerId) end(true);
    }

    const lift = () => {
      const el = press && els.current.get(press.id);
      if (!press || !el) return;
      const r = el.getBoundingClientRect();
      press.lifted = true;
      press.grabX = press.x - r.left;
      press.grabY = press.y - r.top;
      press.scroller = scrollParent(el);
      press.ids = currentIds();
      setOrder(press.ids);
      setDragId(press.id);
      press.frame = requestAnimationFrame(autoScroll);
    };

    const start = (id: string, e: PointerEvent) => {
      if (press) return end(true); // 2本目の指が触れたら、そこでおしまい
      if (e.button !== 0 || (e.target as Element).closest('input, textarea, [data-no-drag]')) return;
      press = {
        id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        timer: window.setTimeout(lift, LONG_PRESS_MS),
        lifted: false,
        grabX: 0,
        grabY: 0,
        ids: currentIds(),
        scroller: null,
        frame: 0,
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };

    /** 持ち上げている間は、指の動きでページがスクロールしないようにする */
    const stopScroll = (e: TouchEvent) => {
      if (press?.lifted) e.preventDefault();
    };

    const takeClick = () => {
      const was = performance.now() < suppressUntil;
      suppressUntil = 0;
      return was;
    };

    return { start, end, place, stopScroll, takeClick };
  }, []);

  useEffect(() => {
    document.addEventListener('touchmove', drag.stopScroll, { passive: false });
    return () => {
      document.removeEventListener('touchmove', drag.stopScroll);
      drag.end(false);
    };
  }, []);

  // 並びが変わったら、持ち上げた項目を指の位置に置き直す
  useLayoutEffect(drag.place, [order]);

  const bind = (id: string) => ({
    ref: (el: HTMLElement | null) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    'data-sortable': true,
    'data-dragging': dragId === id || undefined,
    onPointerDown: (e: PointerEvent) => drag.start(id, e),
    onClickCapture: (e: MouseEvent) => {
      if (!drag.takeClick()) return;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu: (e: Event) => e.preventDefault(),
  });

  const byId = new Map(items.map((it) => [getId(it), it]));
  const shown = order ? order.map((id) => byId.get(id)!).filter(Boolean) : items;
  return { items: shown, bind, dragging: dragId !== null };
}
