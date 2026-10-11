// 1920×1080 の舞台を描く。表示画面でも、コントロール画面の縮小表示（いま・次）でも使う。
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { STAGE_W as W, stageHeight } from '../engine/aspect';
import { getKind, stepsOf } from '../engine/registry';
import { dispatch, getStore, useNow } from '../engine/store';
import type { Lesson, Scene, ShowState, Transition } from '../engine/types';
import { WipeLayer } from '../wipe/WipeLayer';
import { CaptionsLayer } from '../captions/CaptionsLayer';

export { STAGE_W } from '../engine/aspect';
/** 16:9 のときの高さ（形を変えるときは stageHeight を使う） */
export const STAGE_H = 1080;

/** 入れ物の大きさに合わせた縮尺 */
export function useFitScale(ref: RefObject<HTMLElement | null>, h: number) {
  const [scale, setScale] = useState(0.1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / h) || 0.1);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, h]);
  return scale;
}

function SceneLayer({ scene, step, state, lesson }: { scene: Scene; step: number; state: ShowState; lesson: Lesson }) {
  const View = getKind(scene.kind)?.component;
  if (!View) return <div className="missing">場面の部品「{scene.kind}」がありません</div>;
  return (
    <View
      scene={scene}
      props={scene.props ?? {}}
      step={step}
      stepAt={state.stepAt}
      replay={state.replay}
      state={state}
      lesson={lesson}
      dispatch={dispatch}
    />
  );
}

type Phase = { kind: 'none' } | { kind: Transition; from: number; to: number; at: number };

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function StageClock({ state, lesson }: { state: ShowState; lesson: Lesson }) {
  const now = useNow(500);
  const mode = state.settings.stageClock;
  if (mode === 'none') return null;
  let text = '';
  if (mode === 'time') text = new Date(now).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  else if (!state.startedAt) return null;
  else if (mode === 'elapsed') text = mmss(now - state.startedAt);
  else text = `残り ${mmss(lesson.durationMin * 60_000 - (now - state.startedAt))}`;
  return <div className="stage-clock">{text}</div>;
}

interface Props {
  state: ShowState;
  lesson: Lesson;
  /** 縮小表示。キー・カメラ・音は持たず、ワイプは仮の箱で出す */
  preview?: 'now' | 'next';
  children?: ReactNode;
}

export function StageCanvas({ state, lesson, preview, children }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const H = stageHeight(state.settings.aspect);
  const scale = useFitScale(viewport, H);
  const ms = state.settings.transitionMs;

  // 切り替えの演出。表示中の場面（shown）は、黒の最中だけ状態の場面より遅れる
  const [shown, setShown] = useState(state.sceneIndex);
  const [phase, setPhase] = useState<Phase>({ kind: 'none' });
  const prevIndex = useRef(state.sceneIndex);
  useEffect(() => {
    const from = prevIndex.current;
    const to = state.sceneIndex;
    if (to === from) return;
    prevIndex.current = to;
    const t = lesson.scenes[to]?.transition ?? 'cut';
    if (preview === 'next' || to < from || t === 'cut') {
      setPhase({ kind: 'none' });
      setShown(to);
      return;
    }
    const at = performance.now();
    setPhase({ kind: t, from, to, at });
    const timers: number[] = [];
    if (t === 'black') {
      timers.push(window.setTimeout(() => setShown(getStore().getState().sceneIndex), ms * 0.4));
    } else {
      setShown(to);
    }
    timers.push(window.setTimeout(() => setPhase({ kind: 'none' }), ms));
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      setShown(getStore().getState().sceneIndex);
    };
  }, [state.sceneIndex, lesson, ms, preview]);

  const index = preview === 'next' ? state.sceneIndex + 1 : shown;
  const scene = lesson.scenes[index];
  const live = preview !== 'next' && shown === state.sceneIndex;
  const step = preview === 'next' ? 0 : live ? state.step : 99;
  const wipeState: ShowState =
    preview === 'next' && scene?.wipe ? { ...state, wipe: { ...state.wipe, mode: scene.wipe } } : state;
  const prev = phase.kind === 'fade' || phase.kind === 'slide' ? lesson.scenes[phase.from] : undefined;
  const style = { '--t': `${ms}ms` } as CSSProperties;

  return (
    <div className={`stage-viewport ${preview ? 'stage-viewport--preview' : ''}`} ref={viewport}>
      <div className="stage" data-wipe={wipeState.wipe.mode} style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})`, ...style }}>
        {prev && (
          <div className={`stage__scene stage__scene--out-${phase.kind}`} key={`prev-${prev.id}`}>
            <SceneLayer scene={prev} step={99} state={state} lesson={lesson} />
          </div>
        )}
        {scene ? (
          <div className={`stage__scene ${phase.kind === 'fade' || phase.kind === 'slide' ? `stage__scene--in-${phase.kind}` : ''}`} key={scene.id}>
            <SceneLayer scene={scene} step={step} state={state} lesson={lesson} />
          </div>
        ) : (
          <div className="stage__scene stage__end">{preview === 'next' ? 'おわり' : ''}</div>
        )}
        <WipeLayer state={wipeState} lesson={lesson} placeholder={preview ? 'ワイプ' : undefined} />
        {(() => {
          // 次の予告: 予告を出す場面の最後の段階で、次の場面を知らせる
          const nextScene = preview !== 'next' && live ? lesson.scenes[index + 1] : undefined;
          const showTeaser = !!(scene?.teaser && nextScene && step >= stepsOf(scene).length - 1);
          const showLoops = state.openLoops.length > 0 && !scene?.props?.hideLoops;
          if (!showTeaser && !showLoops) return null;
          return (
            <div className="loops">
              {showTeaser && (
                <div className="loops__item loops__item--next" key={`next-${scene!.id}`}>
                  <span className="loops__tag loops__tag--next">つぎ ▶</span>
                  {scene!.teaserText?.trim() || nextScene!.title}
                </div>
              )}
              {showLoops &&
                state.openLoops.map((l) => (
                  <div key={l.id} className="loops__item">
                    <span className="loops__tag">あとで</span>
                    {l.text}
                  </div>
                ))}
            </div>
          );
        })()}
        {!preview && <StageClock state={state} lesson={lesson} />}
        {preview !== 'next' && <CaptionsLayer state={state} />}
        {phase.kind === 'black' && <div className="dip" key={`dip-${phase.at}`} />}
        {state.blackout && preview !== 'next' && <div className="blackout" />}
      </div>
      {children}
    </div>
  );
}
