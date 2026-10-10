// 場面「flash」（ボードゲームの判定: 各チームの紙を3秒だけ映す）。作業員が仕上げる（指示書: docs/briefs/02）。
// 段階0は題と枠の一覧（映す秒数もここで変える）。段階 k（1〜）は枠 k の「カウントダウン → 提示 → 黒」を、
// stepAt からの経過時間で決める。時間の計算は flashPhase（純粋な関数）に分けてある。
import './FlashScene.css';
import type { CSSProperties } from 'react';
import type { SceneKind, SceneViewProps } from '../engine/registry';
import { useNow } from '../engine/store';
import type { EffectKind } from '../engine/types';
import { photoStyle, teamSlot, usePhotos, type PhotoView } from '../media/photos';
import { rich } from './basic';

export interface FlashProps {
  /** 段階0に出す題 */
  heading?: string;
  /** 映す写真の枠の名前。既定は teamSlot(1)〜teamSlot(6) */
  slots?: string[];
  /** 枠ごとの名前。既定「チーム1」〜「チーム6」 */
  labels?: string[];
  /** 映す秒数。既定 3（1〜5）。段階0のボードで変えると sceneData に保存される */
  seconds?: number;
  /** カウントダウンの最初の数。既定 3 */
  countFrom?: number;
}

const DEFAULT_SLOTS = [1, 2, 3, 4, 5, 6].map(teamSlot);
const STAGE_ASPECT = 16 / 9;

const slotsOf = (p: FlashProps): string[] => p.slots ?? DEFAULT_SLOTS;
const labelOf = (p: FlashProps, i: number): string => p.labels?.[i] ?? `チーム${i + 1}`;
const countFromOf = (p: FlashProps): number => Math.max(1, Math.round(p.countFrom ?? 3));
const clampSeconds = (n: number): number => Math.min(5, Math.max(1, Math.round(n)));

/** 段階0で保存された秒数があればそれを、なければ props、それもなければ 3 */
function secondsOf(p: FlashProps, sceneData: unknown): number {
  const saved = sceneData as { seconds?: unknown } | null | undefined;
  const raw = typeof saved?.seconds === 'number' ? saved.seconds : (p.seconds ?? 3);
  return clampSeconds(raw);
}

export type FlashPhase = { kind: 'count'; n: number } | { kind: 'show' } | { kind: 'black' };

/**
 * 段階に入ってからの経過時間（ms）から、いまの見せ方を決める。
 * カウントダウンは countFrom 秒のあいだ（数字は countFrom から 1 まで、1秒ごと）、
 * そのあと seconds 秒の提示、そのあとは黒。
 */
export function flashPhase(elapsedMs: number, seconds: number, countFrom: number): FlashPhase {
  const t = Math.max(0, elapsedMs);
  const countMs = countFrom * 1000;
  if (t < countMs) return { kind: 'count', n: countFrom - Math.floor(t / 1000) };
  if (t < countMs + seconds * 1000) return { kind: 'show' };
  return { kind: 'black' };
}

/** 写真の箱。90度・270度は縦横が入れ替わるので、回す前の箱の縦横を入れ替えて、回したあとに枠いっぱいに入るようにする */
function photoBox(photo: PhotoView, aspect: number): CSSProperties {
  const quarter = photo.rotation % 180 !== 0;
  return {
    flex: 'none',
    width: quarter ? `${100 / aspect}%` : '100%',
    height: quarter ? `${100 * aspect}%` : '100%',
    objectFit: 'contain',
    ...photoStyle(photo),
  };
}

function FlashView({ scene, props, step, stepAt, state, dispatch }: SceneViewProps<FlashProps>) {
  const now = useNow(50);
  const photos = usePhotos();
  const slots = slotsOf(props);
  const seconds = secondsOf(props, state.sceneData[scene.id]);
  const k = Math.min(step, slots.length); // step が段階の数を超えたら最後の段階として描く

  if (k <= 0) {
    const setSeconds = (n: number) => dispatch({ type: 'scene-data', sceneId: scene.id, value: { seconds: clampSeconds(n) } });
    return (
      <div className="scene flash flash--prep">
        <div className="flash__prep">
          {props.heading && <h2 className="flash__heading">{rich(props.heading)}</h2>}
          <div className="flash__slots">
            {slots.map((slot, i) => {
              const photo = photos[slot];
              return (
                <div key={slot} className="flash__slot">
                  <div className="flash__slot-name">{labelOf(props, i)}</div>
                  <div className="flash__thumb">
                    {photo ? (
                      <div className="flash__frame">
                        <img className="flash__img" src={photo.url} alt="" draggable={false} style={photoBox(photo, 4 / 3)} />
                      </div>
                    ) : (
                      <div className="flash__none">まだ</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flash__seconds">
            <span>映す秒数</span>
            <button onClick={() => setSeconds(seconds - 1)} disabled={seconds <= 1}>
              −
            </button>
            <strong>{seconds} 秒</strong>
            <button onClick={() => setSeconds(seconds + 1)} disabled={seconds >= 5}>
              ＋
            </button>
          </div>
        </div>
      </div>
    );
  }

  const i = k - 1;
  const slot = slots[i];
  const name = labelOf(props, i);
  const photo = photos[slot];
  const phase = flashPhase(Math.max(0, now - stepAt), seconds, countFromOf(props));

  if (phase.kind === 'count') {
    return (
      <div className="scene flash flash--count">
        <div className="flash__frame">
          <div className="flash__tag">{name}</div>
          <div className="flash__number">{phase.n}</div>
        </div>
      </div>
    );
  }

  if (phase.kind === 'show') {
    return (
      <div className="scene flash flash--show">
        <div className="flash__frame">
          {photo ? (
            <img className="flash__img" src={photo.url} alt="" style={photoBox(photo, STAGE_ASPECT)} />
          ) : (
            <div className="flash__missing">{name}の写真がありません</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="scene flash flash--black">
      <div className="flash__corner">{name}</div>
    </div>
  );
}

export const FlashScene: SceneKind<FlashProps> = {
  component: FlashView,
  steps: (p) => [[], ...slotsOf(p).map((): EffectKind[] => ['countdown', 'flash'])],
};
