// キーボードとプレゼン用リモコンの操作。リモコンは多くが → ← / PageDown PageUp / B か . を送る。
import { useEffect } from 'react';
import { boardCellsOf } from './registry';
import { dispatch, getStore } from './store';

export interface LocalKeys {
  /** この窓だけで効く操作（全画面、パネルの開け閉め など） */
  [key: string]: (() => void) | undefined;
}

const BOARD_KEYS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Backspace', 'Enter', 'ArrowUp', 'ArrowDown', '*']);

export function useKeys(local: LocalKeys) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const store = getStore();
      const scene = store.lesson.scenes[store.getState().sceneIndex];
      const onBoard = scene ? boardCellsOf(scene) > 0 : false;
      if (onBoard && BOARD_KEYS.has(e.key)) {
        e.preventDefault();
        dispatch({ type: 'board-key', key: e.key });
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const fn = local[k];
      if (fn) {
        e.preventDefault();
        fn();
        return;
      }
      switch (k) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
        case 'Enter':
          e.preventDefault();
          dispatch({ type: 'next' });
          break;
        case 'ArrowLeft':
        case 'PageUp':
        case 'Backspace':
          e.preventDefault();
          dispatch({ type: 'prev' });
          break;
        case 'b':
        case '.':
          dispatch({ type: 'blackout' });
          break;
        case 'e':
          dispatch({ type: 'toggle-explain' });
          break;
        case 'h':
          dispatch({ type: 'toggle-hidden' });
          break;
        case 'w':
          dispatch({ type: 'wipe', mode: 'both' });
          break;
        case 's':
          dispatch({ type: 'swap' });
          break;
        case 'r':
          dispatch({ type: 'replay' });
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [local]);
}

export const KEY_HELP: [string, string][] = [
  ['→ / Space / PageDown', '進む（場面の中の次の段階も）'],
  ['← / PageUp', '戻る'],
  ['E', '解説モード（解説の顔を大きく）の入り切り'],
  ['H', 'カメラを隠す・戻す'],
  ['W', 'ワイプを2人とも同じ大きさに'],
  ['S', 'ワイプの左右を入れ替える'],
  ['R', 'もう一度（3秒提示など）'],
  ['B / .', '画面を黒にする・戻す'],
  ['数字 → Enter', '数のボードに入れる（↑↓でセルを移る、* で印）'],
  ['F', '全画面（舞台の窓）'],
  ['C', 'カメラの準備（舞台の窓）'],
  ['P', '発表者用の画面を開く（舞台の窓）'],
  ['U', '写真の読み込み'],
  ['?', '操作の一覧'],
];
