// コントロール画面の「切り替えと時計」の枠。指示書: docs/briefs/14_切り替えと時計.md（見た目は docs/briefs/20_コントロール画面を見やすく.md）
import {
  Blend,
  Clock,
  EyeOff,
  Hourglass,
  Layers,
  Monitor,
  MoveRight,
  Play,
  Ruler,
  RotateCcw,
  Scissors,
  Square,
  Timer,
  type LucideIcon,
  Ratio,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { dispatch, useLesson, useShow } from '../engine/store';
import type { ShowSettings, Transition } from '../engine/types';
import { ASPECTS } from '../engine/aspect';
import { IconButton, Row, Section, Segmented, Slider, Status } from './ui';
import './SettingsPanel.css';

const TRANSITIONS: [Transition, string, string, LucideIcon][] = [
  ['cut', 'カット', 'すぐ切り替える', Scissors],
  ['black', '黒を挟む', '区切りを作る。演出として記録する', Square],
  ['fade', '重ねる', '前の画面と重ねて替える', Blend],
  ['slide', '横すべり', '次が右から入る。演出として記録する', MoveRight],
];

const CLOCKS: [ShowSettings['stageClock'], string, LucideIcon][] = [
  ['none', '出さない', EyeOff],
  ['remaining', '残り時間', Hourglass],
  ['elapsed', '経過時間', Timer],
  ['time', 'いまの時刻', Clock],
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
      <Section
        icon={Ratio}
        title="画面の形"
        help="表示画面の縦横の比。プロジェクターや画面に合わせると、全画面にしたときに上下や左右の黒い帯がなくなります。Mac の画面は 16:10、多くのプロジェクターと Zoom は 16:9、古いプロジェクターは 4:3。幅はそのままで高さが変わるので、字の大きさは変わりません。"
      >
        <Segmented
          options={ASPECTS.map((a) => ({ value: a.value, label: a.label, title: a.title }))}
          value={state.settings.aspect ?? '16:9'}
          onChange={(aspect) => dispatch({ type: 'settings', patch: { aspect } })}
        />
      </Section>
      <Section
        icon={Layers}
        title="切り替え"
        help={
          <div className="settings__help">
            <p>カット: すぐ切り替える</p>
            <p>黒を挟む: 区切りを作る。演出として記録する</p>
            <p>重ねる: 前の画面と重ねて替える</p>
            <p>横すべり: 次が右から入る。演出として記録する</p>
            <p>授業設計の目安は 0.4〜0.6秒</p>
            <p>場面ごとの切り替えは「スライド」の枠で変えられます</p>
          </div>
        }
      >
        <Segmented
          wrap
          options={TRANSITIONS.map(([value, label, desc, icon]) => ({ value, label, icon, title: desc }))}
          value={s.defaultTransition}
          onChange={(v) => dispatch({ type: 'settings', patch: { defaultTransition: v } })}
        />
        <Row icon={Ruler} label="長さ">
          <Slider
            min={200}
            max={1500}
            step={50}
            value={s.transitionMs}
            format={(v) => `${(v / 1000).toFixed(2)}秒`}
            onChange={(v) => dispatch({ type: 'settings', patch: { transitionMs: v } })}
          />
        </Row>
      </Section>

      <Section
        icon={Clock}
        title="時計"
        help={<div className="settings__help"><p>表示画面の左上に小さく出ます。生徒にも見えます</p></div>}
      >
        <div className="settings__clock">
          <Row icon={Hourglass} label="授業の長さ">
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
            <span className="settings__now">いま {lesson.durationMin} 分</span>
          </Row>
          <Row icon={Monitor} label="表示画面" title="表示画面の左上に出す時計">
            <Segmented
              wrap
              options={CLOCKS.map(([value, label, icon]) => ({ value, label, icon }))}
              value={s.stageClock}
              onChange={(v) => dispatch({ type: 'settings', patch: { stageClock: v } })}
            />
          </Row>
          <Row label="授業">
            {state.startedAt === null ? (
              <IconButton icon={Play} label="始める" title="授業を始める（経過時間と記録を始める）" variant="primary" onClick={() => dispatch({ type: 'start' })} />
            ) : (
              <Status tone="ok">開始 {hhmm(state.startedAt)}</Status>
            )}
          </Row>
        </div>
      </Section>

      <Section icon={RotateCcw} title="元に戻す">
        <IconButton icon={RotateCcw} label="戻す" title="切り替えと時計の設定を初めの状態に戻す（並び・ワイプの設定は戻さない）" onClick={resetAll} />
      </Section>
    </div>
  );
}
