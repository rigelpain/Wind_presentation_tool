// 状態の置き場。同じPCの窓どうし（舞台と発表者用）は BroadcastChannel で同期し、
// localStorage に書いておくのでリロードしても今の場面に戻れる。
import { useEffect, useState, useSyncExternalStore } from 'react';
import { initialState, reduce } from './reducer';
import type { Action, Lesson, ShowState } from './types';

type Message = { type: 'state'; state: ShowState; from: string } | { type: 'hello'; from: string };

const WINDOW_ID = Math.random().toString(36).slice(2);

export class ShowStore {
  private state: ShowState;
  private listeners = new Set<() => void>();
  private channel: BroadcastChannel | null = null;
  private readonly key: string;

  constructor(readonly lesson: Lesson) {
    this.key = `wind-show:${lesson.id}`;
    this.state = this.load() ?? initialState(lesson);
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`wind-show:${lesson.id}`);
      this.channel.onmessage = (e: MessageEvent<Message>) => this.receive(e.data);
      this.channel.postMessage({ type: 'hello', from: WINDOW_ID } satisfies Message);
    }
    // 別の窓が localStorage を書いたとき（BroadcastChannel がない場合の保険）
    window.addEventListener('storage', (e) => {
      if (e.key !== this.key || !e.newValue) return;
      try {
        this.adopt(JSON.parse(e.newValue) as ShowState);
      } catch {
        /* 壊れた値は無視 */
      }
    });
  }

  getState = (): ShowState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  dispatch = (action: Action): void => {
    const next = reduce(this.state, action, this.lesson);
    if (next === this.state) return;
    this.set({ ...next, rev: this.state.rev + 1 }, true);
  };

  private set(state: ShowState, broadcast: boolean) {
    this.state = state;
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch {
      /* 保存できなくても授業は続ける */
    }
    if (broadcast) this.channel?.postMessage({ type: 'state', state, from: WINDOW_ID } satisfies Message);
    this.listeners.forEach((fn) => fn());
  }

  private adopt(state: ShowState) {
    if (state.lessonId !== this.lesson.id) return;
    if (state.rev < this.state.rev) return;
    if (state.rev === this.state.rev && JSON.stringify(state) === JSON.stringify(this.state)) return;
    this.set(state, false);
  }

  private receive(msg: Message) {
    if (msg.from === WINDOW_ID) return;
    if (msg.type === 'hello') {
      this.channel?.postMessage({ type: 'state', state: this.state, from: WINDOW_ID } satisfies Message);
    } else if (msg.type === 'state') {
      this.adopt(msg.state);
    }
  }

  private load(): ShowState | null {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const s = JSON.parse(raw) as ShowState;
      if (s.lessonId !== this.lesson.id) return null;
      // 授業の場面が減っていたら範囲に収める
      const fresh = initialState(this.lesson);
      return {
        ...fresh,
        ...s,
        wipe: { ...fresh.wipe, ...s.wipe },
        sceneIndex: Math.min(s.sceneIndex, this.lesson.scenes.length - 1),
      };
    } catch {
      return null;
    }
  }
}

let store: ShowStore | null = null;

export function createStore(lesson: Lesson): ShowStore {
  store = new ShowStore(lesson);
  return store;
}

export function getStore(): ShowStore {
  if (!store) throw new Error('store is not created');
  return store;
}

export function useShow(): ShowState {
  const s = getStore();
  return useSyncExternalStore(s.subscribe, s.getState);
}

export function dispatch(action: Action): void {
  getStore().dispatch(action);
}

/** 1秒ごと（または指定の間隔）に描き直すための今の時刻 */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
