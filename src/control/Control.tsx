// コントロール画面（発表者の手元の窓）。表示画面と同じ状態を共有し、どちらで操作しても連動する。
// 上: 時計。左: いま・次の縮小表示、台本のメモ、進む・戻る。右: スライドの順番、カメラとワイプ、音楽、切り替えと時計。
import {
  Captions,
  ChevronLeft,
  ChevronRight,
  Clock,
  EyeOff,
  Gauge,
  History,
  Hourglass,
  ImageOff,
  ImagePlus,
  Keyboard,
  ListOrdered,
  MonitorUp,
  Music,
  NotebookPen,
  Play,
  RotateCcw,
  School,
  ScreenShare,
  SlidersHorizontal,
  Sparkles,
  Square,
  StepForward,
  Timer,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { EFFECTS } from '../engine/effects';
import { useKeys } from '../engine/keys';
import { stepsOf } from '../engine/registry';
import { dispatch, useLesson, useNow, useShow } from '../engine/store';
import { MusicPlayer } from '../media/MusicPlayer';
import { PhotoTray } from '../media/PhotoTray';
import { clearAll } from '../media/photos';
import { KeyHelp } from '../stage/Stage';
import { StageCanvas } from '../stage/StageCanvas';
import { CameraPanel } from './CameraPanel';
import { ClassroomBadge, ClassroomPanel } from './ClassroomPanel';
import { useCaptionEngine } from '../captions/engine';
import { CaptionsPanel } from './CaptionsPanel';
import { MicMeter } from '../captions/MicMeter';
import { MusicPanel } from './MusicPanel';
import { SettingsPanel } from './SettingsPanel';
import { SlidesPanel } from './SlidesPanel';
import { stageHeight } from '../engine/aspect';
import { Tooltips } from './Tooltips';
import { IconButton } from './ui';
import { DisplayIndicator, ZoomGuide } from './ZoomGuide';

export function mmss(ms: number) {
  const neg = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${neg ? '−' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function openDisplay() {
  window.open(`${location.pathname}${location.search}#/`, 'wind-display', 'width=1280,height=720');
}

type Tab = 'slides' | 'camera' | 'classroom' | 'music' | 'captions' | 'settings';
const TABS: [Tab, string, LucideIcon][] = [
  ['slides', 'スライド', ListOrdered],
  ['camera', 'カメラ', Video],
  ['classroom', '教室', School],
  ['music', '音楽', Music],
  ['captions', '字幕', Captions],
  ['settings', '表示', SlidersHorizontal],
];

function readTab(): Tab {
  try {
    const t = localStorage.getItem('wind-control-tab') as Tab | null;
    if (t && TABS.some(([k]) => k === t)) return t;
  } catch {
    /* なくてよい */
  }
  return 'slides';
}

export function Control() {
  const state = useShow();
  const lesson = useLesson();
  const now = useNow(250);
  const [tab, setTabState] = useState<Tab>(readTab);
  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      localStorage.setItem('wind-control-tab', t);
    } catch {
      /* なくてよい */
    }
  };
  const [panel, setPanel] = useState<'none' | 'photos' | 'help' | 'zoom'>('none');
  const local = useMemo(
    () => ({
      u: () => setPanel((p) => (p === 'photos' ? 'none' : 'photos')),
      '?': () => setPanel((p) => (p === 'help' ? 'none' : 'help')),
      Escape: () => setPanel('none'),
    }),
    [],
  );
  useKeys(local);
  // 字幕の聞き取りはこの窓で動かす（タブを切り替えても止めない）
  useCaptionEngine();

  const scene = lesson.scenes[state.sceneIndex];
  const next = lesson.scenes[state.sceneIndex + 1];
  const steps = scene ? stepsOf(scene).length : 1;
  const elapsed = state.startedAt ? now - state.startedAt : 0;
  const remaining = lesson.durationMin * 60_000 - elapsed;
  const hiddenFor = state.wipe.hiddenSince ? now - state.wipe.hiddenSince : null;
  const sceneElapsed = now - state.stepAt;
  const plannedStart = lesson.scenes.slice(0, state.sceneIndex).reduce((a, s) => a + (s.plannedSec ?? 0), 0) * 1000;
  const drift = state.startedAt ? elapsed - plannedStart : 0;

  const clock = (Icon: LucideIcon, label: string, value: string, cls = '') => (
    <div className={`c-clock ${cls}`} title={label}>
      <span className="c-clock__label">
        <Icon size={13} aria-hidden />
        {label}
      </span>
      <span className="c-clock__value">{value}</span>
    </div>
  );

  return (
    <div className="control">
      <header className="c-top">
        {clock(Clock, '時刻', new Date(now).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }), 'c-clock--time')}
        {clock(Timer, '経過', state.startedAt ? mmss(elapsed) : '—')}
        {clock(Hourglass, `残り/${lesson.durationMin}分`, state.startedAt ? mmss(remaining) : `${lesson.durationMin}:00`, state.startedAt && remaining < 3 * 60_000 ? 'is-warn' : '')}
        {clock(Gauge, '目安との差', state.startedAt ? (drift >= 0 ? '+' : '') + mmss(drift) : '—', drift > 60_000 ? 'is-warn' : '')}
        {clock(StepForward, 'この段階', mmss(Math.max(0, sceneElapsed)))}
        {hiddenFor !== null && clock(EyeOff, 'カメラを隠して', `${Math.floor(hiddenFor / 1000)}秒`, 'is-hidden')}
        <div className="c-top__actions">
          {!state.startedAt && <IconButton icon={Play} label="授業を始める" title="授業を始める（経過時間と記録を始める）" variant="primary" onClick={() => dispatch({ type: 'start' })} />}
          {state.blackout && (
            <span className="badge badge--black" title="黒画面中（B で戻す）">
              <Square size={13} fill="currentColor" /> 黒
            </span>
          )}
          {state.music.playing && (
            <span className="badge" title="音楽を再生中">
              <Music size={13} /> 再生中
            </span>
          )}
          {state.settings.captions.enabled && (
            <span className="badge badge--captions" title="字幕を出している">
              <Captions size={14} /> <MicMeter compact />
            </span>
          )}
          <ClassroomBadge />
          <DisplayIndicator onHelp={() => setPanel('zoom')} />
          <IconButton icon={ScreenShare} title="Zoom で共有する手順" label="Zoom" onClick={() => setPanel('zoom')} />
          <IconButton icon={MonitorUp} title="表示画面を開く" onClick={openDisplay} />
        </div>
      </header>

      <main className="c-main">
        <section className="c-left">
          <div className="c-previews">
            <figure className="c-preview c-preview--now">
              <figcaption>
                <span className="c-pill">いま</span>
                {state.sceneIndex + 1}/{lesson.scenes.length}
                {steps > 1 && <span className="c-step">段階 {Math.min(state.step, steps - 1) + 1}/{steps}</span>}
                <b>{scene?.title}</b>
              </figcaption>
              <div className="c-preview__box" style={{ aspectRatio: `1920 / ${stageHeight(state.settings.aspect)}` }}>
                <StageCanvas state={state} lesson={lesson} preview="now" />
              </div>
            </figure>
            <figure className="c-preview c-preview--next">
              <figcaption>
                <span className="c-pill c-pill--next">次</span>
                {state.step < steps - 1 ? `段階 ${state.step + 2}` : next ? next.title : 'おわり'}
              </figcaption>
              <div className="c-preview__box" style={{ aspectRatio: `1920 / ${stageHeight(state.settings.aspect)}` }}>
                {state.step < steps - 1 ? (
                  <div className="c-preview__same">
                    <StepForward size={22} />
                  </div>
                ) : (
                  <StageCanvas state={state} lesson={lesson} preview="next" />
                )}
              </div>
            </figure>
          </div>
          {scene?.notes && (
            <div className="c-notes">
              <NotebookPen size={16} className="c-notes__icon" aria-hidden />
              {scene.notes}
            </div>
          )}
          <div className="c-nav">
            <IconButton icon={ChevronLeft} title="戻る（←）" onClick={() => dispatch({ type: 'prev' })} size={22} />
            <button className="primary c-nav__next" title="進む（→ / Space）" onClick={() => dispatch({ type: 'next' })}>
              進む <ChevronRight size={22} />
            </button>
            <IconButton icon={RotateCcw} title="もう一度（R）" onClick={() => dispatch({ type: 'replay' })} size={20} />
            <IconButton icon={Square} title="画面を黒に（B）" active={state.blackout} onClick={() => dispatch({ type: 'blackout' })} size={20} />
          </div>
          <details className="c-log">
            <summary>
              <Sparkles size={13} /> 演出の記録 {state.effects.length}
            </summary>
            <ul>
              {state.effects
                .slice(-12)
                .reverse()
                .map((e, i) => (
                  <li key={i}>
                    {mmss(e.at - (state.startedAt ?? e.at))} {EFFECTS[e.kind].label}
                  </li>
                ))}
            </ul>
          </details>
        </section>

        <section className="c-right">
          <nav className="c-tabs" role="tablist">
            {TABS.map(([k, label, Icon]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
                <Icon size={18} aria-hidden />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="c-tabbody">
            {tab === 'slides' && <SlidesPanel />}
            {tab === 'camera' && <CameraPanel />}
            {tab === 'classroom' && <ClassroomPanel />}
            {tab === 'music' && <MusicPanel />}
            {tab === 'captions' && <CaptionsPanel />}
            {tab === 'settings' && <SettingsPanel />}
          </div>
          <div className="c-tools">
            <IconButton icon={ImagePlus} label="写真" title="写真の読み込み（U）" onClick={() => setPanel('photos')} />
            <IconButton icon={Keyboard} title="操作の一覧（?）" onClick={() => setPanel('help')} />
            <span className="c-tools__spacer" />
            <IconButton icon={ImageOff} title="読み込んだ写真を全部消す（授業のあと）" onClick={() => confirm('読み込んだ写真を全部消します。授業が終わったあとに使います。') && void clearAll()} />
            <IconButton
              icon={History}
              label="最初から"
              title="最初の場面に戻し、経過時間と演出の記録を消す（並びや設定は残る）"
              variant="danger"
              onClick={() => {
                if (confirm('最初の場面に戻し、経過時間と演出の記録を消します（並びや設定は残ります）。')) dispatch({ type: 'reset' });
              }}
            />
          </div>
        </section>
      </main>
      <MusicPlayer role="control" />
      <Tooltips />
      {panel === 'photos' && <PhotoTray onClose={() => setPanel('none')} />}
      {panel === 'help' && <KeyHelp onClose={() => setPanel('none')} />}
      {panel === 'zoom' && <ZoomGuide onClose={() => setPanel('none')} />}
    </div>
  );
}
