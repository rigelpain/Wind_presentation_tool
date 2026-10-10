// 場面「reveal」。予想させてから、→ で答えを明かす。
// 段階0: 問いと、答えの場所の「？」（画像があればぼかして出す）。段階1: 答えが出て、画像のぼかしが取れる。
// 時間は stepAt からの経過で決める。リロードしても、明かした後の見た目から始まる（演出をやり直さない）。
import { useState, type ReactNode } from 'react';
import './RevealScene.css';
import type { SceneKind, SceneViewProps } from '../engine/registry';
import { MediaView, countEmphasis, rich } from './basic';
import { useNow } from '../engine/store';

/** 画像のぼかしが取れる時間（ミリ秒）。背面の層はこのあいだだけ残す */
const UNBLUR_MS = 600;

interface RevealProps {
  /** 例「予想してみて」 */
  heading?: string;
  /** 問い。`**言葉**` で強調できる */
  question: string;
  /** 答えの言葉。`**言葉**` で強調できる */
  answer?: string;
  /** ぼかしてから明かす画像（なくてもよい） */
  media?: { src?: string; slot?: string };
  /** 答えが隠れているあいだに答えの場所に出す字。既定「？」 */
  hiddenText?: string;
}

/**
 * 段階1に入ってからの動きを、入ったときの経過ぶんだけ進めて描く。
 * 経過は mount のときに一度だけ決める（描き直しでアニメーションの途中が飛ばないように）。
 */
function Unveil({ stepAt, className, children }: { stepAt: number; className: string; children: ReactNode }) {
  const [offset] = useState(() => Math.max(0, Date.now() - stepAt));
  return (
    <div className={className} style={{ animationDelay: `-${offset}ms` }}>
      {children}
    </div>
  );
}

function RevealView({ props, step, stepAt, replay }: SceneViewProps<RevealProps>) {
  const revealed = step >= 1;
  const hasMedia = Boolean(props.media);
  const hidden = props.hiddenText ?? '？';
  const now = useNow(100);
  // 背面（縁のにじみを隠す、枠より大きいぼかしの層）は、明かしてから UNBLUR_MS のあいだだけ残して消す。
  // 写真そのものは枠の中に全体が入る大きさで、ぼかしが取れたあとも切れない
  const backShown = !revealed || now - stepAt < UNBLUR_MS;
  const item = { ...props.media, fit: 'contain' as const };

  const media = hasMedia && props.media && (
    <div className="reveal__media-frame">
      {backShown && (
        <div className={`reveal__media-back ${revealed ? 'reveal__media-back--out' : ''}`}>
          <MediaView item={item} />
        </div>
      )}
      {revealed ? (
        // 段階1: 0.6 秒でぼかしが取れる。やり直し（R）のときは取り直す
        <Unveil key={replay} stepAt={stepAt} className="reveal__media-front reveal__media-front--open">
          <MediaView item={item} />
        </Unveil>
      ) : (
        <div className="reveal__media-front">
          <MediaView item={item} />
        </div>
      )}
    </div>
  );

  return (
    <div className={`scene reveal ${hasMedia ? 'reveal--with-media' : ''}`}>
      {props.heading && <h2 className="heading">{rich(props.heading)}</h2>}
      <div className="reveal__body">
        {media}
        <div className="reveal__text">
          <p className="reveal__question">{rich(props.question)}</p>
          <div className={`reveal__answer-box ${revealed ? 'is-revealed' : ''}`}>
            {revealed ? (
              // 段階1: 0.5 秒、下から上がって薄くから濃くなる。やり直し（R）のときは取り直す
              <Unveil key={replay} stepAt={stepAt} className="reveal__answer">
                {rich(props.answer ?? '')}
              </Unveil>
            ) : (
              <div className="reveal__hidden">{hidden}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const RevealScene: SceneKind<RevealProps> = {
  component: RevealView,
  steps: (p) => [
    [...countEmphasis(p.question), ...countEmphasis(p.heading)],
    ['reveal', ...countEmphasis(p.answer)],
  ],
};
