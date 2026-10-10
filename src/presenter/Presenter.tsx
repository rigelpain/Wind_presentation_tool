// 発表者用の画面（P で開く別の窓）。次の場面、台本のメモ、経過時間、残り時間、ワイプの操作。
// 舞台の窓とは BroadcastChannel で同期するので、どちらの窓で操作してもよい。
import { useMemo, useState } from 'react';
import { EFFECTS } from '../engine/effects';
import { useKeys } from '../engine/keys';
import { stepsOf } from '../engine/registry';
import { dispatch, useNow, useShow } from '../engine/store';
import type { Lesson, WipeMode } from '../engine/types';
import { clearAll } from '../media/photos';
import { PhotoTray } from '../media/PhotoTray';
import { KeyHelp } from '../stage/Stage';

function mmss(ms: number) {
  const neg = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${neg ? '−' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const WIPE_BUTTONS: [WipeMode, string][] = [
  ['both', '2人'],
  ['explain', '解説を大きく'],
  ['host', '進行だけ'],
  ['guest', '解説だけ'],
  ['hidden', 'カメラを隠す'],
];

export function Presenter({ lesson }: { lesson: Lesson }) {
  const state = useShow();
  const now = useNow(250);
  const [panel, setPanel] = useState<'none' | 'photos' | 'help'>('none');
  const local = useMemo(
    () => ({
      u: () => setPanel((p) => (p === 'photos' ? 'none' : 'photos')),
      '?': () => setPanel((p) => (p === 'help' ? 'none' : 'help')),
      Escape: () => setPanel('none'),
    }),
    [],
  );
  useKeys(local);

  const scene = lesson.scenes[state.sceneIndex];
  const next = lesson.scenes[state.sceneIndex + 1];
  const steps = scene ? stepsOf(scene).length : 1;
  const elapsed = state.startedAt ? now - state.startedAt : 0;
  const remaining = lesson.durationMin * 60_000 - elapsed;
  const hiddenFor = state.wipe.hiddenSince ? now - state.wipe.hiddenSince : null;
  const sceneElapsed = now - state.stepAt;
  // 目安の時刻（その場面に入るべき時刻）
  const plannedStart = lesson.scenes.slice(0, state.sceneIndex).reduce((a, s) => a + (s.plannedSec ?? 0), 0) * 1000;
  const drift = state.startedAt ? elapsed - plannedStart : 0;

  return (
    <div className="presenter">
      <header className="p-top">
        <div className="p-clock">
          <span className="p-clock__label">経過</span>
          <span className="p-clock__value">{state.startedAt ? mmss(elapsed) : '—'}</span>
        </div>
        <div className={`p-clock ${remaining < 3 * 60_000 ? 'is-warn' : ''}`}>
          <span className="p-clock__label">残り</span>
          <span className="p-clock__value">{state.startedAt ? mmss(remaining) : `${lesson.durationMin}:00`}</span>
        </div>
        <div className={`p-clock ${drift > 60_000 ? 'is-warn' : ''}`}>
          <span className="p-clock__label">目安との差</span>
          <span className="p-clock__value">{state.startedAt ? (drift >= 0 ? '+' : '') + mmss(drift) : '—'}</span>
        </div>
        {hiddenFor !== null && (
          <div className="p-clock is-hidden">
            <span className="p-clock__label">カメラを隠して</span>
            <span className="p-clock__value">{Math.floor(hiddenFor / 1000)}秒</span>
          </div>
        )}
        <div className="p-top__actions">
          {!state.startedAt && (
            <button className="primary" onClick={() => dispatch({ type: 'start' })}>
              授業を始める
            </button>
          )}
          {state.blackout && <span className="badge badge--black">黒画面中（B）</span>}
        </div>
      </header>

      <main className="p-main">
        <section className="p-now">
          <div className="p-label">
            いま {state.sceneIndex + 1}/{lesson.scenes.length}
            {steps > 1 && `　段階 ${state.step + 1}/${steps}`}
            　この段階 {mmss(sceneElapsed)}
          </div>
          <h1>{scene?.title}</h1>
          <div className="p-notes">{scene?.notes ?? ''}</div>
          <div className="p-next">
            <span className="p-label">次</span>
            {state.step < steps - 1 ? `同じ場面の段階 ${state.step + 2}` : next ? next.title : 'おわり'}
          </div>
          <div className="p-nav">
            <button onClick={() => dispatch({ type: 'prev' })}>← 戻る</button>
            <button className="primary" onClick={() => dispatch({ type: 'next' })}>
              進む →
            </button>
            <button onClick={() => dispatch({ type: 'replay' })}>もう一度（R）</button>
            <button onClick={() => dispatch({ type: 'blackout' })}>黒（B）</button>
          </div>
        </section>

        <section className="p-side">
          <h3>ワイプ</h3>
          <div className="p-wipes">
            {WIPE_BUTTONS.map(([mode, label]) => (
              <button key={mode} className={state.wipe.mode === mode ? 'is-on' : ''} onClick={() => dispatch({ type: 'wipe', mode })}>
                {label}
              </button>
            ))}
            <button onClick={() => dispatch({ type: 'swap' })}>左右を入れ替え（S）{state.wipe.swapped ? ' ✓' : ''}</button>
          </div>

          <h3>場面</h3>
          <ol className="p-scenes">
            {lesson.scenes.map((s, i) => (
              <li key={s.id} className={i === state.sceneIndex ? 'is-on' : i < state.sceneIndex ? 'is-done' : ''}>
                <button onClick={() => dispatch({ type: 'goto', index: i })}>
                  <span>{s.title}</span>
                  {s.plannedSec ? <small>{Math.round(s.plannedSec / 6) / 10}分</small> : null}
                </button>
              </li>
            ))}
          </ol>

          <h3>演出の記録 {state.effects.length}回</h3>
          <ul className="p-effects">
            {state.effects
              .slice(-6)
              .reverse()
              .map((e, i) => (
                <li key={i}>
                  {mmss(e.at - (state.startedAt ?? e.at))} {EFFECTS[e.kind].label}
                </li>
              ))}
          </ul>

          <h3>道具</h3>
          <div className="p-tools">
            <button onClick={() => setPanel('photos')}>写真の読み込み（U）</button>
            <button onClick={() => setPanel('help')}>操作の一覧（?）</button>
            <button
              onClick={() => {
                if (confirm('読み込んだ写真を全部消します。授業が終わったあとに使います。')) void clearAll();
              }}
            >
              写真を全部消す
            </button>
            <button
              className="danger"
              onClick={() => {
                if (confirm('最初の場面に戻し、経過時間と演出の記録を消します。')) dispatch({ type: 'reset' });
              }}
            >
              最初から（記録を消す）
            </button>
          </div>
        </section>
      </main>
      {panel === 'photos' && <PhotoTray onClose={() => setPanel('none')} />}
      {panel === 'help' && <KeyHelp onClose={() => setPanel('none')} />}
    </div>
  );
}
