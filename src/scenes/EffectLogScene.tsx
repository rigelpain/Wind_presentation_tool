// 種明かし: この授業でツールが使った演出を、回数つき・時間軸つきで「設計の証拠」として並べる。
// 言い回しは授業側で決めるので、見出しと前置きは props で差し替える。
import { EFFECT_ORDER, EFFECTS } from '../engine/effects';
import type { SceneKind, SceneViewProps } from '../engine/registry';
import type { EffectKind } from '../engine/types';
import { rich } from './basic';

interface EffectLogProps {
  heading?: string;
  /** 段階0で出す前置き（設計の逆算の話）。1行ずつ → で出す */
  intro?: string[];
  /** 一覧に出さない演出 */
  exclude?: EffectKind[];
  /** 理由（why）を出すか */
  showWhy?: boolean;
}

function EffectLogView({ props, step, state }: SceneViewProps<EffectLogProps>) {
  const intro = props.intro ?? [];
  const listStep = intro.length; // intro の行を出しきった次の段階で一覧
  const timelineStep = listStep + 1;
  const exclude = new Set(props.exclude ?? []);
  const events = state.effects.filter((e) => !exclude.has(e.kind));
  const counts = new Map<EffectKind, number>();
  for (const e of events) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  const rows = EFFECT_ORDER.filter((k) => (counts.get(k) ?? 0) > 0);
  const start = state.startedAt ?? events[0]?.at ?? Date.now();
  const end = Math.max(start + 60_000, ...events.map((e) => e.at));
  const total = events.length;

  if (step < listStep) {
    return (
      <div className="scene scene--text align-left size-l">
        {props.heading && <h2 className="heading">{rich(props.heading)}</h2>}
        <div className="lines">
          {intro.map((l, i) => (
            <p key={i} className={`line ${i <= step ? 'line--on' : 'line--off'}`}>
              {rich(l)}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="scene scene--log">
      <h2 className="heading">{rich(props.heading ?? 'この30分、ツールがしていたこと')}</h2>
      <div className="log__total">
        合計 <strong>{total}</strong> 回
      </div>
      <div className="log__rows">
        {rows.map((k) => (
          <div key={k} className="log__row">
            <span className="log__swatch" style={{ background: EFFECTS[k].color }} />
            <span className="log__label">
              {EFFECTS[k].label}
              {props.showWhy !== false && <small>{EFFECTS[k].why}</small>}
            </span>
            <span className="log__count">{counts.get(k)}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="hint-big">まだ記録がありません（授業を始めると数え始めます）</p>}
      </div>
      {step >= timelineStep && (
        <div className="timeline">
          {rows.map((k) => (
            <div key={k} className="timeline__lane">
              {events
                .filter((e) => e.kind === k)
                .map((e, i) => (
                  <span
                    key={i}
                    className="timeline__mark"
                    style={{ left: `${((e.at - start) / (end - start)) * 100}%`, background: EFFECTS[k].color }}
                  />
                ))}
            </div>
          ))}
          <div className="timeline__axis">
            <span>はじまり</span>
            <span>{Math.round((end - start) / 60000)}分</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const EffectLogScene: SceneKind<EffectLogProps> = {
  component: EffectLogView,
  steps: (p) => [...(p.intro ?? []).map(() => []), [], []],
};
