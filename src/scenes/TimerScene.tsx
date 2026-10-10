// 場面「timer」。残り時間を全画面の大きな数字で出す（授業の「制作4分」など）。
// 時間は stepAt（この段階に入った時刻）からの経過で計算する。部品の中に開始時刻は持たない。
import type { SceneKind, SceneViewProps } from '../engine/registry';
import { useNow } from '../engine/store';
import './TimerScene.css';

export interface TimerProps {
  heading?: string;
  seconds?: number;
  endText?: string;
}

/** 残りの秒。切り上げ（4:00 のあと 3:59 と続き、0:01 のあと 0:00 になる）。0 より小さくはしない。 */
export function timerRemaining(seconds: number, stepAt: number, now: number): number {
  const leftMs = seconds * 1000 - (now - stepAt);
  return Math.max(0, Math.ceil(leftMs / 1000));
}

/** 秒を 分:秒（秒は2桁）にする */
export function timerFormat(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function TimerView({ props, step, stepAt }: SceneViewProps<TimerProps>) {
  const now = useNow(100);
  const seconds = props.seconds ?? 240;
  // 段階0は止まったまま。段階1（以上）から数える。99 のように超えた値は最後の段階として扱う
  const counting = step >= 1;
  const left = counting ? timerRemaining(seconds, stepAt, now) : seconds;
  const done = counting && left === 0;
  return (
    <div className="scene timer">
      {props.heading && <div className="timer__heading">{props.heading}</div>}
      <div className="timer__digits">{timerFormat(left)}</div>
      {done && <div className="timer__end">{props.endText ?? '時間です'}</div>}
    </div>
  );
}

export const TimerScene: SceneKind<TimerProps> = {
  component: TimerView,
  steps: () => [[], ['countdown']],
};
