// コントロール画面（発表者の手元の窓）。表示画面と同じ状態を共有し、どちらで操作しても連動する。
// 上: 時計。左: いま・次の縮小表示、台本のメモ、進む・戻る。右: スライドの順番、カメラとワイプ、音楽、切り替えと時計。
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
import { useCaptionEngine } from '../captions/engine';
import { CaptionsPanel } from './CaptionsPanel';
import { MicMeter } from '../captions/MicMeter';
import { MusicPanel } from './MusicPanel';
import { SettingsPanel } from './SettingsPanel';
import { SlidesPanel } from './SlidesPanel';
import { DisplayIndicator, ZoomGuide } from './ZoomGuide';

export function mmss(ms: number) {
  const neg = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${neg ? '−' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function openDisplay() {
  window.open(`${location.pathname}${location.search}#/`, 'wind-display', 'width=1280,height=720');
}

type Tab = 'slides' | 'camera' | 'music' | 'captions' | 'settings';
const TABS: [Tab, string][] = [
  ['slides', 'スライド'],
  ['camera', 'カメラ・ワイプ'],
  ['music', '音楽'],
  ['captions', '字幕'],
  ['settings', '切り替え・時計'],
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

  return (
    <div className="control">
      <header className="c-top">
        <div className="c-clock c-clock--time">
          <span className="c-clock__label">いまの時刻</span>
          <span className="c-clock__value">{new Date(now).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        <div className="c-clock">
          <span className="c-clock__label">経過</span>
          <span className="c-clock__value">{state.startedAt ? mmss(elapsed) : '—'}</span>
        </div>
        <div className={`c-clock ${state.startedAt && remaining < 3 * 60_000 ? 'is-warn' : ''}`}>
          <span className="c-clock__label">残り（{lesson.durationMin}分）</span>
          <span className="c-clock__value">{state.startedAt ? mmss(remaining) : `${lesson.durationMin}:00`}</span>
        </div>
        <div className={`c-clock ${drift > 60_000 ? 'is-warn' : ''}`}>
          <span className="c-clock__label">目安との差</span>
          <span className="c-clock__value">{state.startedAt ? (drift >= 0 ? '+' : '') + mmss(drift) : '—'}</span>
        </div>
        <div className="c-clock">
          <span className="c-clock__label">この段階</span>
          <span className="c-clock__value">{mmss(Math.max(0, sceneElapsed))}</span>
        </div>
        {hiddenFor !== null && (
          <div className="c-clock is-hidden">
            <span className="c-clock__label">カメラを隠して</span>
            <span className="c-clock__value">{Math.floor(hiddenFor / 1000)}秒</span>
          </div>
        )}
        <div className="c-top__actions">
          {!state.startedAt && (
            <button className="primary" onClick={() => dispatch({ type: 'start' })}>
              授業を始める
            </button>
          )}
          {state.blackout && <span className="badge badge--black">黒画面中</span>}
          {state.music.playing && <span className="badge">♪ 再生中</span>}
          {state.settings.captions.enabled && (
            <span className="badge badge--captions">
              字幕 ON <MicMeter compact />
            </span>
          )}
          <DisplayIndicator onHelp={() => setPanel('zoom')} />
          <button onClick={() => setPanel('zoom')}>Zoom で共有</button>
          <button onClick={openDisplay}>表示画面を開く</button>
        </div>
      </header>

      <main className="c-main">
        <section className="c-left">
          <div className="c-previews">
            <figure className="c-preview c-preview--now">
              <figcaption>
                いま {state.sceneIndex + 1}/{lesson.scenes.length}
                {steps > 1 && ` ・段階 ${Math.min(state.step, steps - 1) + 1}/${steps}`}　{scene?.title}
              </figcaption>
              <div className="c-preview__box">
                <StageCanvas state={state} lesson={lesson} preview="now" />
              </div>
            </figure>
            <figure className="c-preview c-preview--next">
              <figcaption>
                次　{state.step < steps - 1 ? `（同じ場面の段階 ${state.step + 2}）` : next ? next.title : 'おわり'}
              </figcaption>
              <div className="c-preview__box">
                {state.step < steps - 1 ? (
                  <div className="c-preview__same">→ で同じ場面の次の段階</div>
                ) : (
                  <StageCanvas state={state} lesson={lesson} preview="next" />
                )}
              </div>
            </figure>
          </div>
          <div className="c-notes">{scene?.notes ?? ''}</div>
          <div className="c-nav">
            <button onClick={() => dispatch({ type: 'prev' })}>← 戻る</button>
            <button className="primary c-nav__next" onClick={() => dispatch({ type: 'next' })}>
              進む →
            </button>
            <button onClick={() => dispatch({ type: 'replay' })}>もう一度（R）</button>
            <button className={state.blackout ? 'is-on' : ''} onClick={() => dispatch({ type: 'blackout' })}>
              黒（B）
            </button>
          </div>
          <details className="c-log">
            <summary>演出の記録 {state.effects.length}回</summary>
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
          <nav className="c-tabs">
            {TABS.map(([k, label]) => (
              <button key={k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </nav>
          <div className="c-tabbody">
            {tab === 'slides' && <SlidesPanel />}
            {tab === 'camera' && <CameraPanel />}
            {tab === 'music' && <MusicPanel />}
            {tab === 'captions' && <CaptionsPanel />}
            {tab === 'settings' && <SettingsPanel />}
          </div>
          <div className="c-tools">
            <button onClick={() => setPanel('photos')}>写真の読み込み（U）</button>
            <button onClick={() => setPanel('help')}>操作の一覧（?）</button>
            <button onClick={() => confirm('読み込んだ写真を全部消します。授業が終わったあとに使います。') && void clearAll()}>写真を全部消す</button>
            <button
              className="danger"
              onClick={() => {
                if (confirm('最初の場面に戻し、経過時間と演出の記録を消します（並びや設定は残ります）。')) dispatch({ type: 'reset' });
              }}
            >
              最初から（記録を消す）
            </button>
          </div>
        </section>
      </main>
      <MusicPlayer role="control" />
      {panel === 'photos' && <PhotoTray onClose={() => setPanel('none')} />}
      {panel === 'help' && <KeyHelp onClose={() => setPanel('none')} />}
      {panel === 'zoom' && <ZoomGuide onClose={() => setPanel('none')} />}
    </div>
  );
}
