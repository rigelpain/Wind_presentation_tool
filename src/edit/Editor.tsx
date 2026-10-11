// 編集画面（#/edit）。文字と画像で、簡単な説明のスライドを作る。
// 左: スライドの一覧（足す・写す・消す・並べ替え）。中: 見た目（表示画面と同じ形）。右: 中身の入力欄。
// 作った授業はこのPCのブラウザに置く。表示画面・コントロール画面で同じ授業を開いていれば、直したところがすぐ映る。
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FilePlus2,
  GripVertical,
  MonitorPlay,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconButton, Segmented } from '../control/ui';
import { DEFAULT_SETTINGS, effectiveLesson } from '../engine/lesson';
import { initialState } from '../engine/reducer';
import { stepsOf } from '../engine/registry';
import { getStore, useShow } from '../engine/store';
import type { Lesson, Scene, ShowState, Transition, WipeMode } from '../engine/types';
import { allLessons, builtinLessons } from '../lessons';
import { copyLesson, deleteUserLesson, exportLesson, importLesson, isUserLesson, newLesson, newSceneId, saveUserLesson } from '../lessons/userLessons';
import { StageCanvas } from '../stage/StageCanvas';
import { Tooltips } from '../control/Tooltips';
import { FieldInput } from './Fields';
import { kindOf, SLIDE_KINDS } from './schema';
import './Editor.css';

const WIPES: { value: string; label: string }[] = [
  { value: '', label: '前のまま' },
  { value: 'both', label: '2人' },
  { value: 'explain', label: '右を大きく' },
  { value: 'host', label: '左だけ' },
  { value: 'guest', label: '右だけ' },
  { value: 'hidden', label: '隠す' },
];
const TRANSITIONS: { value: string; label: string }[] = [
  { value: '', label: '既定' },
  { value: 'cut', label: 'カット' },
  { value: 'black', label: '黒を挟む' },
  { value: 'fade', label: '重ねる' },
  { value: 'slide', label: '横すべり' },
];

function lessonUrl(id: string, hash = '') {
  return `${location.pathname}?lesson=${encodeURIComponent(id)}${hash}`;
}

export function Editor() {
  const real = useShow();
  const [lessonId, setLessonId] = useState(() => getStore().lesson.id);
  const [draft, setDraft] = useState<Lesson>(() => allLessons().find((l) => l.id === lessonId) ?? getStore().lesson);
  const [sel, setSel] = useState(0);
  const [step, setStep] = useState(99);
  const [adding, setAdding] = useState(false);
  const [list, setList] = useState(() => allLessons());
  const readOnly = !isUserLesson(draft.id);
  const importInput = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);

  // 直したら少し待って保存する（表示画面とコントロール画面にも届く）
  useEffect(() => {
    if (readOnly) return;
    const t = window.setTimeout(() => {
      saveUserLesson(draft);
      setList(allLessons());
    }, 250);
    return () => window.clearTimeout(t);
  }, [draft, readOnly]);

  const open = (id: string) => {
    const l = allLessons().find((x) => x.id === id);
    if (!l) return;
    setLessonId(id);
    setDraft(l);
    setSel(0);
    setStep(99);
    history.replaceState(null, '', lessonUrl(id, '#/edit'));
  };
  const create = (l: Lesson) => {
    saveUserLesson(l);
    setList(allLessons());
    open(l.id);
  };

  const scene = draft.scenes[Math.min(sel, draft.scenes.length - 1)];
  const kind = scene ? kindOf(scene.kind) : undefined;

  const updateScene = (patch: Partial<Scene>) => {
    if (readOnly || !scene) return;
    setDraft((d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === scene.id ? { ...s, ...patch } : s)) }));
  };
  const setScenes = (scenes: Scene[]) => setDraft((d) => ({ ...d, scenes }));
  const move = (from: number, to: number) => {
    if (readOnly || to < 0 || to >= draft.scenes.length || from === to) return;
    const scenes = [...draft.scenes];
    const [x] = scenes.splice(from, 1);
    scenes.splice(to, 0, x);
    setScenes(scenes);
    setSel(to);
  };
  const addKind = (k: string) => {
    const def = kindOf(k);
    if (!def || readOnly) return;
    const s: Scene = { id: newSceneId(), ...def.make() };
    const at = Math.min(sel + 1, draft.scenes.length);
    setScenes([...draft.scenes.slice(0, at), s, ...draft.scenes.slice(at)]);
    setSel(at);
    setStep(99);
    setAdding(false);
  };
  const duplicate = () => {
    if (!scene || readOnly) return;
    const copy: Scene = { ...JSON.parse(JSON.stringify(scene)), id: newSceneId(), title: `${scene.title}（写し）` };
    setScenes([...draft.scenes.slice(0, sel + 1), copy, ...draft.scenes.slice(sel + 1)]);
    setSel(sel + 1);
  };
  const remove = () => {
    if (!scene || readOnly || draft.scenes.length <= 1) return;
    if (!confirm(`「${scene.title}」を消します。`)) return;
    setScenes(draft.scenes.filter((s) => s.id !== scene.id));
    setSel(Math.max(0, sel - 1));
  };

  // 見た目: 実際の画面の形・名札の名前を使い、並び替えなどの上書きは当てない
  const previewSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, aspect: real.settings.aspect, roleLabels: real.settings.roleLabels, labelColors: real.settings.labelColors, labelScale: real.settings.labelScale, wipeScale: real.settings.wipeScale }),
    [real.settings],
  );
  const previewLesson = useMemo(() => effectiveLesson(draft, previewSettings), [draft, previewSettings]);
  const steps = scene ? stepsOf(scene).length : 1;
  const shownStep = Math.min(step, steps - 1);
  const previewState: ShowState = useMemo(() => {
    const base = initialState(draft, previewSettings);
    return { ...base, sceneIndex: Math.min(sel, draft.scenes.length - 1), step: shownStep, stepAt: Date.now() - 600_000, startedAt: null };
  }, [draft, previewSettings, sel, shownStep]);

  const doExport = async () => {
    const blob = await exportLesson(draft);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${draft.title || 'lesson'}.wind-lesson.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const doImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const l = await importLesson(f);
      setList(allLessons());
      open(l.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="control editor">
      <header className="ed-top">
        <select className="ed-lesson" value={draft.id} onChange={(e) => open(e.target.value)} title="授業を選ぶ">
          <optgroup label="作った授業">
            {list.filter((l) => isUserLesson(l.id)).map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="見本（写して編集）">
            {builtinLessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </optgroup>
        </select>
        <input
          className="ed-title"
          value={draft.title}
          disabled={readOnly}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          title="授業の名前"
          aria-label="授業の名前"
        />
        <label className="ed-min" title="授業の長さ（分）">
          <input
            type="number"
            min={5}
            max={180}
            value={draft.durationMin}
            disabled={readOnly}
            onChange={(e) => setDraft((d) => ({ ...d, durationMin: Math.max(5, Math.min(180, Number(e.target.value) || 30)) }))}
          />
          分
        </label>
        <span className="ed-top__spacer" />
        {readOnly && <IconButton icon={Copy} label="写して編集" title="この見本を写して、編集できる授業にする" variant="primary" onClick={() => create(copyLesson(draft))} />}
        <IconButton icon={FilePlus2} title="新しい授業を作る" onClick={() => create(newLesson())} />
        {!readOnly && <IconButton icon={Copy} title="この授業を写す" onClick={() => create(copyLesson(draft))} />}
        <IconButton icon={Download} title="書き出す（画像込みの1つのファイル。別のPCへ移すとき）" onClick={() => void doExport()} />
        <IconButton icon={Upload} title="書き出したファイルを読み込む" onClick={() => importInput.current?.click()} />
        <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={(e) => void doImport(e.target.files?.[0])} />
        {!readOnly && (
          <IconButton
            icon={Trash2}
            title="この授業を消す"
            variant="danger"
            onClick={() => {
              if (!confirm(`授業「${draft.title}」を消します。もとに戻せません。`)) return;
              deleteUserLesson(draft.id);
              setList(allLessons());
              open(builtinLessons[0].id);
            }}
          />
        )}
        <IconButton icon={MonitorPlay} label="この授業で開く" title="コントロール画面をこの授業で開く" onClick={() => window.open(lessonUrl(draft.id, '#/control'), 'wind-control')} />
      </header>

      <main className="ed-main">
        <aside className="ed-list">
          <ol>
            {draft.scenes.map((s, i) => {
              const k = kindOf(s.kind);
              const Icon = k?.icon;
              return (
                <li
                  key={s.id}
                  className={i === sel ? 'is-on' : ''}
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
                <IconButton icon={Plus} label="スライドを足す" title="選んでいるスライドの次に足す" variant="primary" onClick={() => setAdding((a) => !a)} />
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
                <IconButton icon={ArrowUp} title="上へ" disabled={sel === 0} onClick={() => move(sel, sel - 1)} />
                <IconButton icon={ArrowDown} title="下へ" disabled={sel >= draft.scenes.length - 1} onClick={() => move(sel, sel + 1)} />
                <IconButton icon={Copy} title="このスライドを写す" onClick={duplicate} />
                <IconButton icon={Trash2} title="このスライドを消す" variant="danger" disabled={draft.scenes.length <= 1} onClick={remove} />
              </span>
            </div>
          )}
        </aside>

        <section className="ed-preview">
          <div className="ed-preview__box" style={{ aspectRatio: `1920 / ${real.settings.aspect === '4:3' ? 1440 : real.settings.aspect === '16:10' ? 1200 : 1080}` }}>
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
                  <span className="ed-field__label">名前（自分用）</span>
                  <input type="text" value={scene.title} onChange={(e) => updateScene({ title: e.target.value })} />
                </label>
                <label className="ed-field">
                  <span className="ed-field__label">台本のメモ</span>
                  <textarea rows={3} value={scene.notes ?? ''} onChange={(e) => updateScene({ notes: e.target.value || undefined })} />
                </label>
                <div className="ed-field">
                  <span className="ed-field__label">ワイプ</span>
                  <Segmented
                    wrap
                    options={WIPES.map((w) => ({ value: w.value, label: w.label }))}
                    value={scene.wipe ?? ''}
                    onChange={(v) => updateScene({ wipe: (v || undefined) as WipeMode | undefined })}
                  />
                </div>
                <div className="ed-field">
                  <span className="ed-field__label">切り替え</span>
                  <Segmented
                    wrap
                    options={TRANSITIONS.map((t) => ({ value: t.value, label: t.label }))}
                    value={scene.transition ?? ''}
                    onChange={(v) => updateScene({ transition: (v || undefined) as Transition | undefined })}
                  />
                </div>
                <label className="ed-field">
                  <span className="ed-field__label">目安（秒）</span>
                  <input
                    type="number"
                    min={0}
                    value={scene.plannedSec ?? ''}
                    onChange={(e) => updateScene({ plannedSec: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </label>
              </details>
            </fieldset>
          )}
        </aside>
      </main>
      <Tooltips />
    </div>
  );
}
