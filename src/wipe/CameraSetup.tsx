// カメラの準備の画面（C キー）。授業の前に使う。カメラを選び、2人を登録し、左右を確かめる。
import { useEffect, useRef } from 'react';
import { dispatch, useNow } from '../engine/store';
import type { Lesson, Role, ShowState } from '../engine/types';
import { tracker, type TrackId } from './tracker';
import { trackOf, useTracker } from './WipeLayer';

export function CameraSetup({ state, lesson, onClose }: { state: ShowState; lesson: Lesson; onClose: () => void }) {
  useTracker();
  useNow(500);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { swapped, mirror, showLabels } = state.wipe;

  useEffect(() => {
    if (tracker.devices.length === 0) void tracker.listDevices();
  }, []);

  useEffect(() => {
    let raf = 0;
    const roleOfTrack = (id: TrackId): Role => (trackOf('host', swapped) === id ? 'host' : 'guest');
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current;
      if (!c || tracker.status !== 'running') return;
      const vw = tracker.width;
      const vh = tracker.height;
      if (c.width !== vw) c.width = vw;
      if (c.height !== vh) c.height = vh;
      const ctx = c.getContext('2d')!;
      ctx.save();
      if (mirror) {
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
      ctx.font = `bold ${Math.round(vw / 28)}px sans-serif`;
      for (const id of ['A', 'B'] as TrackId[]) {
        const t = tracker.tracks[id];
        if (!t.crop) continue;
        const role = roleOfTrack(id);
        const x = mirror ? vw - t.crop.x - t.crop.w : t.crop.x;
        ctx.fillStyle = role === 'host' ? '#2F6FEB' : '#E8452C';
        ctx.fillRect(x, t.crop.y, ctx.measureText(lesson.roleLabels[role]).width + 32, vw / 22);
        ctx.fillStyle = '#fff';
        ctx.fillText(lesson.roleLabels[role] + (t.lostSince ? '（見失い中）' : ''), x + 16, t.crop.y + vw / 30);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [swapped, mirror, lesson]);

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel__head">
          <h2>カメラの準備</h2>
          <button onClick={onClose}>閉じる（C）</button>
        </div>
        <div className="setup">
          <div className="setup__view">
            <canvas ref={canvas} />
            {tracker.status !== 'running' && (
              <div className="setup__placeholder">
                {tracker.status === 'starting' ? 'カメラを起動しています…' : tracker.status === 'error' ? tracker.error : '「カメラを始める」を押してください'}
              </div>
            )}
          </div>
          <div className="setup__controls">
            <label>
              カメラ
              <select value={tracker.deviceId} onChange={(e) => void tracker.start(e.target.value)}>
                <option value="">既定のカメラ</option>
                {tracker.devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `カメラ ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary" onClick={() => void tracker.start()}>
              {tracker.status === 'running' ? 'カメラを始め直す' : 'カメラを始める'}
            </button>
            <hr />
            <p className="hint">
              2人ともカメラに映った状態で押します。画面で左に映っている人が「{lesson.roleLabels.host}」、右の人が「{lesson.roleLabels.guest}」になります。
            </p>
            <button className="primary" disabled={tracker.status !== 'running'} onClick={() => tracker.register()}>
              登録する（左＝{lesson.roleLabels.host}、右＝{lesson.roleLabels.guest}）
            </button>
            <button onClick={() => dispatch({ type: 'swap' })}>左右を入れ替える（S）{swapped ? ' ・入れ替え中' : ''}</button>
            <label className="check">
              <input type="checkbox" checked={mirror} onChange={() => dispatch({ type: 'mirror' })} />
              鏡のように左右を反転して映す
            </label>
            <label className="check">
              <input type="checkbox" checked={showLabels} onChange={() => dispatch({ type: 'labels' })} />
              ワイプに役割名を出す
            </label>
            <p className="hint">
              検出 {tracker.detections.length} 人 / {tracker.fps.toFixed(0)} fps。顔の映像はこのブラウザの中だけで使い、保存も送信もしません。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
