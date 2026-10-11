// 表示画面が描けているかを、コントロール画面に知らせる。
// Zoom のウィンドウ共有は、表示画面が描いたものをそのまま送る。表示画面が最小化されたり、
// ほかの窓の後ろに完全に隠れたりすると、ブラウザが描くのを止め、共有の絵も止まることがある。
import { useEffect, useState } from 'react';

export interface DisplayBeat {
  /** 1秒あたりに描いた回数 */
  fps: number;
  visible: boolean;
  fullscreen: boolean;
  width: number;
  height: number;
  at: number;
}

const NAME = 'wind-display';

/** 表示画面で呼ぶ */
export function useDisplayHeartbeat() {
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(NAME);
    let frames = 0;
    let raf = 0;
    const count = () => {
      frames++;
      raf = requestAnimationFrame(count);
    };
    raf = requestAnimationFrame(count);
    let last = performance.now();
    // setInterval も隠れると間引かれるので、届く間隔そのものを fps の計算に使う
    const timer = window.setInterval(() => {
      const now = performance.now();
      const fps = Math.round((frames * 1000) / Math.max(1, now - last));
      frames = 0;
      last = now;
      ch.postMessage({
        fps,
        visible: document.visibilityState === 'visible',
        fullscreen: !!document.fullscreenElement,
        width: window.innerWidth,
        height: window.innerHeight,
        at: Date.now(),
      } satisfies DisplayBeat);
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      ch.close();
    };
  }, []);
}

/** コントロール画面で呼ぶ。null は表示画面から届いていない（開いていないか、止まっている） */
export function useDisplayStatus(): DisplayBeat | null {
  const [beat, setBeat] = useState<DisplayBeat | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(NAME);
    ch.onmessage = (e: MessageEvent<DisplayBeat>) => setBeat(e.data);
    const t = window.setInterval(() => setBeat((b) => (b && Date.now() - b.at > 3500 ? null : b)), 1000);
    return () => {
      window.clearInterval(t);
      ch.close();
    };
  }, []);
  return beat;
}
