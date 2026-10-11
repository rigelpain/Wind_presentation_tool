// 表示画面の字幕。決まった行数（既定2行）の窓の中で、新しい行が下から入り、古い行は上へ送られて消えていく。
// 左右のワイプのあいだの帯に出す。帯が狭いとき（解説モードなど）はワイプの上に出す。
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { useNow } from '../engine/store';
import type { Role, ShowState } from '../engine/types';
import { WIPE_ASPECT } from '../wipe/tracker';
import { MARGIN, placements } from '../wipe/WipeLayer';
import { useCaptions, type CaptionLine } from './engine';

const W = 1920;
const GAP = 32;
const MOVE_MS = 320;

export function CaptionsLayer({ state }: { state: ShowState }) {
  const cap = useCaptions();
  const now = useNow(500);
  const c = state.settings.captions;
  const items: CaptionLine[] = cap ? [...cap.finals, ...(cap.interim ? [cap.interim] : [])].slice(-(c.lines + 2)) : [];
  const idle = !cap || cap.at === 0 || now - cap.at > c.holdSec * 1000 || items.length === 0;

  // 行が動いたら、前の位置から今の位置へなめらかに送る（FLIP）
  const els = useRef(new Map<number, HTMLDivElement>());
  const tops = useRef(new Map<number, number>());
  const key = items.map((i) => `${i.id}:${i.text}`).join('|');
  useLayoutEffect(() => {
    const next = new Map<number, number>();
    for (const [id, el] of els.current) {
      el.getAnimations().forEach((a) => a.cancel());
      const rect = el.getBoundingClientRect();
      const scale = rect.height / (el.offsetHeight || 1) || 1;
      const top = rect.top / scale;
      next.set(id, top);
      const before = tops.current.get(id);
      if (before === undefined) {
        el.animate([{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: MOVE_MS, easing: 'ease-out' });
      } else if (Math.abs(before - top) > 0.5) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], { duration: MOVE_MS, easing: 'ease-out' });
      }
    }
    tops.current = next;
  }, [key]);

  if (!c.enabled) return null;
  const lineH = Math.round(c.size * 1.4);
  const style: CSSProperties = { fontSize: c.size };
  if (c.position === 'top') {
    Object.assign(style, { top: 40, left: 160, right: 160 });
  } else {
    const place = placements(state.wipe.mode);
    const k = state.settings.wipeScale;
    const width = (role: Role) => (place[role].visible ? place[role].width * k : 0);
    const left = MARGIN + (width('host') ? width('host') + GAP : 0);
    const right = MARGIN + (width('guest') ? width('guest') + GAP : 0);
    if (W - left - right >= 720) {
      Object.assign(style, { bottom: MARGIN, left, right });
    } else {
      // 帯が狭いときは、ワイプの上に出す
      const tallest = Math.max(width('host'), width('guest')) / WIPE_ASPECT;
      Object.assign(style, { bottom: MARGIN + tallest + GAP, left: 160, right: 160 });
    }
  }
  return (
    <div className={`captions ${idle ? 'is-idle' : ''}`} style={style} aria-live="polite">
      <div className="captions__window" style={{ height: lineH * c.lines + 16, lineHeight: `${lineH}px` }}>
        <div className="captions__stack">
          {items.map((it) => (
            <div
              key={it.id}
              ref={(el) => {
                if (el) els.current.set(it.id, el);
                else els.current.delete(it.id);
              }}
              className={`captions__line ${cap?.interim?.id === it.id ? 'is-interim' : ''}`}
            >
              {it.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
