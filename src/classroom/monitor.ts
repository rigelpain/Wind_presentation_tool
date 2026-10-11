// 教室の様子を取り込んで「盛り上がり」を測る（コントロール画面）。
// 画面共有の仕組み（getDisplayMedia）で Zoom の窓やブラウザのタブを取り込み、
// 音の大きさと、選んだ枠の中の動きの量を測って、1つの「盛り上がり」にまとめる。
// 映像と音はこのPCの中で測るだけで、保存も送信もしない。
import { useSyncExternalStore } from 'react';

export interface Crop {
  /** 0〜1（取り込んだ映像の幅・高さに対する割合） */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Sample {
  at: number;
  /** 0〜1 */
  audio: number;
  motion: number;
  score: number;
}

export interface MonitorState {
  status: 'idle' | 'starting' | 'running' | 'error';
  error: string;
  /** 音も取り込めているか */
  hasAudio: boolean;
  /** 取り込んだものの名前（ブラウザが教えてくれるとき） */
  label: string;
  latest: Sample | null;
}

/** 測る間隔（ms） */
const TICK_MS = 250;
/** グラフに残す長さ（ms） */
const HISTORY_MS = 120_000;

class ClassroomMonitor {
  state: MonitorState = { status: 'idle', error: '', hasAudio: false, label: '', latest: null };
  history: Sample[] = [];
  readonly video: HTMLVideoElement;
  crop: Crop = { x: 0, y: 0, w: 1, h: 1 };
  /** 感度（1 が標準。大きいほど小さな音や動きで上がる） */
  gain = 1;

  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timer = 0;
  private small = document.createElement('canvas');
  private prev: Uint8ClampedArray | null = null;
  private smooth = 0;
  private listeners = new Set<() => void>();

  constructor() {
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.small.width = 96;
    this.small.height = 54;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getState = () => this.state;
  private set(patch: Partial<MonitorState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  async start() {
    this.stop();
    this.set({ status: 'starting', error: '' });
    try {
      // タブを選ぶと音も取れる。macOS と Chrome によっては、画面全体でもPCの音が取れる
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15 } },
        audio: true,
        // Chrome の追加の指定（対応していなければ無視される）
        ...({ systemAudio: 'include', selfBrowserSurface: 'exclude', surfaceSwitching: 'include' } as object),
      } as DisplayMediaStreamOptions);
      await this.attach(stream);
    } catch (e) {
      const name = (e as { name?: string })?.name;
      this.stop();
      if (name === 'NotAllowedError' || name === 'AbortError') {
        this.set({ status: 'idle', error: '' }); // 選ぶ画面で取り消した
      } else {
        this.set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  /** 取り込んだ映像（と音）を測り始める。試しのときは、作った MediaStream を直接渡してもよい */
  async attach(stream: MediaStream) {
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      this.ctx = new AudioContext();
      const src = this.ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      src.connect(this.analyser);
      void this.ctx.resume();
    }
    const v = stream.getVideoTracks()[0];
    // 取り込みを相手側（ブラウザの「共有を停止」）で止めたとき
    v?.addEventListener('ended', () => this.stop());
    this.history = [];
    this.prev = null;
    this.smooth = 0;
    this.set({ status: 'running', hasAudio: !!audioTrack, label: v?.label ?? '', latest: null });
    this.timer = window.setInterval(this.tick, TICK_MS);
  }

  stop() {
    window.clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    if (this.state.status !== 'idle') this.set({ status: 'idle', hasAudio: false, label: '', latest: null });
  }

  private audioLevel(): number {
    const an = this.analyser;
    if (!an) return 0;
    const buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const x of buf) sum += x * x;
    const rms = Math.sqrt(sum / buf.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    // -55dB〜-10dB を 0〜1 に
    return clamp01(((db + 55) / 45) * this.gain);
  }

  /** 枠の中を小さく縮めて、前の絵との明るさの違いの平均を測る */
  private motionLevel(): number {
    const v = this.video;
    if (v.readyState < 2 || !v.videoWidth) return 0;
    const c = this.small;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const { x, y, w, h } = this.crop;
    ctx.drawImage(v, x * v.videoWidth, y * v.videoHeight, w * v.videoWidth, h * v.videoHeight, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const gray = new Uint8ClampedArray(c.width * c.height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) gray[j] = (data[i] * 3 + data[i + 1] * 6 + data[i + 2]) / 10;
    const prev = this.prev;
    this.prev = gray;
    if (!prev || prev.length !== gray.length) return 0;
    let diff = 0;
    for (let i = 0; i < gray.length; i++) diff += Math.abs(gray[i] - prev[i]);
    const mean = diff / gray.length; // 0〜255
    // 平均で 0.5 くらいは映像の揺らぎ。12 で目いっぱい
    return clamp01(((mean - 0.5) / 12) * this.gain);
  }

  private tick = () => {
    const audio = this.audioLevel();
    const motion = this.motionLevel();
    // 音がとれていれば音を重く見る。とれていなければ動きだけ
    const raw = this.analyser ? 0.6 * audio + 0.4 * motion : motion;
    // 急に上下しないよう、ならす（上がるときは速く、下がるときはゆっくり）
    const k = raw > this.smooth ? 0.5 : 0.12;
    this.smooth += (raw - this.smooth) * k;
    const s: Sample = { at: Date.now(), audio, motion, score: this.smooth };
    this.history.push(s);
    const cut = s.at - HISTORY_MS;
    while (this.history.length && this.history[0].at < cut) this.history.shift();
    this.set({ latest: s });
  };
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export const classroom = new ClassroomMonitor();

export function useClassroom(): MonitorState {
  return useSyncExternalStore(classroom.subscribe, classroom.getState);
}

export const CLASSROOM_HISTORY_MS = HISTORY_MS;
