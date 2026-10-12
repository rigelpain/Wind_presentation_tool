// 編集画面の「PDF」。スライドを紙（A4 横）に並べ、ブラウザの印刷で「PDFに保存」する。
// 1ページに1枚（台本のメモつきも）、2枚・4枚・6枚の配布用。ワイプは出さない。
import { FileDown, NotebookPen } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconButton, Segmented, Toggle } from '../control/ui';
import { stageHeight } from '../engine/aspect';
import { effectiveLesson } from '../engine/lesson';
import type { Lesson } from '../engine/types';
import { StageCanvas } from '../stage/StageCanvas';
import { previewStateFor, usePreviewSettings } from './SlideEditor';
import './PdfExport.css';

type PerPage = 1 | 2 | 4 | 6;
/** A4 横（mm → px、96dpi） */
const PAGE_W = Math.round((297 / 25.4) * 96);
const PAGE_H = Math.round((210 / 25.4) * 96);

export function PdfExport({ lesson }: { lesson: Lesson }) {
  const [perPage, setPerPage] = useState<PerPage>(1);
  const [notes, setNotes] = useState(true);
  const [title, setTitle] = useState(true);
  const settings = usePreviewSettings();
  const eff = useMemo(() => effectiveLesson(lesson, settings), [lesson, settings]);
  const ratio = `1920 / ${stageHeight(settings.aspect)}`;
  const holder = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0.5);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const fit = () => setK(Math.min(1, (el.clientWidth - 8) / PAGE_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showNotes = notes && perPage <= 2;
  const groups: number[][] = [];
  for (let i = 0; i < eff.scenes.length; i += perPage) groups.push(eff.scenes.slice(i, i + perPage).map((_, j) => i + j));

  const page = (content: ReactNode, key: string) => (
    <div className="pdf-thumb" key={key} style={{ width: PAGE_W * k, height: PAGE_H * k }}>
      <div className="pdf-page" style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${k})` }}>
        {content}
      </div>
    </div>
  );

  return (
    <div className="pdf">
      <aside className="pdf__opts">
        <h3>PDF にする</h3>
        <div className="ed-field">
          <span className="ed-field__label">1ページに</span>
          <Segmented<PerPage>
            options={[
              { value: 1, label: '1枚' },
              { value: 2, label: '2枚' },
              { value: 4, label: '4枚' },
              { value: 6, label: '6枚' },
            ]}
            value={perPage}
            onChange={setPerPage}
          />
        </div>
        <label className="pdf__row">
          <Toggle checked={notes} onChange={setNotes} disabled={perPage > 2} ariaLabel="台本のメモを入れる" />
          <NotebookPen size={15} aria-hidden /> 台本のメモを入れる（1枚・2枚のとき）
        </label>
        <label className="pdf__row">
          <Toggle checked={title} onChange={setTitle} ariaLabel="表紙を付ける" />
          表紙を付ける（授業の名前）
        </label>
        <IconButton icon={FileDown} label="PDFに保存" title="印刷の画面が開くので、送信先を「PDFに保存」にして保存する" variant="primary" onClick={() => window.print()} />
        <p className="hint">
          印刷の画面が開きます。送信先を「PDFに保存」にして保存してください。用紙は A4 横、余白なしで出ます。スライドは最後の段階（→ を全部押した状態）で、ワイプは入りません。
        </p>
        <p className="hint">{eff.scenes.length}枚のスライド ／ {groups.length + (title ? 1 : 0)}ページ</p>
      </aside>

      <div className="pdf__pages" ref={holder}>
        {title &&
          page(
            <div className="pdf-cover">
              <div className="pdf-cover__title">{lesson.title}</div>
              <div className="pdf-cover__meta">
                {eff.scenes.length}枚 ・ {lesson.durationMin}分
              </div>
            </div>,
            'cover',
          )}
        {groups.map((g, gi) =>
          page(
            <div className={`pdf-grid pdf-grid--${perPage} ${showNotes ? 'has-notes' : ''}`}>
              {g.map((i) => (
                <div className="pdf-slide" key={eff.scenes[i].id}>
                  <div className="pdf-slide__box" style={{ aspectRatio: ratio }}>
                    <StageCanvas state={previewStateFor(lesson, settings, i, 99)} lesson={eff} preview="print" />
                  </div>
                  <div className="pdf-slide__cap">
                    <b>{i + 1}</b> {eff.scenes[i].title}
                  </div>
                  {showNotes && eff.scenes[i].notes && <div className="pdf-slide__notes">{eff.scenes[i].notes}</div>}
                </div>
              ))}
            </div>,
            `p${gi}`,
          ),
        )}
      </div>
    </div>
  );
}
