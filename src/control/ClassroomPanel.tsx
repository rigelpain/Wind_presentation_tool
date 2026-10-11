// コントロール画面の「教室」の枠。Zoom の窓（やブラウザのタブ）を取り込み、教室の盛り上がりを見える形にする。
import { Activity, AudioLines, Crop as CropIcon, Flame, MonitorPlay, PersonStanding, Square } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { classroom, CLASSROOM_HISTORY_MS, useClassroom, type Crop } from '../classroom/monitor';
import { IconButton, Row, Section, Slider, Status } from './ui';
import './ClassroomPanel.css';

const CROP_KEY = 'wind-classroom-crop';
const GAIN_KEY = 'wind-classroom-gain';

// 前に選んだ枠と感度を戻す（このPCにだけ置く）
try {
  const c = JSON.parse(localStorage.getItem(CROP_KEY) ?? 'null') as Crop | null;
  if (c && c.w > 0.02 && c.h > 0.02) classroom.crop = c;
  const g = Number(localStorage.getItem(GAIN_KEY));
  if (g > 0) classroom.gain = g;
} catch {
  /* なくてよい */
}

function saveCrop(c: Crop) {
  classroom.crop = c;
  try {
    localStorage.setItem(CROP_KEY, JSON.stringify(c));
  } catch {
    /* なくてよい */
  }
}

/** 盛り上がりの言葉 */
export function heatWord(score: number): string {
  if (score < 0.12) return '静か';
  if (score < 0.3) return 'ざわざわ';
  if (score < 0.55) return '盛り上がっている';
  return 'とても盛り上がっている';
}

/** 上の帯に出す小さな盛り上がりの印 */
export function ClassroomBadge() {
  const st = useClassroom();
  if (st.status !== 'running') return null;
  const pct = Math.round((st.latest?.score ?? 0) * 100);
  return (
    <span className="badge classroom-badge" title={`教室: ${heatWord(st.latest?.score ?? 0)}（${pct}）`}>
      <Flame size={14} aria-hidden />
      <span className="classroom-badge__bar">
        <span style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

function LiveView() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Crop | null>(null);
  const draftRef = useRef<Crop | null>(null);
  draftRef.current = draft;

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current;
      const v = classroom.video;
      if (!c || v.readyState < 2 || !v.videoWidth) return;
      const w = 640;
      const h = Math.round((w * v.videoHeight) / v.videoWidth);
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(v, 0, 0, w, h);
      const r = draftRef.current ?? classroom.crop;
      const full = r.x <= 0 && r.y <= 0 && r.w >= 1 && r.h >= 1;
      if (!full) {
        // 枠の外を暗くする
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, w, r.y * h);
        ctx.fillRect(0, (r.y + r.h) * h, w, h - (r.y + r.h) * h);
        ctx.fillRect(0, r.y * h, r.x * w, r.h * h);
        ctx.fillRect((r.x + r.w) * w, r.y * h, w - (r.x + r.w) * w, r.h * h);
      }
      ctx.strokeStyle = '#e8452c';
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x * w + 1.5, r.y * h + 1.5, r.w * w - 3, r.h * h - 3);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pos = (e: RPointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  };
  const onDown = (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = pos(e);
  };
  const onMove = (e: RPointerEvent) => {
    const s = drag.current;
    if (!s) return;
    const p = pos(e);
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onUp = () => {
    drag.current = null;
    const d = draftRef.current;
    setDraft(null);
    // 小さすぎる枠（ただのクリック）は無視する
    if (d && d.w > 0.03 && d.h > 0.03) saveCrop(d);
  };

  return (
    <div className="classroom__view">
      <canvas ref={canvas} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} title="ドラッグで、見たい所（教室の人の映っている所）を囲む" />
    </div>
  );
}

function Graph() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current;
      if (!c) return;
      const w = c.clientWidth * devicePixelRatio;
      const h = c.clientHeight * devicePixelRatio;
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, w, h);
      // 目安の線（ざわざわ・盛り上がり）
      ctx.strokeStyle = 'rgba(241,237,228,0.12)';
      ctx.lineWidth = 1;
      for (const t of [0.3, 0.55]) {
        ctx.beginPath();
        ctx.moveTo(0, h - t * h);
        ctx.lineTo(w, h - t * h);
        ctx.stroke();
      }
      const hist = classroom.history;
      if (hist.length < 2) return;
      const end = Date.now();
      const x = (at: number) => w - ((end - at) / CLASSROOM_HISTORY_MS) * w;
      const line = (key: 'audio' | 'motion', color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width * devicePixelRatio;
        ctx.beginPath();
        hist.forEach((s, i) => (i ? ctx.lineTo(x(s.at), h - s[key] * h) : ctx.moveTo(x(s.at), h - s[key] * h)));
        ctx.stroke();
      };
      line('audio', 'rgba(125,211,252,0.55)', 1);
      line('motion', 'rgba(190,242,100,0.55)', 1);
      // 盛り上がり（塗り）
      ctx.beginPath();
      ctx.moveTo(x(hist[0].at), h);
      hist.forEach((s) => ctx.lineTo(x(s.at), h - s.score * h));
      ctx.lineTo(x(hist[hist.length - 1].at), h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(232,69,44,0.35)';
      ctx.fill();
      ctx.strokeStyle = '#e8452c';
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.beginPath();
      hist.forEach((s, i) => (i ? ctx.lineTo(x(s.at), h - s.score * h) : ctx.moveTo(x(s.at), h - s.score * h)));
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} className="classroom__graph" aria-label="この2分の盛り上がり" />;
}

export function ClassroomPanel() {
  const st = useClassroom();
  const [gain, setGainState] = useState(classroom.gain);
  const setGain = (g: number) => {
    classroom.gain = g;
    setGainState(g);
    try {
      localStorage.setItem(GAIN_KEY, String(g));
    } catch {
      /* なくてよい */
    }
  };
  const running = st.status === 'running';
  const s = st.latest;
  const pct = (v: number | undefined) => `${Math.round((v ?? 0) * 100)}`;

  return (
    <div className="c-panel classroom">
      <Section
        icon={MonitorPlay}
        title="取り込み"
        aside={
          running ? (
            <IconButton icon={Square} label="止める" title="取り込みを止める" onClick={() => classroom.stop()} />
          ) : (
            <IconButton icon={MonitorPlay} label="取り込む" title="Zoom の窓やブラウザのタブを選んで取り込む" variant="primary" onClick={() => void classroom.start()} />
          )
        }
        help={
          <>
            <p>「取り込む」を押し、Zoom の窓（または試しに YouTube などのブラウザのタブ）を選びます。Zoom では教室の参加者を「ピン留め」しておくと、その人が大きく映ります。</p>
            <p>音を測るには、ブラウザの「タブ」を選んで「タブの音声も共有」をオンにします。Zoom の窓を選んだときは、Chrome と macOS によっては音が取れません（そのときは動きだけで測ります）。</p>
            <p>取り込んだ映像と音は、このPCの中で測るだけで、保存も送信もしません。</p>
          </>
        }
      >
        {st.status === 'idle' && !st.error && <Status tone="idle">取り込んでいません</Status>}
        {st.status === 'starting' && <Status tone="warn">取り込むものを選んでください</Status>}
        {st.status === 'error' && <Status tone="bad">{st.error}</Status>}
        {running && (
          <>
            <Status tone={st.hasAudio ? 'ok' : 'warn'}>{st.hasAudio ? '音と動きを測っています' : '音は取れていません（動きだけで測っています）'}</Status>
            <LiveView />
            <Row icon={CropIcon} label="見る所">
              <span className="hint">映像をドラッグして囲む</span>
              <IconButton icon={CropIcon} label="全体" title="枠を全体に戻す" onClick={() => saveCrop({ x: 0, y: 0, w: 1, h: 1 })} />
            </Row>
          </>
        )}
      </Section>

      <Section
        icon={Flame}
        title="盛り上がり"
        help={
          <>
            <p>音の大きさ（笑い声や話し声）と、枠の中の動きの量（手が挙がる、体が動く）をまとめた目安です。音が取れているときは音を6、動きを4の割合で見ます。</p>
            <p>グラフはこの2分。赤が盛り上がり、水色が音、黄緑が動き。横の薄い線は「ざわざわ」「盛り上がっている」の目安です。教室の静かなときに下の方、盛り上がったときに上の方に来るよう、感度で合わせます。</p>
          </>
        }
      >
        <div className={`classroom__meter ${running ? '' : 'is-off'}`}>
          <div className="classroom__score">
            <span className="classroom__num">{running ? pct(s?.score) : '—'}</span>
            <span className="classroom__word">{running ? heatWord(s?.score ?? 0) : '取り込むと測ります'}</span>
          </div>
          <div className="classroom__bar">
            <span style={{ width: `${running ? pct(s?.score) : 0}%` }} />
          </div>
        </div>
        <Graph />
        <div className="classroom__parts">
          <span title="音の大きさ">
            <AudioLines size={14} aria-hidden /> 音 {running && st.hasAudio ? pct(s?.audio) : '—'}
          </span>
          <span title="枠の中の動きの量">
            <PersonStanding size={14} aria-hidden /> 動き {running ? pct(s?.motion) : '—'}
          </span>
        </div>
        <Row icon={Activity} label="感度">
          <Slider label="感度" min={0.5} max={3} step={0.1} value={gain} onChange={setGain} format={(v) => `×${v.toFixed(1)}`} reset={1} />
        </Row>
      </Section>
    </div>
  );
}
