// コントロール画面の「教室」の枠。Zoom の窓（やブラウザのタブ）を取り込み、教室の様子を見ながら音量を出す。
import { Activity, MonitorPlay, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { classroom, CLASSROOM_HISTORY_MS, useClassroom } from '../classroom/monitor';
import { IconButton, Row, Section, Slider, Status } from './ui';
import './ClassroomPanel.css';

const GAIN_KEY = 'wind-classroom-gain';

// 前に決めた感度を戻す（このPCにだけ置く）
try {
  const g = Number(localStorage.getItem(GAIN_KEY));
  if (g > 0) classroom.gain = g;
} catch {
  /* なくてよい */
}

/** 上の帯に出す小さな音量の印（取り込んでいるあいだだけ） */
export function ClassroomBadge() {
  const st = useClassroom();
  if (st.status !== 'running' || !st.hasAudio) return null;
  const pct = Math.round((st.latest?.level ?? 0) * 100);
  return (
    <span className="badge classroom-badge" title="教室の音量">
      <Volume2 size={14} aria-hidden />
      <span className="classroom-badge__bar">
        <span style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

function LiveView() {
  const canvas = useRef<HTMLCanvasElement>(null);
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
      c.getContext('2d')!.drawImage(v, 0, 0, w, h);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="classroom__view">
      <canvas ref={canvas} />
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
      const hist = classroom.history;
      if (hist.length < 2) return;
      const end = Date.now();
      const x = (at: number) => w - ((end - at) / CLASSROOM_HISTORY_MS) * w;
      ctx.beginPath();
      ctx.moveTo(x(hist[0].at), h);
      hist.forEach((s) => ctx.lineTo(x(s.at), h - s.level * h));
      ctx.lineTo(x(hist[hist.length - 1].at), h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(232,69,44,0.35)';
      ctx.fill();
      ctx.strokeStyle = '#e8452c';
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.beginPath();
      hist.forEach((s, i) => (i ? ctx.lineTo(x(s.at), h - s.level * h) : ctx.moveTo(x(s.at), h - s.level * h)));
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} className="classroom__graph" aria-label="この2分の音量" />;
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
  const measuring = running && st.hasAudio;
  const pct = Math.round((st.latest?.level ?? 0) * 100);

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
            <p>音を測るには、ブラウザの「タブ」を選んで「タブの音声も共有」をオンにします。Zoom の窓を選んだときは、Chrome と macOS によっては音が取れず、映像だけになります。</p>
            <p>取り込んだ映像と音は、このPCの中で測るだけで、保存も送信もしません。</p>
          </>
        }
      >
        {st.status === 'idle' && !st.error && <Status tone="idle">取り込んでいません</Status>}
        {st.status === 'starting' && <Status tone="warn">取り込むものを選んでください</Status>}
        {st.status === 'error' && <Status tone="bad">{st.error}</Status>}
        {running && !st.hasAudio && <Status tone="warn">音は取れていません（映像だけ）</Status>}
        {running && <LiveView />}
      </Section>

      <Section
        icon={Volume2}
        title="音量"
        help={<p>教室から届く音の大きさです。グラフはこの2分。静かなときに下の方、声が上がったときに上の方に来るよう、感度で合わせます。</p>}
      >
        <div className={`classroom__meter ${measuring ? '' : 'is-off'}`}>
          <div className="classroom__bar classroom__bar--big">
            <span style={{ width: `${measuring ? pct : 0}%` }} />
          </div>
        </div>
        <Graph />
        <Row icon={Activity} label="感度">
          <Slider label="感度" min={0.5} max={3} step={0.1} value={gain} onChange={setGain} format={(v) => `×${v.toFixed(1)}`} reset={1} />
        </Row>
      </Section>
    </div>
  );
}
