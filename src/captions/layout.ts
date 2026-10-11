// 字幕の箱の位置と大きさ（1920×1080 の座標）。表示画面の字幕と、コントロール画面の位置の編集で同じ計算を使う。
import type { CaptionSettings, Role, ShowState } from '../engine/types';
import { WIPE_ASPECT } from '../wipe/tracker';
import { MARGIN, placements } from '../wipe/WipeLayer';

export const STAGE_W = 1920;
export const STAGE_H = 1080;
const GAP = 32;
/** 箱の上下の余白の合計（px） */
export const CAPTION_PAD = 16;
export const LINE_RATIO = 1.4;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 字の大きさ。自由な位置のときは、箱の高さに行が収まる大きさ */
export function captionFontSize(c: CaptionSettings): number {
  if (c.position === 'free' && c.box) return Math.max(20, Math.min(200, Math.floor((c.box.h - CAPTION_PAD) / (c.lines * LINE_RATIO))));
  return c.size;
}

/** 字の大きさと行の数から、箱の高さ */
export function captionHeight(size: number, lines: number): number {
  return Math.round(size * LINE_RATIO) * lines + CAPTION_PAD;
}

/**
 * 字幕を置く場所。fixed は箱の幅いっぱい、band は帯の中で字の長さに合わせて縮む（中央寄せ）
 */
export function captionRect(state: ShowState): { rect: Rect; fixed: boolean } {
  const c = state.settings.captions;
  const h = captionHeight(captionFontSize(c), c.lines);
  if (c.position === 'free' && c.box) return { rect: c.box, fixed: true };
  if (c.position === 'top') return { rect: { x: 160, y: 40, w: STAGE_W - 320, h }, fixed: false };
  const place = placements(state.wipe.mode);
  const k = state.settings.wipeScale;
  const width = (role: Role) => (place[role].visible ? place[role].width * k : 0);
  const left = MARGIN + (width('host') ? width('host') + GAP : 0);
  const right = MARGIN + (width('guest') ? width('guest') + GAP : 0);
  if (STAGE_W - left - right >= 720) return { rect: { x: left, y: STAGE_H - MARGIN - h, w: STAGE_W - left - right, h }, fixed: false };
  // 帯が狭いとき（解説モードなど）は、ワイプの上に出す
  const tallest = Math.max(width('host'), width('guest')) / WIPE_ASPECT;
  return { rect: { x: 160, y: STAGE_H - MARGIN - tallest - GAP - h, w: STAGE_W - 320, h }, fixed: false };
}

/** ワイプの箱（位置の編集で目安に描く） */
export function wipeRects(state: ShowState): Rect[] {
  const place = placements(state.wipe.mode);
  const k = state.settings.wipeScale;
  const out: Rect[] = [];
  for (const role of ['host', 'guest'] as Role[]) {
    if (!place[role].visible) continue;
    const w = place[role].width * k;
    const h = w / WIPE_ASPECT;
    out.push({ x: role === 'host' ? MARGIN : STAGE_W - MARGIN - w, y: STAGE_H - MARGIN - h, w, h });
  }
  return out;
}
