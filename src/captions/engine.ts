// 話し声の字幕。コントロール画面の窓でマイクの声を聞き取り（ブラウザの音声認識）、文字だけを表示画面へ送る。
// 日本語の音声認識は、Chrome が端末の中でできればそれを使い、できなければ Google のサーバーで文字にする（無料、ネットが要る）。
// 聞き取った文字は保存しない。
import { useEffect, useSyncExternalStore } from 'react';
import { useShow } from '../engine/store';

export interface CaptionLine {
  /** 行の番号。聞き取り中の行が確定しても同じ番号のまま（表示画面で行が飛ばないように） */
  id: number;
  text: string;
}

export interface CaptionMessage {
  /** 確定した文（新しいものが最後） */
  finals: CaptionLine[];
  /** 聞き取り中の文 */
  interim: CaptionLine | null;
  /** 最後に声を聞いた時刻 */
  at: number;
}

export type CaptionStatus =
  | { state: 'off' }
  | { state: 'unsupported' }
  | { state: 'starting' }
  | { state: 'listening'; local: boolean }
  | { state: 'error'; message: string };

const CHANNEL = 'wind-captions';

type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};
type SRClass = (new () => SR) & { available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string> };

function srClass(): SRClass | null {
  const w = window as unknown as { SpeechRecognition?: SRClass; webkitSpeechRecognition?: SRClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

let status: CaptionStatus = { state: 'off' };
const listeners = new Set<() => void>();
function setStatus(s: CaptionStatus) {
  status = s;
  listeners.forEach((fn) => fn());
}

export function useCaptionStatus(): CaptionStatus {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => status,
  );
}

/** コントロール画面で呼ぶ。設定の enabled に合わせて聞き取りを始め・止める */
export function useCaptionEngine() {
  const enabled = useShow().settings.captions.enabled;
  useEffect(() => {
    if (!enabled) {
      setStatus({ state: 'off' });
      return;
    }
    const Klass = srClass();
    if (!Klass) {
      setStatus({ state: 'unsupported' });
      return;
    }
    const ch = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
    let rec: SR | null = null;
    let stopped = false;
    let finals: CaptionLine[] = [];
    let nextId = 1;
    let restartTimer = 0;
    let local = false;
    let fatal = false;
    // 聞き取りが文字を出さずに止まり続けるとき（ネットがない、ブラウザが対応していない など）は、
    // やり直しの間を 0.3 秒から 10 秒まで延ばして、画面が重くならないようにする
    let quickEnds = 0;
    let startedAt = 0;

    const post = (interim: string) => {
      const msg: CaptionMessage = { finals: finals.slice(-4), interim: interim ? { id: nextId, text: interim } : null, at: Date.now() };
      ch?.postMessage(msg);
    };

    const begin = () => {
      if (stopped) return;
      rec = new Klass();
      rec.lang = 'ja-JP';
      rec.continuous = true;
      rec.interimResults = true;
      if (local) rec.processLocally = true;
      rec.onstart = () => setStatus({ state: 'listening', local });
      startedAt = performance.now();
      rec.onresult = (e: any) => {
        quickEnds = 0;
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const text = String(r[0]?.transcript ?? '').trim();
          if (!text) continue;
          if (r.isFinal) finals = [...finals, { id: nextId++, text }].slice(-4);
          else interim += text;
        }
        post(interim);
      };
      rec.onerror = (e: any) => {
        const code = String(e?.error ?? '');
        if (code === 'no-speech' || code === 'aborted') return; // 黙っていただけ。onend でやり直す
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          fatal = true;
          setStatus({ state: 'error', message: 'マイクが許可されていません。この窓の住所の左の印から、マイクを「許可」にしてください。macOS の設定（プライバシーとセキュリティ → マイク）で Chrome がオンかも確かめてください。' });
        } else if (code === 'network') {
          setStatus({ state: 'error', message: 'ネットにつながっていないので、字幕を作れません（つながれば自動で戻ります）。' });
        } else if (code === 'audio-capture') {
          setStatus({ state: 'error', message: 'マイクが見つかりません。' });
        } else {
          setStatus({ state: 'error', message: `音声認識が止まりました（${code}）。自動でやり直します。` });
        }
      };
      rec.onend = () => {
        // 音声認識は、黙っている時間が続くと自分で止まる。止める指示がなければ、すぐ聞き直す
        if (stopped || fatal) return;
        quickEnds = performance.now() - startedAt < 3000 ? quickEnds + 1 : 0;
        const wait = Math.min(10_000, 300 * 2 ** Math.min(quickEnds, 6));
        restartTimer = window.setTimeout(begin, wait);
      };
      setStatus({ state: 'starting' });
      try {
        rec.start();
      } catch {
        restartTimer = window.setTimeout(begin, 1000);
      }
    };

    (async () => {
      // 端末の中で日本語を文字にできるなら、そちらを使う（声を外に送らない）
      try {
        local = (await Klass.available?.({ langs: ['ja-JP'], processLocally: true })) === 'available';
      } catch {
        local = false;
      }
      begin();
    })();

    return () => {
      stopped = true;
      window.clearTimeout(restartTimer);
      try {
        rec?.abort();
      } catch {
        /* もう止まっている */
      }
      ch?.postMessage({ finals: [], interim: null, at: 0 } satisfies CaptionMessage);
      ch?.close();
      setStatus({ state: 'off' });
    };
  }, [enabled]);
}

/** 表示画面で使う。届いた字幕 */
export function useCaptions(): CaptionMessage | null {
  return useSyncExternalStore(subscribeCaptions, () => latest);
}

let latest: CaptionMessage | null = null;
const capListeners = new Set<() => void>();
let capChannel: BroadcastChannel | null = null;
function subscribeCaptions(fn: () => void) {
  if (!capChannel && typeof BroadcastChannel !== 'undefined') {
    capChannel = new BroadcastChannel(CHANNEL);
    capChannel.onmessage = (e: MessageEvent<CaptionMessage>) => {
      latest = e.data;
      capListeners.forEach((f) => f());
    };
  }
  capListeners.add(fn);
  return () => {
    capListeners.delete(fn);
  };
}
