// コントロール画面の「カメラ・ワイプ」の枠。カメラと顔の追尾は表示画面の窓で動く。ここからは遠隔で操作し、確認用の絵と状態を見る。
// 指示書: docs/briefs/12_カメラとワイプ.md
import { openDisplay } from './Control';
import { RemotePreview } from '../wipe/RemotePreview';
import { dispatch, getStore, useLesson, useShow } from '../engine/store';
import type { Role, WipeMode } from '../engine/types';
import { useCameraRemote } from '../wipe/bus';
import { trackOf } from '../wipe/WipeLayer';
import './CameraPanel.css';

/** ワイプの見せ方のボタン。名札は自由に書くので、ボタンは左右で呼ぶ */
const MODES: [WipeMode, string][] = [
  ['both', '2人'],
  ['explain', '右を大きく'],
  ['host', '左だけ'],
  ['guest', '右だけ'],
  ['hidden', 'カメラを隠す'],
];

export function CameraPanel() {
  const state = useShow();
  const lesson = useLesson();
  const cam = useCameraRemote();
  const { status } = cam;
  const open = status !== null;
  const running = status?.status === 'running';
  const { mode, swapped, mirror, showLabels } = state.wipe;
  const { wipeScale, wipeZoom } = state.settings;

  /** 役割の人を見失っているか（登録で左の人を A、右の人を B。入れ替えを考えて役割から引く） */
  const lostOf = (role: Role): boolean => (status ? status.lost[trackOf(role, swapped)] : false);

  const setSettings = (patch: { wipeScale?: number; wipeZoom?: number }) => dispatch({ type: 'settings', patch });

  const view = () => {
    if (status?.status === 'running') return <RemotePreview remote={cam} />;
    if (status === null)
      return (
        <div className="camera__empty">
          <span>表示画面が開いていません</span>
          <button onClick={() => openDisplay()}>表示画面を開く</button>
        </div>
      );
    if (status.status === 'idle') return <div className="camera__empty">カメラは止まっています</div>;
    if (status.status === 'starting')
      return (
        <div className="camera__empty">
          {status.phase === 'model'
            ? 'カメラがつながりました。顔検出を読み込んでいます…'
            : 'カメラの許可を待っています。表示画面の窓に「カメラの使用を許可しますか」が出ているので、表示画面で「許可」を押してください'}
        </div>
      );
    if (status.status === 'error') return <div className="camera__empty camera__empty--error">{status.error}</div>;
    if (status.error) return <div className="camera__empty camera__empty--error">{status.error}</div>;
    return <div className="camera__empty">確認の絵を待っています…</div>;
  };

  return (
    <div className="c-panel camera">
      <div className="camera__view">
        <div className="camera__box">{view()}</div>
        {status && (
          <div className="camera__stat">
            <p className="hint">
              検出 {status.faces} 人 / {status.fps} fps{status.tiled ? '（左右に分けて探しています）' : ''}
            </p>
            {(['host', 'guest'] as Role[]).map((role) => (
              <p key={role} className={`hint ${lostOf(role) ? 'camera__lost' : ''}`}>
                {lesson.roleLabels[role]}：{lostOf(role) ? '見失い中' : '追えています'}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="camera__section">
        <h3>カメラ</h3>
        <label className="camera__field">
          カメラ
          <select value={status?.deviceId ?? ''} disabled={!open} onChange={(e) => cam.start(e.target.value)}>
            <option value="">既定のカメラ</option>
            {(status?.devices ?? []).map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <div className="camera__row">
          <button className="primary" disabled={!open} onClick={() => cam.start()}>
            {running ? 'カメラを始め直す' : 'カメラを始める'}
          </button>
          <button disabled={!open} onClick={() => cam.stop()}>
            止める
          </button>
        </div>
        <label className="camera__field">
          <span className="hint">カメラの代わりに動画・画像で試す</span>
          <input
            type="file"
            accept="video/*,image/*"
            disabled={!open}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) cam.sendFile(f);
            }}
          />
        </label>
      </div>

      <div className="camera__section">
        <h3>2人の登録</h3>
        <div className="camera__roles">
          {(['host', 'guest'] as Role[]).map((role) => (
            <label key={role} className="camera__role">
              <span>{role === 'host' ? '左の人の名札' : '右の人の名札'}</span>
              <input
                type="text"
                maxLength={24}
                value={state.settings.roleLabels?.[role] ?? ''}
                placeholder={getStore().lesson.roleLabels[role]}
                onChange={(e) => dispatch({ type: 'settings', patch: { roleLabels: { ...state.settings.roleLabels, [role]: e.target.value } } })}
              />
            </label>
          ))}
        </div>
        <p className="hint">
          2人ともカメラに映った状態で押します。画面で左に映っている人が左下のワイプ、右の人が右下のワイプになります。名札は書いたとおりに出ます（空なら「{getStore().lesson.roleLabels.host}」「{getStore().lesson.roleLabels.guest}」）。名札はこのPCにだけ置き、リポジトリには入りません。ほかの人の名前を出すときは、その人の了承を得てください。解説モード（E）では右の人が大きくなります。
        </p>
        <div className="camera__row">
          <button className="primary" disabled={!running} onClick={() => cam.register()}>
            登録する（左＝{lesson.roleLabels.host}、右＝{lesson.roleLabels.guest}）
          </button>
          <button onClick={() => dispatch({ type: 'swap' })}>左右を入れ替える{swapped ? ' ✓' : ''}</button>
        </div>
      </div>

      <div className="camera__section">
        <h3>ワイプの見せ方</h3>
        <div className="camera__modes">
          {MODES.map(([m, label]) => (
            <button key={m} className={mode === m ? 'is-on' : ''} onClick={() => dispatch({ type: 'wipe', mode: m })}>
              {label}
            </button>
          ))}
        </div>
        <p className="hint">キー: E＝右を大きく ・ H＝カメラを隠す ・ W＝2人同じ大きさ ・ S＝左右を入れ替え</p>
      </div>

      <div className="camera__section">
        <h3>ワイプの大きさと寄り</h3>
        <label className="camera__slider">
          <span className="camera__slider-head">
            大きさ <span>×{wipeScale.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={wipeScale}
            onChange={(e) => setSettings({ wipeScale: Number(e.target.value) })}
          />
        </label>
        <label className="camera__slider">
          <span className="camera__slider-head">
            顔への寄り <span>×{wipeZoom.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0.6}
            max={1.8}
            step={0.05}
            value={wipeZoom}
            onChange={(e) => setSettings({ wipeZoom: Number(e.target.value) })}
          />
        </label>
        <div className="camera__row">
          <button onClick={() => setSettings({ wipeScale: 1, wipeZoom: 1 })}>標準に戻す</button>
        </div>
      </div>

      <div className="camera__section">
        <h3>表示</h3>
        <label className="camera__check">
          <input type="checkbox" checked={mirror} onChange={() => dispatch({ type: 'mirror' })} />
          鏡のように左右を反転して映す
        </label>
        <label className="camera__check">
          <input type="checkbox" checked={showLabels} onChange={() => dispatch({ type: 'labels' })} />
          ワイプに名札を出す
        </label>
        <label className="camera__field">
          名札の字の大きさ
          <input
            type="range"
            min={0.75}
            max={2.5}
            step={0.05}
            value={state.settings.labelScale ?? 1}
            disabled={!showLabels}
            onChange={(e) => dispatch({ type: 'settings', patch: { labelScale: Number(e.target.value) } })}
          />
          <span>{Math.round(32 * (state.settings.labelScale ?? 1))}px</span>
          <button onClick={() => dispatch({ type: 'settings', patch: { labelScale: 1 } })}>標準</button>
        </label>
        <p className="hint">32px より小さいと、Zoom の共有では読みにくくなります。</p>

      </div>

      <p className="hint">顔の映像はこのPCのブラウザの中だけで使い、保存も送信もしません。</p>
    </div>
  );
}
