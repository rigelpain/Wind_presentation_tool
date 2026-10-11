// マイクの音量の表示。横の帯（緑 → 黄 → 赤）と、大きさの目安の言葉。
import { levelWord, useMicLevel } from './micLevel';

export function MicMeter({ compact = false }: { compact?: boolean }) {
  const m = useMicLevel(true);
  if (m.state === 'error') return <span className="mic mic--error">マイクを開けません</span>;
  const pct = Math.round(m.level * 100);
  const peak = Math.round(m.peak * 100);
  return (
    <span className={`mic ${compact ? 'mic--compact' : ''}`} title="マイクの音量">
      {compact && <span className="mic__icon">マイク</span>}
      <span className="mic__bar">
        <span className="mic__fill" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} />
        <span className="mic__peak" style={{ left: `${peak}%` }} />
      </span>
      {!compact && <span className="mic__word">{m.state === 'on' ? levelWord(m.db) : '準備中（画面をクリックで開始）'}</span>}
    </span>
  );
}
