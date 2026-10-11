// 字幕の位置と大きさを、画面の縮図の上でドラッグして決める。
// 箱をつかんで動かす。辺や角をつかんで大きさを変える（高さを変えると字の大きさが変わる）。
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { captionFontSize, captionLineHeight, captionRect, CAPTION_PAD, lineRatio, STAGE_H, STAGE_W, wipeRects, type Rect } from '../captions/layout';
import { dispatch, useShow } from '../engine/store';

type Grip = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const GRIPS: Grip[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const MIN_W = 320;

function clampRect(r: Rect, minH: number): Rect {
  const w = Math.max(MIN_W, Math.min(STAGE_W, r.w));
  const h = Math.max(minH, Math.min(STAGE_H, r.h));
  const x = Math.max(0, Math.min(STAGE_W - w, r.x));
  const y = Math.max(0, Math.min(STAGE_H - h, r.y));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

export function CaptionBoxEditor() {
  const state = useShow();
  const c = state.settings.captions;
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  const drag = useRef<{ grip: Grip; sx: number; sy: number; start: Rect } | null>(null);
  const lastSent = useRef(0);
  const latest = useRef<Rect | null>(null);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / STAGE_W || 0.2);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rect = captionRect(state).rect;
  const minH = Math.round(20 * lineRatio(c)) * c.lines + CAPTION_PAD;

  const send = (box: Rect, force = false) => {
    const now = performance.now();
    if (!force && now - lastSent.current < 50) return; // 1秒に20回まで（表示画面にもすぐ効く）
    lastSent.current = now;
    dispatch({ type: 'settings', patch: { captions: { ...c, position: 'free', box } } });
  };

  const onDown = (grip: Grip) => (e: RPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { grip, sx: e.clientX, sy: e.clientY, start: rect };
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / scale;
    const dy = (e.clientY - d.sy) / scale;
    const r = { ...d.start };
    if (d.grip === 'move') {
      r.x += dx;
      r.y += dy;
    } else {
      if (d.grip.includes('e')) r.w += dx;
      if (d.grip.includes('s')) r.h += dy;
      if (d.grip.includes('w')) {
        r.x += dx;
        r.w -= dx;
      }
      if (d.grip.includes('n')) {
        r.y += dy;
        r.h -= dy;
      }
    }
    latest.current = clampRect(r, minH);
    send(latest.current);
  };
  const onUp = (e: RPointerEvent) => {
    if (!drag.current) return;
    onMove(e);
    drag.current = null;
    // 間引いて送らなかった最後の位置を、離したときに必ず送る
    if (latest.current) send(latest.current, true);
    latest.current = null;
  };

  const size = captionFontSize(c);
  const lineH = captionLineHeight(c, size);
  const bgNone = c.bg === 'none';

  return (
    <div className="cbox">
      <div className="cbox__frame" ref={frame} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="cbox__stage" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
          {wipeRects(state).map((w, i) => (
            <div key={i} className="cbox__wipe" style={{ left: w.x, top: w.y, width: w.w, height: w.h }}>
              ワイプ
            </div>
          ))}
          <div
            className={`cbox__box ${c.position === 'free' ? 'is-free' : ''}`}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              background: bgNone ? 'transparent' : c.bg || '#141414',
              color: c.color || '#FFFFFF',
              fontSize: size,
              lineHeight: `${lineH}px`,
            }}
            onPointerDown={onDown('move')}
          >
            <span className={bgNone ? 'cbox__text--nobg' : ''}>
              {Array.from({ length: c.lines }, (_, i) => (
                <span key={i} className="cbox__line">
                  {i === c.lines - 1 ? '見えてるのに、見えてない' : '今日は認知科学の話をします'}
                </span>
              ))}
            </span>
            {GRIPS.map((g) => (
              <span key={g} className={`cbox__grip cbox__grip--${g}`} onPointerDown={onDown(g)} />
            ))}
          </div>
        </div>
      </div>
      <p className="hint">
        箱をドラッグして動かす。辺や角をドラッグして大きさを変える（高さで字の大きさが変わる。いま {size}px）。動かすと、表示画面にもすぐ効きます。
      </p>
    </div>
  );
}
