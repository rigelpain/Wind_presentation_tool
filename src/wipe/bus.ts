// 表示画面のカメラを、コントロール画面から操作する（同じPCの窓どうし。BroadcastChannel）。
// カメラと顔の追尾は表示画面だけで動く。コントロール画面には小さな確認用の絵だけを送る。
// どちらも同じブラウザの中で、外へは送らない。
import { useEffect, useState } from 'react';
import { getStore } from '../engine/store';
import { effectiveLesson } from '../engine/lesson';
import { drawCameraDebug } from './debugDraw';
import { tracker, type TrackerStatus } from './tracker';

export interface CameraStatus {
  status: TrackerStatus;
  error: string;
  devices: { deviceId: string; label: string }[];
  deviceId: string;
  faces: number;
  fps: number;
  /** 2人それぞれを見失っているか（A＝登録で左の人、B＝右の人） */
  lost: { A: boolean; B: boolean };
  /** 届いた時刻（表示画面が開いているかの目安） */
  at: number;
}

type Msg =
  | { type: 'cmd'; cmd: 'start'; deviceId?: string }
  | { type: 'cmd'; cmd: 'stop' }
  | { type: 'cmd'; cmd: 'register' }
  | { type: 'cmd'; cmd: 'file'; file: File }
  | { type: 'want' }
  | { type: 'status'; status: CameraStatus }
  | { type: 'preview'; blob: Blob };

const NAME = 'wind-camera';

function statusNow(): CameraStatus {
  return {
    status: tracker.status,
    error: tracker.error,
    devices: tracker.devices.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `カメラ ${i + 1}` })),
    deviceId: tracker.deviceId,
    faces: tracker.detections.length,
    fps: Math.round(tracker.fps),
    lost: { A: tracker.isLost('A'), B: tracker.isLost('B') },
    at: Date.now(),
  };
}

/** 表示画面で呼ぶ。止めるときは返り値の関数を呼ぶ */
export function serveCamera(): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(NAME);
  let wantUntil = 0;
  const send = () => ch.postMessage({ type: 'status', status: statusNow() } satisfies Msg);
  ch.onmessage = (e: MessageEvent<Msg>) => {
    const m = e.data;
    if (m.type === 'want') {
      wantUntil = Date.now() + 3000;
      if (tracker.devices.length === 0) void tracker.listDevices();
      send();
    } else if (m.type === 'cmd') {
      if (m.cmd === 'start') void tracker.start(m.deviceId);
      else if (m.cmd === 'stop') tracker.stop();
      else if (m.cmd === 'register') tracker.register();
      else if (m.cmd === 'file') void tracker.startFile(m.file);
    }
  };
  const unsub = tracker.subscribe(send);
  const canvas = document.createElement('canvas');
  let busy = false;
  const timer = window.setInterval(() => {
    if (Date.now() > wantUntil) return;
    send();
    if (busy) return;
    const st = getStore().getState();
    const lesson = effectiveLesson(getStore().lesson, st.settings);
    const ok = drawCameraDebug(canvas, { swapped: st.wipe.swapped, mirror: st.wipe.mirror, labels: lesson.roleLabels, maxWidth: 640 });
    if (!ok) return;
    busy = true;
    canvas.toBlob(
      (blob) => {
        busy = false;
        if (blob) ch.postMessage({ type: 'preview', blob } satisfies Msg);
      },
      'image/jpeg',
      0.7,
    );
  }, 250);
  return () => {
    window.clearInterval(timer);
    unsub();
    ch.close();
  };
}

export interface CameraRemote {
  /** 表示画面から状態が届いていなければ null（表示画面が開いていない） */
  status: CameraStatus | null;
  /** 確認用の絵（objectURL） */
  preview: string | null;
  start: (deviceId?: string) => void;
  stop: () => void;
  register: () => void;
  sendFile: (file: File) => void;
}

/** コントロール画面で使う */
export function useCameraRemote(): CameraRemote {
  const [status, setStatus] = useState<CameraStatus | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ch] = useState(() => (typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(NAME) : null));

  useEffect(() => {
    if (!ch) return;
    let url: string | null = null;
    ch.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (m.type === 'status') setStatus(m.status);
      else if (m.type === 'preview') {
        const next = URL.createObjectURL(m.blob);
        setPreview(next);
        if (url) URL.revokeObjectURL(url);
        url = next;
      }
    };
    const want = () => ch.postMessage({ type: 'want' } satisfies Msg);
    want();
    const timer = window.setInterval(() => {
      want();
      // 3秒届かなければ、表示画面が閉じたとみなす
      setStatus((s) => (s && Date.now() - s.at > 3000 ? null : s));
    }, 1000);
    return () => {
      window.clearInterval(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [ch]);

  useEffect(() => () => ch?.close(), [ch]);

  const post = (m: Msg) => ch?.postMessage(m);
  return {
    status,
    preview: status?.status === 'running' ? preview : null,
    start: (deviceId) => post({ type: 'cmd', cmd: 'start', deviceId }),
    stop: () => post({ type: 'cmd', cmd: 'stop' }),
    register: () => post({ type: 'cmd', cmd: 'register' }),
    sendFile: (file) => post({ type: 'cmd', cmd: 'file', file }),
  };
}
