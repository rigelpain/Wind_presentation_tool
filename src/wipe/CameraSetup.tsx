// カメラの準備の画面（C キー）。授業の前に使う。カメラを選び、2人を登録し、左右を確かめる。
import { useEffect, useRef } from 'react';
import { dispatch, useNow } from '../engine/store';
import type { Lesson, ShowState } from '../engine/types';
import { drawCameraDebug } from './debugDraw';
import { tracker } from './tracker';
import { useTracker } from './WipeLayer';

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
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (canvas.current) drawCameraDebug(canvas.current, { swapped, mirror, labels: lesson.roleLabels });
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
                {tracker.status === 'starting'
                  ? tracker.phase === 'model'
                    ? '顔検出を読み込んでいます…'
                    : 'カメラの許可を待っています。ブラウザの「許可」を押してください'
                  : tracker.status === 'error'
                    ? tracker.error
                    : '「カメラを始める」を押してください'}
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
            <label className="file">
              <span className="hint">カメラの代わりに動画・画像で試す</span>
              <input
                type="file"
                accept="video/*,image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void tracker.startFile(f);
                }}
              />
            </label>
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
