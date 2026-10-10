// 場面「chapter」。授業の章を横に並べ、今から始まる章を「解放」して見せる。
// 終わった章は名前を見せる。今の章は場面に入って 0.3 秒後から 0.5 秒かけて鍵の見た目から名前へ変わる。
// これからの章は名前を全部伏せる（予想と結果のズレのため）。
import './ChapterScene.css';
import type { SceneKind, SceneViewProps } from '../engine/registry';
import { useNow } from '../engine/store';
import { rich } from './basic';

interface ChapterProps {
  heading?: string;
  chapters: string[];
  /** これから始まる章の番号（0 から） */
  current: number;
}

/** 今の章の変化を始めるまでの待ち時間と、変化にかける時間（ミリ秒）。stepAt からの経過で決める */
const UNLOCK_DELAY_MS = 300;
const UNLOCK_MS = 500;

/** 今の章の変化の進み具合（0〜1）。0.3 秒までは 0、0.8 秒からは 1 */
export function unlockProgress(elapsedMs: number): number {
  const p = (elapsedMs - UNLOCK_DELAY_MS) / UNLOCK_MS;
  return Math.min(1, Math.max(0, p));
}

function ChapterView({ props, stepAt }: SceneViewProps<ChapterProps>) {
  const now = useNow(50);
  const elapsed = Math.max(0, now - stepAt);
  const progress = unlockProgress(elapsed);
  const total = props.chapters.length;

  return (
    <div className="scene chapter">
      {props.heading && <h2 className="heading">{rich(props.heading)}</h2>}
      <div className="chapter__row">
        {props.chapters.map((name, i) => {
          if (i < props.current) {
            return (
              <div key={i} className="chapter__card chapter__card--done">
                <span className="chapter__name">{name}</span>
                <span className="chapter__done">済</span>
              </div>
            );
          }
          if (i === props.current) {
            return (
              <div key={i} className="chapter__card">
                <div className="chapter__layer chapter__layer--locked" style={{ opacity: 1 - progress }}>
                  <span className="chapter__hidden">?</span>
                </div>
                {progress > 0 && (
                  <div className="chapter__layer chapter__layer--open" style={{ opacity: progress }}>
                    <span className="chapter__name">{name}</span>
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={i} className="chapter__card">
              <div className="chapter__layer chapter__layer--locked">
                <span className="chapter__hidden">?</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="chapter__count">
        {props.current + 1} / {total}
      </div>
    </div>
  );
}

export const ChapterScene: SceneKind<ChapterProps> = {
  component: ChapterView,
  steps: () => [['unlock']],
};
