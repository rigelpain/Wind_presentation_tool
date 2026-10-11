// マイクの音の大きさ（コントロール画面の音量の表示）。音はこのPCの中で測るだけで、録音も送信もしない。
// いくつかの部品が同時に使っても、マイクは1つだけ開く。
import { useEffect, useState } from 'react';

export interface MicLevel {
  /** 0〜1（-60dB〜0dB を割り当てる） */
  level: number;
  /** 少し前までの大きい方（ゆっくり下がる） */
  peak: number;
  db: number;
  state: 'off' | 'starting' | 'on' | 'error';
}

let users = 0;
let stream: MediaStream | null = null;
let ctx: AudioContext | null = null;
let raf = 0;
let current: MicLevel = { level: 0, peak: 0, db: -Infinity, state: 'off' };
const listeners = new Set<(m: MicLevel) => void>();

function emit(m: MicLevel) {
  current = m;
  listeners.forEach((fn) => fn(m));
}

async function open() {
  emit({ ...current, state: 'starting' });
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    if (users === 0) {
      close();
      return;
    }
    ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      // ブラウザは、画面を一度も押していないと音の処理を止めておく。押したら動かす
      const c = ctx;
      const resume = () => {
        void c.resume();
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
      void c.resume();
    }
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 60) return; // 1秒に16回ほど
      last = t;
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
      const level = Math.max(0, Math.min(1, (db + 60) / 60));
      peak = Math.max(level, peak - 0.02);
      emit({ level, peak, db, state: ctx?.state === 'suspended' ? 'starting' : 'on' });
    };
    raf = requestAnimationFrame(tick);
  } catch {
    emit({ level: 0, peak: 0, db: -Infinity, state: 'error' });
  }
}

function close() {
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  void ctx?.close();
  ctx = null;
  emit({ level: 0, peak: 0, db: -Infinity, state: 'off' });
}

/** active のあいだマイクの大きさを測る */
export function useMicLevel(active: boolean): MicLevel {
  const [m, setM] = useState<MicLevel>(current);
  useEffect(() => {
    if (!active) return;
    listeners.add(setM);
    users++;
    if (users === 1) void open();
    return () => {
      listeners.delete(setM);
      users--;
      if (users === 0) close();
    };
  }, [active]);
  return active ? m : { level: 0, peak: 0, db: -Infinity, state: 'off' };
}

/** 声の大きさの目安 */
export function levelWord(db: number): string {
  if (!Number.isFinite(db) || db < -50) return '聞こえていない';
  if (db < -35) return '小さい';
  if (db < -8) return 'ちょうどよい';
  return '大きすぎ（割れるかも）';
}
