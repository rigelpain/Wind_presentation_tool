// カメラ → 顔検出 → 2人の追尾 → ワイプの切り出し枠。
// 顔のデータはこのブラウザの中だけで扱い、保存も送信もしない（検出はすべて端末内の wasm で動く）。
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { OneEuro } from './oneEuro';

export type TrackId = 'A' | 'B';
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TrackerStatus = 'idle' | 'starting' | 'running' | 'error';

/** ワイプの縦横比（横:縦） */
export const WIPE_ASPECT = 4 / 3;
/** 顔を見失ってから、直前の枠のまま待つ時間 */
const HOLD_MS = 2500;
/** 待っても戻らないとき、ゆっくり引く速さ（時定数・秒） */
const RETREAT_TAU = 1.4;
/** 出力の最後のならし（時定数・秒）。見つけ直したときの飛びを抑える */
const OUTPUT_TAU = 0.12;

class Track {
  raw: Box | null = null;
  lostSince: number | null = null;
  seen = false;
  crop: Box | null = null;
  private fx = new OneEuro(0.5, 0.004);
  private fy = new OneEuro(0.5, 0.004);
  private fh = new OneEuro(0.3, 0.002);

  constructor(readonly id: TrackId) {}

  reset() {
    this.raw = null;
    this.lostSince = null;
    this.seen = false;
    this.crop = null;
    this.fx.reset();
    this.fy.reset();
    this.fh.reset();
  }

  /** 顔の枠から、肩までが入る切り出し枠の中心と高さを作り、ならす */
  smoothTarget(face: Box, tSec: number): { cx: number; cy: number; h: number } {
    const cx = face.x + face.w / 2;
    const cy = face.y + face.h * 0.78;
    const h = face.h * 2.5;
    return { cx: this.fx.filter(cx, tSec), cy: this.fy.filter(cy, tSec), h: this.fh.filter(h, tSec) };
  }
}

function center(b: Box) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function clampCrop(cx: number, cy: number, h: number, vw: number, vh: number): Box {
  let hh = Math.min(h, vh, vw / WIPE_ASPECT);
  hh = Math.max(hh, 40);
  const ww = hh * WIPE_ASPECT;
  const x = Math.min(Math.max(cx - ww / 2, 0), vw - ww);
  const y = Math.min(Math.max(cy - hh / 2, 0), vh - hh);
  return { x, y, w: ww, h: hh };
}

function lerpBox(a: Box, b: Box, k: number): Box {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k };
}

export interface Snapshot {
  full: string;
  A: string | null;
  B: string | null;
  at: number;
}

class FaceTracker {
  readonly video: HTMLVideoElement;
  status: TrackerStatus = 'idle';
  error = '';
  devices: MediaDeviceInfo[] = [];
  deviceId = '';
  detections: Box[] = [];
  /** 表示の左右を鏡にしているか（登録で「左の人」を決めるのに使う） */
  mirror = false;
  readonly tracks: Record<TrackId, Track> = { A: new Track('A'), B: new Track('B') };
  fps = 0;

  private stream: MediaStream | null = null;
  private detector: FaceDetector | null = null;
  private running = false;
  private lastVideoTime = -1;
  private lastFrameT = 0;
  private listeners = new Set<() => void>();

  constructor() {
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
    try {
      this.deviceId = localStorage.getItem('wind-camera-device') ?? '';
    } catch {
      /* なくてよい */
    }
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  get width() {
    return this.video.videoWidth || 1280;
  }
  get height() {
    return this.video.videoHeight || 720;
  }

  async listDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      this.devices = all.filter((d) => d.kind === 'videoinput');
    } catch {
      this.devices = [];
    }
    this.emit();
  }

  async start(deviceId?: string) {
    if (deviceId !== undefined) {
      this.deviceId = deviceId;
      try {
        localStorage.setItem('wind-camera-device', deviceId);
      } catch {
        /* なくてよい */
      }
    }
    this.stopStream();
    this.status = 'starting';
    this.error = '';
    this.emit();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: this.deviceId ? { exact: this.deviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      await this.listDevices();
      if (!this.detector) this.detector = await createDetector();
      this.status = 'running';
      this.tracks.A.reset();
      this.tracks.B.reset();
      this.running = true;
      this.emit();
      this.loop();
    } catch (e) {
      this.status = 'error';
      this.error = describeError(e);
      this.emit();
    }
  }

  private stopStream() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  stop() {
    this.stopStream();
    this.status = 'idle';
    this.emit();
  }

  private loop = () => {
    if (!this.running) return;
    const v = this.video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    this.tick();
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(this.loop);
    else requestAnimationFrame(this.loop);
  };

  private tick() {
    const det = this.detector;
    if (!det || this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;
    const now = performance.now();
    let result;
    try {
      result = det.detectForVideo(this.video, now);
    } catch {
      return;
    }
    const boxes: Box[] = [];
    for (const d of result.detections) {
      const b = d.boundingBox;
      if (!b) continue;
      boxes.push({ x: b.originX, y: b.originY, w: b.width, h: b.height });
    }
    this.detections = boxes;
    if (this.lastFrameT) this.fps = this.fps * 0.9 + (1000 / (now - this.lastFrameT)) * 0.1;
    this.lastFrameT = now;
    this.update(boxes, now);
  }

  /** 画面での左から右の順に並べる（鏡のときは逆） */
  private displayOrder(boxes: Box[]): Box[] {
    const sorted = [...boxes].sort((a, b) => center(a).x - center(b).x);
    return this.mirror ? sorted.reverse() : sorted;
  }

  /** いま映っている2人を、画面の左の人＝A、右の人＝B として登録し直す */
  register(): boolean {
    const faces = this.largest(this.detections, 2);
    if (faces.length === 0) return false;
    const ordered = this.displayOrder(faces);
    this.tracks.A.reset();
    this.tracks.B.reset();
    const now = performance.now();
    if (ordered.length === 1) {
      this.assign(this.tracks.A, ordered[0], now);
    } else {
      this.assign(this.tracks.A, ordered[0], now);
      this.assign(this.tracks.B, ordered[1], now);
    }
    this.emit();
    return true;
  }

  private largest(boxes: Box[], n: number) {
    return [...boxes].sort((a, b) => b.w * b.h - a.w * a.h).slice(0, n);
  }

  private assign(t: Track, face: Box, now: number) {
    t.raw = face;
    t.seen = true;
    t.lostSince = null;
    const s = t.smoothTarget(face, now / 1000);
    const target = clampCrop(s.cx, s.cy, s.h, this.width, this.height);
    t.crop = t.crop ? lerpBox(t.crop, target, 1) : target;
  }

  private update(boxes: Box[], now: number) {
    const A = this.tracks.A;
    const B = this.tracks.B;
    const vw = this.width;
    // 最初に2人がそろったら自動で登録する（あとで「登録」を押し直せる）
    if (!A.seen && !B.seen) {
      if (boxes.length >= 2) this.register();
      else if (boxes.length === 1) this.assign(A, boxes[0], now);
      this.retreat(now);
      return;
    }

    // 近い順に結びつける（2人なので総当たりで足りる）
    const pairs: { t: Track; i: number; cost: number }[] = [];
    for (const t of [A, B]) {
      if (!t.raw) continue;
      const c = center(t.raw);
      boxes.forEach((b, i) => {
        const d = center(b);
        const dist = Math.hypot(d.x - c.x, d.y - c.y) / vw;
        const size = Math.abs(b.w - t.raw!.w) / Math.max(b.w, t.raw!.w);
        pairs.push({ t, i, cost: dist + size * 0.3 });
      });
    }
    pairs.sort((a, b) => a.cost - b.cost);
    const usedT = new Set<Track>();
    const usedI = new Set<number>();
    for (const p of pairs) {
      if (usedT.has(p.t) || usedI.has(p.i)) continue;
      // 見失って間もないうちは遠くへ飛ばない。しばらく見失っていたら、どこで見つけても戻す
      const limit = p.t.lostSince && now - p.t.lostSince > 1000 ? 0.6 : 0.25;
      if (p.cost > limit) continue;
      usedT.add(p.t);
      usedI.add(p.i);
      this.assign(p.t, boxes[p.i], now);
    }
    // まだ一度も見ていない方に、残りの顔を渡す
    for (const t of [A, B]) {
      if (usedT.has(t) || t.raw) continue;
      const i = boxes.findIndex((_, k) => !usedI.has(k));
      if (i >= 0) {
        usedT.add(t);
        usedI.add(i);
        this.assign(t, boxes[i], now);
      }
    }
    for (const t of [A, B]) {
      if (!usedT.has(t) && t.lostSince === null) t.lostSince = now;
    }
    this.retreat(now);
  }

  /** 見失って HOLD_MS たっても戻らない方は、その人がいた側の半分へゆっくり引く */
  private retreat(now: number) {
    const vw = this.width;
    const vh = this.height;
    for (const t of [this.tracks.A, this.tracks.B]) {
      const lostFor = t.lostSince === null ? (t.seen ? 0 : Infinity) : now - t.lostSince;
      if (lostFor < HOLD_MS) continue;
      const side = t.raw ? center(t.raw).x < vw / 2 : t.id === 'A' ? !this.mirror : this.mirror;
      const h = Math.min(vh, (vw / 2) / WIPE_ASPECT);
      const target = clampCrop(side ? vw * 0.25 : vw * 0.75, vh / 2, h, vw, vh);
      if (!t.crop) t.crop = target;
      else t.crop = lerpBox(t.crop, target, 1 - Math.exp(-(1 / 30) / RETREAT_TAU));
    }
  }

  /** 描く直前の枠。最後に軽くならして、見つけ直したときの飛びを抑える */
  private shown: Record<TrackId, Box | null> = { A: null, B: null };
  private shownT = 0;
  cropFor(id: TrackId): Box | null {
    const now = performance.now();
    const target = this.tracks[id].crop;
    if (!target) return null;
    const prev = this.shown[id];
    if (!prev) {
      this.shown[id] = target;
      return target;
    }
    const dt = Math.min(0.1, Math.max(0.001, (now - this.shownT) / 1000 || 1 / 60));
    const next = lerpBox(prev, target, 1 - Math.exp(-dt / OUTPUT_TAU));
    this.shown[id] = next;
    return next;
  }
  /** 1フレームに1回呼ぶ（cropFor の時間の基準） */
  frameDone() {
    this.shownT = performance.now();
  }

  isLost(id: TrackId): boolean {
    const t = this.tracks[id];
    return !t.seen || t.lostSince !== null;
  }

  /** いまのカメラの全体と、2人の切り出しを静止画にする（このブラウザのメモリにだけ置く） */
  snapshot(): Snapshot | null {
    if (this.status !== 'running' || this.video.readyState < 2) return null;
    const vw = this.width;
    const vh = this.height;
    const full = document.createElement('canvas');
    full.width = vw;
    full.height = vh;
    const ctx = full.getContext('2d')!;
    if (this.mirror) {
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.video, 0, 0, vw, vh);
    const crop = (id: TrackId) => {
      const b = this.tracks[id].crop;
      if (!b) return null;
      // 前後を比べやすいよう、ワイプより少し広めに切る
      const wide = clampCrop(b.x + b.w / 2, b.y + b.h / 2, b.h * 1.25, vw, vh);
      const c = document.createElement('canvas');
      c.width = 960;
      c.height = Math.round(960 / WIPE_ASPECT);
      const cx = c.getContext('2d')!;
      if (this.mirror) {
        cx.translate(c.width, 0);
        cx.scale(-1, 1);
      }
      cx.drawImage(this.video, wide.x, wide.y, wide.w, wide.h, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.9);
    };
    return { full: full.toDataURL('image/jpeg', 0.85), A: crop('A'), B: crop('B'), at: Date.now() };
  }
}

async function createDetector(): Promise<FaceDetector> {
  const base = import.meta.env.BASE_URL;
  const fileset = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: `${base}models/blaze_face_short_range.tflite`, delegate },
    runningMode: 'VIDEO' as const,
    minDetectionConfidence: 0.5,
  });
  try {
    return await FaceDetector.createFromOptions(fileset, options('GPU'));
  } catch {
    return await FaceDetector.createFromOptions(fileset, options('CPU'));
  }
}

function describeError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') return 'カメラの使用が許可されていません。ブラウザの設定で許可してください。';
    if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') return 'カメラが見つかりません。つなぎ直すか、別のカメラを選んでください。';
    if (e.name === 'NotReadableError') return 'カメラを別のアプリが使っています。会議ツールのカメラを止めるか、別のカメラを選んでください。';
  }
  return e instanceof Error ? e.message : String(e);
}

export const tracker = new FaceTracker();
