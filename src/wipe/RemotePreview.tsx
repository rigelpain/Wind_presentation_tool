// コントロール画面の確認の映像。コントロール画面が自分で同じカメラを開いてなめらかに映し、
// 顔の枠は表示画面から届く数字を重ねる（映像は窓のあいだで送らない）。
// 同じカメラを開けないとき（動画・画像のファイルで試しているときなど）は、表示画面から届く絵を出す。
import { useEffect, useRef, useState } from 'react';
import { useLesson, useShow } from '../engine/store';
import type { CameraRemote } from './bus';
import { drawBoxes } from './debugDraw';

export function RemotePreview({ remote }: { remote: CameraRemote }) {
  const state = useShow();
  const lesson = useLesson();
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const [live, setLive] = useState(false);
  const status = remote.status;
  const deviceId = status?.status === 'running' && status.source === 'camera' ? status.deviceId : null;

  // 表示画面と同じカメラを開く
  useEffect(() => {
    if (!deviceId) {
      setLive(false);
      remote.setLive(false);
      return;
    }
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ audio: false, video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.srcObject = s;
        await v.play();
        video.current = v;
        setLive(true);
        remote.setLive(true);
      })
      .catch(() => {
        setLive(false);
        remote.setLive(false);
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      video.current = null;
      setLive(false);
      remote.setLive(false);
    };
    // remote は毎回新しいオブジェクトだが、setLive は ref を通すので依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const v = video.current;
      const c = canvas.current;
      if (!v || !c || v.readyState < 2) return;
      const data = remote.boxes.current ?? { w: v.videoWidth, h: v.videoHeight, detections: [], tracks: { A: { crop: null, lost: true }, B: { crop: null, lost: true } } };
      drawBoxes(c, v, data, { swapped: state.wipe.swapped, mirror: state.wipe.mirror, labels: lesson.roleLabels, maxWidth: 960 });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [live, state.wipe.swapped, state.wipe.mirror, lesson.roleLabels, remote.boxes]);

  if (live) return <canvas ref={canvas} className="remote-preview" />;
  if (remote.preview) return <img src={remote.preview} alt="カメラの確認の絵" className="remote-preview" />;
  return null;
}
