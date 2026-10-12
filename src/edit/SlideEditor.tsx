// 編集画面の「スライド」。1画面ずつ中身を作る。並び・足す・写す・消すは、構成の流れと同じものを動かす。
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { IconButton, Segmented } from '../control/ui';
import { stageHeight } from '../engine/aspect';
import { DEFAULT_SETTINGS, effectiveLesson } from '../engine/lesson';
import { initialState } from '../engine/reducer';
import { stepsOf } from '../engine/registry';
import { useShow } from '../engine/store';
import type { BoardNode, Lesson, Scene, ShowSettings, ShowState, Transition, WipeMode } from '../engine/types';
import { newSceneId } from '../lessons/userLessons';
import { StageCanvas } from '../stage/StageCanvas';
import { newNodeId, NODE_H } from './board';
import { FieldInput } from './Fields';
import { kindOf, SLIDE_KINDS } from './schema';

const WIPES = [
  { value: '', label: '前のまま' },
  { value: 'both', label: '2人' },
  { value: 'explain', label: '右を大きく' },
  { value: 'host', label: '左だけ' },
  { value: 'guest', label: '右だけ' },
  { value: 'hidden', label: '隠す' },
];
const TRANSITIONS = [
  { value: '', label: '既定' },
  { value: 'cut', label: 'カット' },
  { value: 'black', label: '黒を挟む' },
  { value: 'fade', label: '重ねる' },
  { value: 'slide', label: '横すべり' },
];

type SetLesson = (fn: (l: Lesson) => Lesson, opts?: { merge?: boolean }) => void;

/** 編集画面の見た目の設定: 実際の画面の形と名札は使い、並び替えなどの上書きは当てない */
export function usePreviewSettings(): ShowSettings {
  const real = useShow().settings;
  return useMemo(
    () => ({ ...DEFAULT_SETTINGS, aspect: real.aspect, roleLabels: real.roleLabels, labelColors: real.labelColors, labelScale: real.labelScale, wipeScale: real.wipeScale }),
    [real],
  );
}

export function previewStateFor(lesson: Lesson, settings: ShowSettings, index: number, step: number): ShowState {
  const base = initialState(lesson, settings);
  return { ...base, sceneIndex: index, step, stepAt: Date.now() - 600_000, startedAt: null };
}

export function SlideEditor({ lesson, setLesson, readOnly, sel, setSel }: { lesson: Lesson; setLesson: SetLesson; readOnly: boolean; sel: number; setSel: (i: number) => void }) {
  const [step, setStep] = useState(99);
  const [adding, setAdding] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const settings = usePreviewSettings();
  const index = Math.max(0, Math.min(sel, lesson.scenes.length - 1));
  const scene = lesson.scenes[index];
  const kind = scene ? kindOf(scene.kind) : undefined;
  const steps = scene ? stepsOf(scene).length : 1;
  const shownStep = Math.min(step, steps - 1);
  const previewLesson = useMemo(() => effectiveLesson(lesson, settings), [lesson, settings]);
  const previewState = useMemo(() => previewStateFor(lesson, settings, index, shownStep), [lesson, settings, index, shownStep]);

  /** スライドの場所（流れの何番目）と、そのカード */
  const nodeOf = (l: Lesson, sceneId: string): BoardNode | undefined => l.board?.nodes.find((n) => n.sceneId === sceneId && l.board!.flow.includes(n.id));

  const updateScene = (patch: Partial<Scene>, merge = true) => {
    if (readOnly || !scene) return;
    setLesson(
      (l) => ({
        ...l,
        scenes: l.scenes.map((s) => (s.id === scene.id ? { ...s, ...patch } : s)),
        // スライドの名前を変えたら、構成のカードの言葉も合わせる
        board:
          patch.title !== undefined && l.board
            ? { ...l.board, nodes: l.board.nodes.map((n) => (n.sceneId === scene.id ? { ...n, text: patch.title! } : n)) }
            : l.board,
      }),
      { merge },
    );
  };

  /** 新しいスライドを、いまのスライドの次に入れる（構成にもカードを作って流れに入れる） */
  const insertAfter = (s: Scene) => {
    setLesson((l) => {
      const cur = scene ? nodeOf(l, scene.id) : undefined;
      const node: BoardNode = { id: newNodeId(), x: cur?.x ?? 0, y: (cur?.y ?? 0) + NODE_H + 60, text: s.title, kind: 'seed', sceneId: s.id };
      const flow = [...(l.board?.flow ?? [])];
      const at = cur ? flow.indexOf(cur.id) + 1 : flow.length;
      flow.splice(at, 0, node.id);
      return { ...l, scenes: [...l.scenes, s], board: { nodes: [...(l.board?.nodes ?? []), node], edges: l.board?.edges ?? [], flow } };
    });
    setSel(index + 1);
    setStep(99);
  };
  const addKind = (k: string) => {
    const def = kindOf(k);
    if (!def || readOnly) return;
    insertAfter({ id: newSceneId(), ...def.make() });
    setAdding(false);
  };
  const duplicate = () => {
    if (!scene || readOnly) return;
    insertAfter({ ...JSON.parse(JSON.stringify(scene)), id: newSceneId(), title: `${scene.title}（写し）` });
  };
  const remove = () => {
    if (!scene || readOnly || lesson.scenes.length <= 1) return;
    if (!confirm(`「${scene.title}」を消します。`)) return;
    setLesson((l) => {
      const n = nodeOf(l, scene.id);
      if (!n || !l.board) return { ...l, scenes: l.scenes.filter((s) => s.id !== scene.id) };
      return { ...l, board: { nodes: l.board.nodes.filter((x) => x.id !== n.id), edges: l.board.edges.filter((e) => e.from !== n.id && e.to !== n.id), flow: l.board.flow.filter((id) => id !== n.id) } };
    });
    setSel(Math.max(0, index - 1));
  };
  const move = (from: number, to: number) => {
    if (readOnly || to < 0 || to >= lesson.scenes.length || from === to) return;
    setLesson((l) => {
      if (!l.board) return l;
      const flow = [...l.board.flow];
      const [x] = flow.splice(from, 1);
      flow.splice(to, 0, x);
      return { ...l, board: { ...l.board, flow } };
    });
    setSel(to);
  };

  return (
    <div className="ed-main">
      <aside className="ed-list">
        <ol>
          {lesson.scenes.map((s, i) => {
            const k = kindOf(s.kind);
            const Icon = k?.icon;
            return (
              <li
                key={s.id}
                className={i === index ? 'is-on' : ''}
                draggable={!readOnly}
                onDragStart={() => (dragFrom.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom.current !== null) move(dragFrom.current, i);
                  dragFrom.current = null;
                }}
                onClick={() => {
                  setSel(i);
                  setStep(99);
                }}
              >
                {!readOnly && <GripVertical size={14} className="ed-list__grip" aria-hidden />}
                <span className="ed-list__num">{i + 1}</span>
                <span className="ed-list__icon" title={k?.label ?? s.kind}>
                  {Icon ? <Icon size={16} /> : '?'}
                </span>
                <span className="ed-list__text">
                  <b>{s.title}</b>
                  <small>{k?.summary(s.props ?? {}).replace(/\*\*/g, '') ?? s.kind}</small>
                </span>
              </li>
            );
          })}
        </ol>
        {!readOnly && (
          <div className="ed-list__tools">
            <div className="ed-add-wrap">
              <IconButton icon={Plus} label="スライドを足す" title="選んでいるスライドの次に足す（構成にもカードができる）" variant="primary" onClick={() => setAdding((a) => !a)} />
              {adding && (
                <div className="ed-kinds">
                  {SLIDE_KINDS.map((k) => (
                    <button key={k.kind} onClick={() => addKind(k.kind)}>
                      <k.icon size={20} />
                      <span>{k.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="ed-list__row">
              <IconButton icon={ArrowUp} title="上へ" disabled={index === 0} onClick={() => move(index, index - 1)} />
              <IconButton icon={ArrowDown} title="下へ" disabled={index >= lesson.scenes.length - 1} onClick={() => move(index, index + 1)} />
              <IconButton icon={Copy} title="このスライドを写す" onClick={duplicate} />
              <IconButton icon={Trash2} title="このスライドを消す" variant="danger" disabled={lesson.scenes.length <= 1} onClick={remove} />
            </span>
          </div>
        )}
      </aside>

      <section className="ed-preview">
        <div className="ed-preview__box" style={{ aspectRatio: `1920 / ${stageHeight(settings.aspect)}` }}>
          <StageCanvas state={previewState} lesson={previewLesson} preview="edit" />
        </div>
        <div className="ed-steps">
          <IconButton icon={ChevronLeft} title="前の段階" disabled={shownStep === 0} onClick={() => setStep(shownStep - 1)} />
          <span>
            段階 {shownStep + 1} / {steps}
          </span>
          <IconButton icon={ChevronRight} title="次の段階（→ で進んだとき）" disabled={shownStep >= steps - 1} onClick={() => setStep(shownStep + 1)} />
        </div>
        {readOnly && <p className="ed-readonly">これは見本です。直すときは「写して編集」を押してください。</p>}
      </section>

      <aside className={`ed-form ${readOnly ? 'is-readonly' : ''}`}>
        {scene && (
          <fieldset disabled={readOnly}>
            <div className="ed-form__kind">
              {kind && <kind.icon size={18} aria-hidden />}
              {kind?.label ?? scene.kind}
            </div>
            {kind ? (
              kind.fields.map((f) => <FieldInput key={`${scene.id}-${f.key}`} field={f} props={scene.props ?? {}} onChange={(props) => updateScene({ props })} />)
            ) : (
              <p className="hint">この種類のスライドは、ここでは中身を直せません（並べ替え・写す・消すはできます）。</p>
            )}
            <details className="ed-more" open>
              <summary>スライドの設定</summary>
              <label className="ed-field">
                <span className="ed-field__label">名前（構成のカードと同じ）</span>
                <input type="text" value={scene.title} onChange={(e) => updateScene({ title: e.target.value })} />
              </label>
              <label className="ed-field">
                <span className="ed-field__label">台本のメモ</span>
                <textarea rows={3} value={scene.notes ?? ''} onChange={(e) => updateScene({ notes: e.target.value || undefined })} />
              </label>
              <div className="ed-field">
                <span className="ed-field__label">ワイプ</span>
                <Segmented wrap options={WIPES} value={scene.wipe ?? ''} onChange={(v) => updateScene({ wipe: (v || undefined) as WipeMode | undefined }, false)} />
              </div>
              <div className="ed-field">
                <span className="ed-field__label">切り替え</span>
                <Segmented wrap options={TRANSITIONS} value={scene.transition ?? ''} onChange={(v) => updateScene({ transition: (v || undefined) as Transition | undefined }, false)} />
              </div>
              <label className="ed-field">
                <span className="ed-field__label">目安（秒）</span>
                <input type="number" min={0} value={scene.plannedSec ?? ''} onChange={(e) => updateScene({ plannedSec: e.target.value ? Number(e.target.value) : undefined })} />
              </label>
            </details>
          </fieldset>
        )}
      </aside>
    </div>
  );
}
