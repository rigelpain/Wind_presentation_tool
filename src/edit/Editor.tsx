// 編集画面（#/edit）。3つのタブで授業を作る。
//   構成 … 話のタネを置き、枝分かれさせて発散し、流れをつくる（流れの順がスライドの順）
//   スライド … 1画面ずつ中身を作る
//   PDF … スライドを紙に並べて PDF に保存する
// 作った授業はこのPCのブラウザに置く。表示画面・コントロール画面で同じ授業を開いていれば、直したところがすぐ映る。
import { Copy, Download, FilePlus2, FileText, MonitorPlay, Network, Presentation, Redo2, Trash2, Undo2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Tooltips } from '../control/Tooltips';
import { IconButton } from '../control/ui';
import { getStore } from '../engine/store';
import type { Lesson } from '../engine/types';
import { allLessons, builtinLessons } from '../lessons';
import { copyLesson, deleteUserLesson, exportLesson, importLesson, isUserLesson, newLesson, saveUserLesson } from '../lessons/userLessons';
import { normalize } from './board';
import { FlowBoard } from './FlowBoard';
import { PdfExport } from './PdfExport';
import { SlideEditor } from './SlideEditor';
import { useHistory } from './useHistory';
import './Editor.css';

type Tab = 'flow' | 'slides' | 'pdf';
const TABS: { id: Tab; label: string; icon: typeof Network }[] = [
  { id: 'flow', label: '構成', icon: Network },
  { id: 'slides', label: 'スライド', icon: Presentation },
  { id: 'pdf', label: 'PDF', icon: FileText },
];

function lessonUrl(id: string, hash = '') {
  return `${location.pathname}?lesson=${encodeURIComponent(id)}${hash}`;
}

function readTab(): Tab {
  try {
    const t = localStorage.getItem('wind-edit-tab') as Tab | null;
    if (t && TABS.some((x) => x.id === t)) return t;
  } catch {
    /* なくてよい */
  }
  return 'flow';
}

export function Editor() {
  const hist = useHistory<Lesson>(() => normalize(allLessons().find((l) => l.id === getStore().lesson.id) ?? getStore().lesson));
  const draft = hist.value;
  const [tab, setTabState] = useState<Tab>(readTab);
  const [sel, setSel] = useState(0);
  const [list, setList] = useState(() => allLessons());
  const readOnly = !isUserLesson(draft.id);
  const importInput = useRef<HTMLInputElement>(null);

  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      localStorage.setItem('wind-edit-tab', t);
    } catch {
      /* なくてよい */
    }
  };
  /** 授業を変える。いつも「流れ＝スライドの順」にそろえる */
  const setLesson = (fn: (l: Lesson) => Lesson, opts?: { merge?: boolean }) => {
    if (readOnly) return;
    hist.set((cur) => normalize(fn(cur)), opts);
  };

  // 直したら少し待って保存する（表示画面とコントロール画面にも届く）
  useEffect(() => {
    if (readOnly) return;
    const t = window.setTimeout(() => {
      saveUserLesson(draft);
      setList(allLessons());
    }, 250);
    return () => window.clearTimeout(t);
  }, [draft, readOnly]);

  // ⌘Z / ⇧⌘Z（文字を打っている欄の中では、欄の取り消しにまかせる）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      e.preventDefault();
      if (e.shiftKey) hist.redo();
      else hist.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hist]);

  const open = (id: string) => {
    const l = allLessons().find((x) => x.id === id);
    if (!l) return;
    hist.reset(normalize(l));
    setSel(0);
    history.replaceState(null, '', lessonUrl(id, '#/edit'));
  };
  const create = (l: Lesson) => {
    const n = normalize(l);
    saveUserLesson(n);
    setList(allLessons());
    open(n.id);
  };

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
            {list
              .filter((l) => isUserLesson(l.id))
              .map((l) => (
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
          onChange={(e) => setLesson((d) => ({ ...d, title: e.target.value }), { merge: true })}
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
            onChange={(e) => setLesson((d) => ({ ...d, durationMin: Math.max(5, Math.min(180, Number(e.target.value) || 30)) }), { merge: true })}
          />
          分
        </label>

        <nav className="ed-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
              <t.icon size={16} aria-hidden />
              {t.label}
            </button>
          ))}
        </nav>

        <span className="ed-top__spacer" />
        <IconButton icon={Undo2} title="取り消す（⌘Z）" disabled={!hist.canUndo} onClick={hist.undo} />
        <IconButton icon={Redo2} title="やり直す（⇧⌘Z）" disabled={!hist.canRedo} onClick={hist.redo} />
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

      <div className="ed-body">
        {readOnly && tab === 'flow' && <p className="ed-readonly ed-readonly--top">これは見本です。直すときは右上の「写して編集」を押してください。</p>}
        {tab === 'flow' && (
          <FlowBoard
            lesson={draft}
            setLesson={setLesson}
            readOnly={readOnly}
            onOpenSlide={(sceneId) => {
              const i = draft.scenes.findIndex((s) => s.id === sceneId);
              if (i >= 0) setSel(i);
              setTab('slides');
            }}
            undo={hist.undo}
            redo={hist.redo}
            canUndo={hist.canUndo}
            canRedo={hist.canRedo}
          />
        )}
        {tab === 'slides' && <SlideEditor lesson={draft} setLesson={setLesson} readOnly={readOnly} sel={sel} setSel={setSel} />}
        {tab === 'pdf' && <PdfExport lesson={draft} />}
      </div>
      <Tooltips />
    </div>
  );
}
