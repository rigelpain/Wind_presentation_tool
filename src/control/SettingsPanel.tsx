// コントロール画面の「切り替えと時計」の枠。指示書: docs/briefs/14_切り替えと時計.md
import { useEffect, useState } from 'react';
import { dispatch, useLesson, useShow } from '../engine/store';
import type { ShowSettings, Transition } from '../engine/types';
import './SettingsPanel.css';

const TRANSITIONS: [Transition, string, string][] = [
  ['cut', 'カット', 'すぐ切り替える'],
  ['black', '黒を挟む', '区切りを作る。演出として記録する'],
  ['fade', '重ねる', '前の画面と重ねて替える'],
  ['slide', '横すべり', '次が右から入る。演出として記録する'],
];

const CLOCKS: [ShowSettings['stageClock'], string][] = [
  ['none', '出さない'],
  ['remaining', '残り時間'],
  ['elapsed', '経過時間'],
  ['time', 'いまの時刻'],
];

/**
 * 授業の長さの入力（文字）を分に直す。
 * 空、または数でないものは null（授業のデータのまま）。範囲外は 5〜180 に収める。
 */
export function toDurationMin(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.min(180, Math.max(5, Math.round(n)));
}

function hhmm(ms: number) {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SettingsPanel() {
  const state = useShow();
  const lesson = useLesson();
  const s = state.settings;

  // 授業の長さの入力欄。入力中は打ち込んだ文字を保ち、確定（Enter・欄から出る）で送る
  const [draft, setDraft] = useState(s.durationMin === null ? '' : String(s.durationMin));
  useEffect(() => {
    // 別の操作（元に戻すなど）で授業の長さが変わったら、入力欄にも映す
    setDraft(s.durationMin === null ? '' : String(s.durationMin));
  }, [s.durationMin]);

  const commitDuration = () => {
    const v = toDurationMin(draft);
    setDraft(v === null ? '' : String(v));
    if (v !== s.durationMin) dispatch({ type: 'settings', patch: { durationMin: v } });
  };

  const resetAll = () => {
    if (!window.confirm('切り替えと時計の設定を、初めの状態に戻しますか？（並び・ワイプの設定は戻しません）')) return;
    dispatch({
      type: 'settings',
      patch: { defaultTransition: 'cut', transitionMs: 500, durationMin: null, stageClock: 'none' },
    });
  };

  return (
    <div className="c-panel">
      <h3>場面に指定がないときの切り替え</h3>
      <div className="settings__options" role="radiogroup" aria-label="場面に指定がないときの切り替え">
        {TRANSITIONS.map(([key, label, desc]) => {
          const on = s.defaultTransition === key;
          return (
            <div className="settings__option" key={key}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                className={on ? 'is-on' : undefined}
                onClick={() => dispatch({ type: 'settings', patch: { defaultTransition: key } })}
              >
                {label}
              </button>
              <span className="hint">{desc}</span>
            </div>
          );
        })}
      </div>

      <h3>切り替えの長さ</h3>
      <div className="settings__slider">
        <input
          type="range"
          min={200}
          max={1500}
          step={50}
          value={s.transitionMs}
          aria-label="切り替えの長さ"
          onChange={(e) => dispatch({ type: 'settings', patch: { transitionMs: Number(e.target.value) } })}
        />
        <span className="settings__value">{(s.transitionMs / 1000).toFixed(2)}秒</span>
      </div>
      <p className="hint">授業設計の目安は 0.4〜0.6秒</p>
      <p className="hint">場面ごとの切り替えは「スライド」の枠で変えられます</p>

      <h3>授業の長さ</h3>
      <div className="settings__row">
        <input
          type="number"
          min={5}
          max={180}
          inputMode="numeric"
          placeholder="授業のデータ"
          aria-label="授業の長さ（分）"
          className="settings__minutes"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDuration}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDuration();
          }}
        />
        <span>分</span>
        <span className="hint">いまの長さ: {lesson.durationMin} 分</span>
      </div>

      <h3>表示画面に出す時計</h3>
      <div className="settings__options settings__options--row" role="radiogroup" aria-label="表示画面に出す時計">
        {CLOCKS.map(([key, label]) => {
          const on = s.stageClock === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              className={on ? 'is-on' : undefined}
              onClick={() => dispatch({ type: 'settings', patch: { stageClock: key } })}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="hint">表示画面の左上に小さく出ます。生徒にも見えます</p>

      <h3>授業の開始</h3>
      <div className="settings__row">
        {state.startedAt === null ? (
          <button type="button" className="primary" onClick={() => dispatch({ type: 'start' })}>
            授業を始める
          </button>
        ) : (
          <button type="button" disabled>
            開始 {hhmm(state.startedAt)}
          </button>
        )}
      </div>

      <h3>設定を元に戻す</h3>
      <div className="settings__row">
        <button type="button" onClick={resetAll}>
          切り替えと時計を元に戻す
        </button>
      </div>
    </div>
  );
}
