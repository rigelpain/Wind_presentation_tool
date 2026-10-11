// カメラの全体に、検出した顔と2人の切り出し枠を重ねて描く（カメラの準備とコントロール画面の確認用）。
// 描く元は、この窓の追尾（tracker）でも、表示画面から届いた枠の数字（DebugBoxes）でもよい。
import type { Role } from '../engine/types';
import { tracker, type Box, type TrackId } from './tracker';
import { trackOf } from './WipeLayer';

/** 表示画面からコントロール画面へ送る、枠の数字（映像は送らない） */
export interface DebugBoxes {
  /** カメラの映像の大きさ（枠の座標の基準） */
  w: number;
  h: number;
  detections: Box[];
  tracks: Record<TrackId, { crop: Box | null; lost: boolean }>;
}

export function trackerBoxes(): DebugBoxes {
  return {
    w: tracker.width,
    h: tracker.height,
    detections: tracker.detections,
    tracks: {
      A: { crop: tracker.tracks.A.crop, lost: tracker.isLost('A') },
      B: { crop: tracker.tracks.B.crop, lost: tracker.isLost('B') },
    },
  };
}

interface Opts {
  swapped: boolean;
  mirror: boolean;
  labels: Record<Role, string>;
  maxWidth?: number;
}

/** この窓の追尾を描く */
export function drawCameraDebug(c: HTMLCanvasElement, opts: Opts): boolean {
  if (tracker.status !== 'running' || tracker.video.readyState < 2) return false;
  drawBoxes(c, tracker.video, trackerBoxes(), opts);
  return true;
}

/** 映像（video）に、枠の数字を重ねて描く。映像の大きさが枠の基準と違っても合わせる */
export function drawBoxes(c: HTMLCanvasElement, video: HTMLVideoElement, data: DebugBoxes, opts: Opts) {
  const vw = data.w;
  const vh = data.h;
  const k = opts.maxWidth ? Math.min(1, opts.maxWidth / vw) : 1;
  const w = Math.round(vw * k);
  const h = Math.round(vh * k);
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  const ctx = c.getContext('2d')!;
  const roleOfTrack = (id: TrackId): Role => (trackOf('host', opts.swapped) === id ? 'host' : 'guest');
  ctx.save();
  ctx.scale(k, k);
  if (opts.mirror) {
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, vw, vh);
  ctx.lineWidth = Math.max(3, vw / 300);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  for (const b of data.detections) ctx.strokeRect(b.x, b.y, b.w, b.h);
  for (const id of ['A', 'B'] as TrackId[]) {
    const t = data.tracks[id];
    if (!t.crop) continue;
    const role = roleOfTrack(id);
    ctx.strokeStyle = role === 'host' ? '#2F6FEB' : '#E8452C';
    ctx.lineWidth = Math.max(6, vw / 160);
    ctx.setLineDash(t.lost ? [20, 14] : []);
    ctx.strokeRect(t.crop.x, t.crop.y, t.crop.w, t.crop.h);
    ctx.setLineDash([]);
  }
  ctx.restore();
  // 文字は鏡にしない
  ctx.save();
  ctx.scale(k, k);
  ctx.font = `bold ${Math.round(vw / 28)}px sans-serif`;
  for (const id of ['A', 'B'] as TrackId[]) {
    const t = data.tracks[id];
    if (!t.crop) continue;
    const role = roleOfTrack(id);
    const label = opts.labels[role] + (t.lost ? '（見失い中）' : '');
    const x = opts.mirror ? vw - t.crop.x - t.crop.w : t.crop.x;
    ctx.fillStyle = role === 'host' ? '#2F6FEB' : '#E8452C';
    ctx.fillRect(x, t.crop.y, ctx.measureText(label).width + 32, vw / 22);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x + 16, t.crop.y + vw / 30);
  }
  ctx.restore();
}
