// コントロール画面の「スライド」の枠。場面の並び・飛ばし・場面ごとの上書き（切り替え・ワイプ・音楽）を変える。
// 授業のデータ（src/lessons）は書き換えない。変えた中身は状態の settings に持つ。
import { useRef, useState } from 'react';
import { orderedScenes, type OrderedScene } from '../engine/lesson';
import { dispatch, getStore, useShow } from '../engine/store';
import type { SceneOverride, Transition, WipeMode } from '../engine/types';
import { useTracks } from '../media/audio';
import './SlidesPanel.css';

const TRANSITIONS: [Transition, string][] = [
  ['cut', 'カット'],
  ['black', '黒を挟む'],
  ['fade', '重ねる'],
  ['slide', '横すべり'],
];
const TRANSITION_NAME = Object.fromEntries(TRANSITIONS) as Record<Transition, string>;

const WIPES: [WipeMode, string][] = [
  ['both', '2人'],
  ['explain', '解説を大きく'],
  ['host', '進行だけ'],
  ['guest', '解説だけ'],
  ['hidden', 'カメラを隠す'],
];

/** 選択欄の値。空なら undefined（授業のデータのまま） */
function pick<T extends string>(value: string): T | undefined {
  return value === '' ? undefined : (value as T);
}

export function SlidesPanel() {
  const state = useShow();
  const tracks = useTracks();
  // 飛ばす場面も含めた並び（授業のもとのデータに、並び・上書きを当てたもの）
  const list: OrderedScene[] = orderedScenes(getStore().lesson, state.settings);
  const ids = list.map((o) => o.scene.id);

  const [openId, setOpenId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const dragging = useRef<string | null>(null);

  /** 行 from を、行 to のいた位置へ移す */
  const moveTo = (from: string, to: string) => {
    const a = ids.indexOf(from);
    const b = ids.indexOf(to);
    if (a < 0 || b < 0 || a === b) return;
    const next = [...ids];
    next.splice(a, 1);
    next.splice(b, 0, from);
    dispatch({ type: 'settings', patch: { order: next } });
  };

  const toggleSkip = (id: string, skip: boolean) => {
    const rest = state.settings.skipped.filter((x) => x !== id);
    dispatch({ type: 'settings', patch: { skipped: skip ? [...rest, id] : rest } });
  };

  const override = (sceneId: string, patch: SceneOverride) => dispatch({ type: 'scene-override', sceneId, patch });

  const resetAll = () => {
    if (!confirm('並び・飛ばし・場面ごとの上書き（切り替え・ワイプ・音楽）を、授業のデータどおりに戻します。よろしいですか？')) return;
    dispatch({ type: 'settings', patch: { order: null, skipped: [], overrides: {} } });
  };

  return (
    <div className="c-panel">
      <h3>場面の順番</h3>
      <div className="slides__top">
        <p className="hint">ドラッグか ↑↓ で並べ替え。チェックで飛ばす。変えた並びは授業のデータには書き戻さず、このPCに残ります</p>
        <button onClick={resetAll}>並びを元に戻す</button>
      </div>

      <ul className="slides__list">
        {list.map((o, pos) => {
          const { scene } = o;
          const id = scene.id;
          const isNow = o.index === state.sceneIndex;
          const isDone = o.index >= 0 && o.index < state.sceneIndex;
          const ov = state.settings.overrides[id] ?? {};
          const open = openId === id;
          const cls = ['slides__row', isNow && 'is-now', isDone && 'is-done', overId === id && 'is-over']
            .filter(Boolean)
            .join(' ');

          return (
            <li
              key={id}
              className={cls}
              onDragOver={(e) => {
                if (!dragging.current) return;
                e.preventDefault();
                setOverId(id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragging.current;
                dragging.current = null;
                setOverId(null);
                if (from) moveTo(from, id);
              }}
            >
              <div
                className="slides__head"
                draggable
                onDragStart={(e) => {
                  dragging.current = id;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', id);
                  const row = e.currentTarget.closest('li');
                  if (row) e.dataTransfer.setDragImage(row, 20, 16);
                }}
                onDragEnd={() => {
                  dragging.current = null;
                  setOverId(null);
                }}
              >
                <span className="slides__num">{o.skipped ? '—' : o.index + 1}</span>
                <div className="slides__main">
                  <button
                    className="slides__name"
                    disabled={o.skipped}
                    onClick={() => dispatch({ type: 'goto', index: o.index })}
                  >
                    {scene.title}
                  </button>
                  <span className="slides__kind">{scene.kind}</span>
                </div>
                <label className="slides__skip">
                  <input type="checkbox" checked={o.skipped} onChange={(e) => toggleSkip(id, e.target.checked)} />
                  飛ばす
                </label>
                <div className="slides__move">
                  <button
                    className="slides__btn"
                    title="上へ"
                    aria-label="上へ"
                    disabled={pos === 0}
                    onClick={() => moveTo(id, ids[pos - 1])}
                  >
                    ↑
                  </button>
                  <button
                    className="slides__btn"
                    title="下へ"
                    aria-label="下へ"
                    disabled={pos === ids.length - 1}
                    onClick={() => moveTo(id, ids[pos + 1])}
                  >
                    ↓
                  </button>
                </div>
                <button
                  className={`slides__btn slides__toggle ${open ? 'is-open' : ''}`}
                  title={open ? '閉じる' : '開く'}
                  aria-label={open ? '閉じる' : '開く'}
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : id)}
                >
                  ▸
                </button>
              </div>

              {open && (
                <div className="slides__edit">
                  {scene.notes && <p className="slides__notes">台本: {scene.notes}</p>}

                  <div className="slides__field">
                    <span>切り替え</span>
                    <select
                      value={ov.transition ?? ''}
                      onChange={(e) => override(id, { transition: pick<Transition>(e.target.value) })}
                    >
                      <option value="">授業のまま</option>
                      {TRANSITIONS.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {ov.transition === undefined && (
                      <small className="slides__actual">いまは {scene.transition ? TRANSITION_NAME[scene.transition] : '—'}</small>
                    )}
                  </div>

                  <div className="slides__field">
                    <span>ワイプ</span>
                    <select
                      value={ov.wipe ?? ''}
                      onChange={(e) => override(id, { wipe: pick<WipeMode>(e.target.value) })}
                    >
                      <option value="">授業のまま</option>
                      {WIPES.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="slides__field">
                    <span>音楽</span>
                    <select value={ov.music ?? ''} onChange={(e) => override(id, { music: pick<string>(e.target.value) })}>
                      <option value="">授業のまま</option>
                      <option value="stop">止める</option>
                      {tracks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                      {ov.music && ov.music !== 'stop' && !tracks.some((t) => t.id === ov.music) && (
                        <option value={ov.music}>（消えた曲）</option>
                      )}
                    </select>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
