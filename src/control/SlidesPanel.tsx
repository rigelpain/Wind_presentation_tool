// コントロール画面の「スライド」の枠。場面の並び・飛ばし・場面ごとの上書き（切り替え・ワイプ・音楽）を変える。
// 授業のデータ（src/lessons）は書き換えない。変えた中身は状態の settings に持つ。
import {
  ArrowDown,
  ArrowUp,
  Blend,
  ChevronDown,
  EyeOff,
  GripVertical,
  Layers,
  ListOrdered,
  Maximize2,
  MoveRight,
  Music,
  NotebookPen,
  PanelLeft,
  PanelRight,
  PictureInPicture2,
  RotateCcw,
  Scissors,
  Square,
  Undo2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { orderedScenes, type OrderedScene } from '../engine/lesson';
import { dispatch, getStore, useShow } from '../engine/store';
import type { SceneOverride, Transition, WipeMode } from '../engine/types';
import { useTracks } from '../media/audio';
import { IconButton, Row, Section, Segmented, type SegOption } from './ui';
import './SlidesPanel.css';

const TRANSITIONS: [Transition, string, LucideIcon][] = [
  ['cut', 'カット', Scissors],
  ['black', '黒を挟む', Square],
  ['fade', '重ねる', Blend],
  ['slide', '横すべり', MoveRight],
];
const TRANSITION_NAME = Object.fromEntries(TRANSITIONS.map(([v, label]) => [v, label])) as Record<Transition, string>;
const TRANSITION_OPTIONS: SegOption<Transition | ''>[] = [
  { value: '', icon: Undo2, title: '授業のまま（授業のデータどおり）' },
  ...TRANSITIONS.map(([v, label, icon]) => ({ value: v, icon, title: label })),
];

const WIPES: [WipeMode, string, LucideIcon][] = [
  ['both', '2人', Users],
  ['explain', '解説を大きく', Maximize2],
  ['host', '進行だけ', PanelLeft],
  ['guest', '解説だけ', PanelRight],
  ['hidden', 'カメラを隠す', EyeOff],
];
const WIPE_OPTIONS: SegOption<WipeMode | ''>[] = [
  { value: '', icon: Undo2, title: '授業のまま（授業のデータどおり）' },
  ...WIPES.map(([v, label, icon]) => ({ value: v, icon, title: label })),
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
      <Section
        icon={ListOrdered}
        title="並び"
        help={<p>ドラッグか ↑↓ で並べ替え。目のアイコンで飛ばす。変えた並びは授業のデータには書き戻さず、このPCに残ります。</p>}
        aside={<IconButton icon={RotateCcw} label="元に戻す" title="並び・飛ばし・場面ごとの上書きを、授業のデータどおりに戻す" onClick={resetAll} />}
      >
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
                  <span className="slides__grip" title="ドラッグで並べ替え">
                    <GripVertical size={15} aria-hidden />
                  </span>
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
                  <IconButton
                    icon={EyeOff}
                    title={o.skipped ? '飛ばしている（押すと戻す）' : '飛ばす'}
                    active={o.skipped}
                    onClick={() => toggleSkip(id, !o.skipped)}
                  />
                  <div className="slides__move">
                    <IconButton icon={ArrowUp} title="上へ" disabled={pos === 0} onClick={() => moveTo(id, ids[pos - 1])} />
                    <IconButton
                      icon={ArrowDown}
                      title="下へ"
                      disabled={pos === ids.length - 1}
                      onClick={() => moveTo(id, ids[pos + 1])}
                    />
                  </div>
                  <IconButton icon={ChevronDown} title={open ? '閉じる' : '開く'} active={open} onClick={() => setOpenId(open ? null : id)} />
                </div>

                {open && (
                  <div className="slides__edit">
                    {scene.notes && (
                      <div className="slides__notes">
                        <NotebookPen size={14} aria-hidden />
                        <span>{scene.notes}</span>
                      </div>
                    )}

                    <Row icon={Layers} label="切り替え">
                      <Segmented
                        options={TRANSITION_OPTIONS}
                        value={ov.transition ?? ''}
                        onChange={(v) => override(id, { transition: pick<Transition>(v) })}
                      />
                      {ov.transition === undefined && (
                        <small className="slides__actual">いまは {scene.transition ? TRANSITION_NAME[scene.transition] : '—'}</small>
                      )}
                    </Row>

                    <Row icon={PictureInPicture2} label="ワイプ">
                      <Segmented options={WIPE_OPTIONS} value={ov.wipe ?? ''} onChange={(v) => override(id, { wipe: pick<WipeMode>(v) })} />
                    </Row>

                    <Row icon={Music} label="音楽">
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
                    </Row>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
