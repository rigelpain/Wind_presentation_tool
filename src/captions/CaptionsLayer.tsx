// 表示画面の字幕。左右のワイプのあいだの帯に出す。帯が狭いとき（解説モードなど）はワイプの上に出す。
import type { CSSProperties } from 'react';
import { useNow } from '../engine/store';
import type { Role, ShowState } from '../engine/types';
import { WIPE_ASPECT } from '../wipe/tracker';
import { MARGIN, placements } from '../wipe/WipeLayer';
import { useCaptions } from './engine';

const W = 1920;
const GAP = 32;

export function CaptionsLayer({ state }: { state: ShowState }) {
  const cap = useCaptions();
  const now = useNow(500);
  const c = state.settings.captions;
  if (!c.enabled || !cap || cap.at === 0) return null;
  if (now - cap.at > c.holdSec * 1000) return null;
  const lines = [...cap.finals, ...(cap.interim ? [cap.interim] : [])].slice(-c.lines);
  if (lines.length === 0) return null;

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
    <div className="captions" style={style} aria-live="polite">
      {lines.map((l, i) => (
        <div key={i} className={`captions__line ${i === lines.length - 1 && cap.interim ? 'is-interim' : ''}`}>
          {l}
        </div>
      ))}
    </div>
  );
}
