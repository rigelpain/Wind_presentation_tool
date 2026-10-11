// 表示画面（プロジェクターに映す・会議ツールで共有する窓）。カメラと顔追尾はこの窓で動く。
// 操作はコントロール画面（P で開く）からでも、この窓のキーからでもできる。
import { useEffect, useMemo, useRef, useState } from 'react';
import { KEY_HELP, useKeys } from '../engine/keys';
import { useLesson, useShow } from '../engine/store';
import { MusicPlayer } from '../media/MusicPlayer';
import { PhotoTray } from '../media/PhotoTray';
import { setSnapshot } from '../media/snapshots';
import { serveCamera } from '../wipe/bus';
import { CameraSetup } from '../wipe/CameraSetup';
import { tracker } from '../wipe/tracker';
import { useDisplayHeartbeat } from './heartbeat';
import { StageCanvas } from './StageCanvas';

export { STAGE_H, STAGE_W } from './StageCanvas';

export function openControl() {
  window.open(`${location.pathname}${location.search}#/control`, 'wind-control', 'width=1440,height=900');
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

export function Stage() {
  const state = useShow();
  const lesson = useLesson();
  const [panel, setPanel] = useState<'none' | 'camera' | 'photos' | 'help'>('none');
  const toggle = (p: typeof panel) => () => setPanel((cur) => (cur === p ? 'none' : p));

  const local = useMemo(
    () => ({
      f: toggleFullscreen,
      c: toggle('camera'),
      u: toggle('photos'),
      p: openControl,
      '?': toggle('help'),
      Escape: () => setPanel('none'),
    }),
    [],
  );
  useKeys(local);

  // コントロール画面からのカメラの操作を受ける。描けているかも知らせる
  useEffect(() => serveCamera(), []);
  useDisplayHeartbeat();

  // カメラを隠す前と後の静止画（変化盲の答え合わせ用）
  const prevMode = useRef(state.wipe.mode);
  useEffect(() => {
    const was = prevMode.current;
    const now = state.wipe.mode;
    prevMode.current = now;
    if (was !== 'hidden' && now === 'hidden') {
      setSnapshot('before', tracker.snapshot());
      setSnapshot('after', null);
    } else if (was === 'hidden' && now !== 'hidden') {
      const t = window.setTimeout(() => setSnapshot('after', tracker.snapshot()), 700);
      return () => window.clearTimeout(t);
    }
  }, [state.wipe.mode]);

  useEffect(() => {
    tracker.mirror = state.wipe.mirror;
  }, [state.wipe.mirror]);
  useEffect(() => {
    tracker.zoom = state.settings.wipeZoom;
  }, [state.settings.wipeZoom]);

  // 開いたらカメラを始める（初めてなら、この窓にブラウザの許可の確認が出る）
  useEffect(() => {
    if (tracker.status === 'idle') void tracker.start();
  }, []);

  // マウスは動かしたときだけ出し、2秒止まったら隠す（共有の画面に矢印を残さない）
  const [cursor, setCursor] = useState(false);
  useEffect(() => {
    let t = 0;
    const onMove = () => {
      setCursor(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setCursor(false), 2000);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.clearTimeout(t);
    };
  }, []);

  return (
    <div className={`display ${cursor ? 'is-pointer' : ''}`}>
      <StageCanvas state={state} lesson={lesson} />
      <MusicPlayer role="display" />
      {panel === 'camera' && <CameraSetup state={state} lesson={lesson} onClose={() => setPanel('none')} />}
      {panel === 'photos' && <PhotoTray onClose={() => setPanel('none')} />}
      {panel === 'help' && <KeyHelp onClose={() => setPanel('none')} />}
    </div>
  );
}

export function KeyHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel panel--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="panel__head">
          <h2>操作</h2>
          <button onClick={onClose}>閉じる</button>
        </div>
        <table className="keys">
          <tbody>
            {KEY_HELP.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
