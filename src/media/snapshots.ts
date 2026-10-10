// カメラを隠す前と後の静止画。顔が写るので、このブラウザのメモリにだけ置く（保存も送信もしない）。
import { useSyncExternalStore } from 'react';
import type { Snapshot } from '../wipe/tracker';

interface Pair {
  before: Snapshot | null;
  after: Snapshot | null;
}

let pair: Pair = { before: null, after: null };
const listeners = new Set<() => void>();

export function setSnapshot(which: 'before' | 'after', snap: Snapshot | null) {
  pair = { ...pair, [which]: snap };
  listeners.forEach((fn) => fn());
}

export function clearSnapshots() {
  pair = { before: null, after: null };
  listeners.forEach((fn) => fn());
}

export function useSnapshots(): Pair {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => pair,
  );
}
