// カメラの全体に、検出した顔と2人の切り出し枠を重ねて描く（カメラの準備とコントロール画面の確認用）。
import type { Role } from '../engine/types';
import { tracker, type TrackId } from './tracker';
import { trackOf } from './WipeLayer';

export function drawCameraDebug(
  c: HTMLCanvasElement,
  opts: { swapped: boolean; mirror: boolean; labels: Record<Role, string>; maxWidth?: number },
): boolean {
  if (tracker.status !== 'running' || tracker.video.readyState < 2) return false;
  const vw = tracker.width;
  const vh = tracker.height;
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
  ctx.drawImage(tracker.video, 0, 0, vw, vh);
  ctx.lineWidth = Math.max(3, vw / 300);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  for (const b of tracker.detections) ctx.strokeRect(b.x, b.y, b.w, b.h);
  for (const id of ['A', 'B'] as TrackId[]) {
    const t = tracker.tracks[id];
    if (!t.crop) continue;
    const role = roleOfTrack(id);
    ctx.strokeStyle = role === 'host' ? '#2F6FEB' : '#E8452C';
    ctx.lineWidth = Math.max(6, vw / 160);
    ctx.setLineDash(t.lostSince ? [20, 14] : []);
    ctx.strokeRect(t.crop.x, t.crop.y, t.crop.w, t.crop.h);
    ctx.setLineDash([]);
  }
  ctx.restore();
  // 文字は鏡にしない
  ctx.save();
  ctx.scale(k, k);
  ctx.font = `bold ${Math.round(vw / 28)}px sans-serif`;
  for (const id of ['A', 'B'] as TrackId[]) {
    const t = tracker.tracks[id];
    if (!t.crop) continue;
    const role = roleOfTrack(id);
    const label = opts.labels[role] + (t.lostSince ? '（見失い中）' : '');
    const x = opts.mirror ? vw - t.crop.x - t.crop.w : t.crop.x;
    ctx.fillStyle = role === 'host' ? '#2F6FEB' : '#E8452C';
    ctx.fillRect(x, t.crop.y, ctx.measureText(label).width + 32, vw / 22);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x + 16, t.crop.y + vw / 30);
  }
  ctx.restore();
  return true;
}
