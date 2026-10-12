// 編集の取り消し（⌘Z）とやり直し（⇧⌘Z）。続けて打った文字などは、0.6秒の区切りで1回にまとめる。
import { useCallback, useRef, useState } from 'react';

const LIMIT = 150;
const MERGE_MS = 600;

export interface History<T> {
  value: T;
  /** 変える。merge なら、直前の変更と1回にまとめてよい（文字を打っているとき、カードを動かしているとき） */
  set: (next: T | ((cur: T) => T), opts?: { merge?: boolean }) => void;
  /** 取り消しの記録を残さずに置き換える（授業を開き直したとき） */
  reset: (value: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory<T>(initial: T | (() => T)): History<T> {
  const [state, setState] = useState(() => ({
    value: typeof initial === 'function' ? (initial as () => T)() : initial,
    past: [] as T[],
    future: [] as T[],
  }));
  const lastAt = useRef(0);

  const set = useCallback((next: T | ((cur: T) => T), opts?: { merge?: boolean }) => {
    setState((s) => {
      const value = typeof next === 'function' ? (next as (cur: T) => T)(s.value) : next;
      if (value === s.value) return s;
      const now = Date.now();
      const merge = opts?.merge && now - lastAt.current < MERGE_MS && s.past.length > 0;
      lastAt.current = now;
      return { value, past: merge ? s.past : [...s.past, s.value].slice(-LIMIT), future: [] };
    });
  }, []);

  const reset = useCallback((value: T) => setState({ value, past: [], future: [] }), []);

  const undo = useCallback(() => {
    lastAt.current = 0;
    setState((s) => (s.past.length ? { value: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.value, ...s.future] } : s));
  }, []);
  const redo = useCallback(() => {
    lastAt.current = 0;
    setState((s) => (s.future.length ? { value: s.future[0], past: [...s.past, s.value], future: s.future.slice(1) } : s));
  }, []);

  return { value: state.value, set, reset, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
