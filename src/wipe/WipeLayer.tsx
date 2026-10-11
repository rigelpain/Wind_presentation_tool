// 画面の左下・右下のワイプ。カメラの映像から2人の顔のまわりを切り出して描く。
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { wipeLabel } from '../engine/lesson';
import type { Lesson, Role, ShowState, WipeMode } from '../engine/types';
import { tracker, WIPE_ASPECT, type TrackId } from './tracker';

const MARGIN = 48;
const SIZES = { normal: 420, large: 760, small: 300 } as const; // 幅（px、1920×1080 の座標）

interface Placement {
  width: number;
  visible: boolean;
}

function placements(mode: WipeMode): Record<Role, Placement> {
  switch (mode) {
    case 'both':
      return { host: { width: SIZES.normal, visible: true }, guest: { width: SIZES.normal, visible: true } };
    case 'explain':
      return { host: { width: SIZES.small, visible: true }, guest: { width: SIZES.large, visible: true } };
    case 'host':
      return { host: { width: SIZES.normal, visible: true }, guest: { width: SIZES.normal, visible: false } };
    case 'guest':
      return { host: { width: SIZES.normal, visible: false }, guest: { width: SIZES.normal, visible: true } };
    case 'hidden':
      return { host: { width: SIZES.normal, visible: false }, guest: { width: SIZES.normal, visible: false } };
  }
}

export function trackOf(role: Role, swapped: boolean): TrackId {
  return (role === 'host') !== swapped ? 'A' : 'B';
}

export function useTracker() {
  return useSyncExternalStore(
    (fn) => tracker.subscribe(fn),
    () => `${tracker.status}|${tracker.error}|${tracker.devices.length}|${tracker.deviceId}`,
  );
}

export function WipeLayer({ state, lesson, placeholder }: { state: ShowState; lesson: Lesson; placeholder?: string }) {
  const canvases = useRef<Record<Role, HTMLCanvasElement | null>>({ host: null, guest: null });
  const { mode, swapped, mirror, showLabels } = state.wipe;
  const place = placements(mode);
  useTracker();
  const running = !placeholder && tracker.status === 'running';
  const k = state.settings.wipeScale;

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (placeholder || tracker.status !== 'running') return;
      for (const role of ['host', 'guest'] as Role[]) {
        const c = canvases.current[role];
        if (!c) continue;
        const ctx = c.getContext('2d');
        if (!ctx) continue;
        const crop = tracker.cropFor(trackOf(role, swapped));
        if (!crop) continue;
        ctx.save();
        if (mirror) {
          ctx.translate(c.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(tracker.video, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height);
        ctx.restore();
      }
      tracker.frameDone();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [swapped, mirror, placeholder]);

  return (
    <div className="wipe-layer" aria-hidden>
      {(['host', 'guest'] as Role[]).map((role) => {
        const p = place[role];
        const width = Math.round(p.width * k);
        const height = Math.round(width / WIPE_ASPECT);
        const side = role === 'host' ? { left: MARGIN } : { right: MARGIN };
        return (
          <div
            key={role}
            className={`wipe ${p.visible ? '' : 'wipe--hidden'}`}
            style={{ ...side, bottom: MARGIN, width, height }}
          >
            <canvas
              ref={(el) => {
                canvases.current[role] = el;
              }}
              width={960}
              height={Math.round(960 / WIPE_ASPECT)}
            />
            {!running && <div className="wipe__empty">{placeholder ?? 'カメラ待ち'}</div>}
            {showLabels && <div className="wipe__label">{wipeLabel(lesson, state.settings, role)}</div>}
          </div>
        );
      })}
    </div>
  );
}
