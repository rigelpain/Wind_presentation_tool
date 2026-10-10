// 舞台の窓。会議ツールで共有するのはこの窓。1920×1080 を基準に、窓の大きさに合わせて縮める。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { KEY_HELP, useKeys } from '../engine/keys';
import { getKind } from '../engine/registry';
import { DIP_IN_MS, DIP_OUT_MS } from '../engine/reducer';
import { dispatch, getStore, useShow } from '../engine/store';
import type { Lesson } from '../engine/types';
import { setSnapshot } from '../media/snapshots';
import { PhotoTray } from '../media/PhotoTray';
import { CameraSetup } from '../wipe/CameraSetup';
import { tracker } from '../wipe/tracker';
import { WipeLayer } from '../wipe/WipeLayer';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

function useFitScale() {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

export function openPresenter() {
  const url = `${location.pathname}${location.search}#/presenter`;
  window.open(url, 'wind-presenter', 'width=1280,height=800');
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

export function Stage({ lesson }: { lesson: Lesson }) {
  const state = useShow();
  const scale = useFitScale();
  const [panel, setPanel] = useState<'none' | 'camera' | 'photos' | 'help'>('none');
  const toggle = (p: typeof panel) => () => setPanel((cur) => (cur === p ? 'none' : p));

  const local = useMemo(
    () => ({
      f: toggleFullscreen,
      c: toggle('camera'),
      u: toggle('photos'),
      p: openPresenter,
      '?': toggle('help'),
      Escape: () => setPanel('none'),
    }),
    [],
  );
  useKeys(local);

  // 場面の切り替え。黒を挟む場面では、いったん黒に落としてから入れ替える
  const [shown, setShown] = useState(state.sceneIndex);
  const [dip, setDip] = useState<'none' | 'out' | 'in'>('none');
  const prevIndex = useRef(state.sceneIndex);
  useEffect(() => {
    if (state.sceneIndex === prevIndex.current) return;
    const forward = state.sceneIndex > prevIndex.current;
    prevIndex.current = state.sceneIndex;
    const target = lesson.scenes[state.sceneIndex];
    if (!forward || target?.transition !== 'black') {
      setDip('none');
      setShown(state.sceneIndex);
      return;
    }
    setDip('out');
    const t1 = window.setTimeout(() => {
      setShown(getStore().getState().sceneIndex);
      setDip('in');
    }, DIP_OUT_MS);
    const t2 = window.setTimeout(() => setDip('none'), DIP_OUT_MS + DIP_IN_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setShown(getStore().getState().sceneIndex);
    };
  }, [state.sceneIndex, lesson]);

  // カメラを隠す前と後の静止画（変化盲の答え合わせ用）
  const prevMode = useRef(state.wipe.mode);
  useEffect(() => {
    const was = prevMode.current;
    const now = state.wipe.mode;
    prevMode.current = now;
    if (was !== 'hidden' && now === 'hidden') {
      setSnapshot('before', tracker.snapshot());
      setSnapshot('after', null);
    } else if (was === 'hidden' && now !== 'hidden') {
      const t = window.setTimeout(() => setSnapshot('after', tracker.snapshot()), 700);
      return () => window.clearTimeout(t);
    }
  }, [state.wipe.mode]);

  useEffect(() => {
    tracker.mirror = state.wipe.mirror;
  }, [state.wipe.mirror]);

  // 前にカメラを許可していれば、開いたときに自動で始める
  useEffect(() => {
    const perms = navigator.permissions as Permissions | undefined;
    perms
      ?.query({ name: 'camera' as PermissionName })
      .then((p) => {
        if (p.state === 'granted' && tracker.status === 'idle') void tracker.start();
      })
      .catch(() => {});
  }, []);

  // マウスは動かしたときだけ出し、2秒止まったら隠す（共有の画面に矢印を残さない）
  const [cursor, setCursor] = useState(false);
  useEffect(() => {
    let t = 0;
    const onMove = () => {
      setCursor(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setCursor(false), 2000);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.clearTimeout(t);
    };
  }, []);

  const scene = lesson.scenes[shown];
  const kind = scene ? getKind(scene.kind) : undefined;
  const View = kind?.component;
  // 表示中の場面と状態の場面がずれている（黒の最中）あいだは、表示中の場面の最後の段階で止める
  const live = shown === state.sceneIndex;

  return (
    <div className={`stage-viewport ${cursor ? 'is-pointer' : ''}`}>
      <div className="stage" data-wipe={state.wipe.mode} style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="stage__scene" key={scene?.id}>
          {View && scene ? (
            <View
              scene={scene}
              props={scene.props ?? {}}
              step={live ? state.step : 99}
              stepAt={state.stepAt}
              replay={state.replay}
              state={state}
              lesson={lesson}
              dispatch={dispatch}
            />
          ) : (
            <div className="missing">場面の部品「{scene?.kind}」がありません</div>
          )}
        </div>
        <WipeLayer state={state} lesson={lesson} />
        {state.openLoops.length > 0 && !scene?.props?.hideLoops && (
          <div className="loops">
            {state.openLoops.map((l) => (
              <div key={l.id} className="loops__item">
                <span className="loops__tag">あとで</span>
                {l.text}
              </div>
            ))}
          </div>
        )}
        <div className={`dip dip--${dip}`} style={{ transitionDuration: `${dip === 'out' ? DIP_OUT_MS : DIP_IN_MS}ms` }} />
        {state.blackout && <div className="blackout" />}
      </div>
      {panel === 'camera' && <CameraSetup state={state} lesson={lesson} onClose={() => setPanel('none')} />}
      {panel === 'photos' && <PhotoTray onClose={() => setPanel('none')} />}
      {panel === 'help' && <KeyHelp onClose={() => setPanel('none')} />}
    </div>
  );
}

export function KeyHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel panel--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="panel__head">
          <h2>操作</h2>
          <button onClick={onClose}>閉じる</button>
        </div>
        <table className="keys">
          <tbody>
            {KEY_HELP.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
