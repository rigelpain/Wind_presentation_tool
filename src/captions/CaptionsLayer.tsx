// 表示画面の字幕。決まった行数（既定2行）の窓の中で、新しい行が下から入り、古い行は上へ送られて消えていく。
// 左右のワイプのあいだの帯に出す。帯が狭いとき（解説モードなど）はワイプの上に出す。
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { useNow } from '../engine/store';
import type { ShowState } from '../engine/types';
import { useCaptions, type CaptionLine } from './engine';
import { captionFontSize, captionLineHeight, captionRect } from './layout';

const MOVE_MS = 320;

export function CaptionsLayer({ state }: { state: ShowState }) {
  const cap = useCaptions();
  const now = useNow(500);
  const c = state.settings.captions;
  const items: CaptionLine[] = cap ? [...cap.finals, ...(cap.interim ? [cap.interim] : [])].slice(-(c.lines + 2)) : [];
  const idle = !cap || cap.at === 0 || now - cap.at > c.holdSec * 1000 || items.length === 0;

  // 行が動いたら、前の位置から今の位置へなめらかに送る（FLIP）
  const els = useRef(new Map<number, HTMLDivElement>());
  const win = useRef<HTMLDivElement>(null);
  const tops = useRef(new Map<number, number>());
  const key = items.map((i) => `${i.id}:${i.text}`).join('|');
  useLayoutEffect(() => {
    const next = new Map<number, number>();
    const winTop = win.current?.getBoundingClientRect().top ?? -Infinity;
    for (const [id, el] of els.current) {
      el.getAnimations().forEach((a) => a.cancel());
      const rect = el.getBoundingClientRect();
      const scale = rect.height / (el.offsetHeight || 1) || 1;
      const top = rect.top / scale;
      // 窓の上に出た行（送り出される行）は、上へ動きながら薄くなって消える。窓の中の行は薄くしない
      const leaving = rect.top + rect.height / 2 < winTop;
      el.style.opacity = leaving ? '0' : '';
      next.set(id, top);
      const before = tops.current.get(id);
      if (before === undefined) {
        el.animate([{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: MOVE_MS, easing: 'ease-out' });
      } else if (Math.abs(before - top) > 0.5) {
        el.animate(
          [
            { transform: `translateY(${before - top}px)`, opacity: 1 },
            { transform: 'none', opacity: leaving ? 0 : 1 },
          ],
          { duration: MOVE_MS, easing: 'ease-out' },
        );
      }
    }
    tops.current = next;
  }, [key]);

  if (!c.enabled) return null;
  const size = captionFontSize(c);
  const lineH = captionLineHeight(c, size);
  const bgNone = c.bg === 'none';
  const { rect, fixed } = captionRect(state);
  const style: CSSProperties = { fontSize: size, color: c.color || '#FFFFFF', left: rect.x, top: rect.y, width: rect.w, height: rect.h };
  return (
    <div className={`captions ${idle ? 'is-idle' : ''} ${bgNone ? 'captions--nobg' : ''} ${fixed ? 'captions--fixed' : ''}`} style={style} aria-live="polite">
      <div
        className="captions__window"
        ref={win}
        style={{ height: rect.h, lineHeight: `${lineH}px`, background: bgNone ? 'transparent' : c.bg || '#141414' }}
      >
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
