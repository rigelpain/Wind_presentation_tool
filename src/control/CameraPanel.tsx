// コントロール画面の「カメラ」の枠。カメラと顔の追尾は表示画面の窓で動く。ここからは遠隔で操作し、確認用の絵と状態を見る。
// 指示書: docs/briefs/12_カメラとワイプ.md（見た目は docs/briefs/20_コントロール画面を見やすく.md）
import { ArrowLeftRight, Camera, EyeOff, FileVideo, FlipHorizontal2, Maximize2, Monitor, PanelLeft, PanelRight, PictureInPicture2, Power, RotateCcw, ScanFace, Square, Tag, Type, Users, Video, ZoomIn } from 'lucide-react';
import { openDisplay } from './Control';
import { RemotePreview } from '../wipe/RemotePreview';
import { DEFAULT_LABEL_BG, LABEL_SWATCHES, labelText } from '../engine/labelColors';
import { dispatch, getStore, useLesson, useShow } from '../engine/store';
import type { Role, WipeMode } from '../engine/types';
import { useCameraRemote } from '../wipe/bus';
import { trackOf } from '../wipe/WipeLayer';
import { IconButton, Row, Section, Segmented, Slider, Status, Swatches, Toggle, type SegOption } from './ui';
import './CameraPanel.css';

/** ワイプの見せ方の切り替え。名札は自由に書くので、ボタンは左右で呼ぶ */
const MODES: SegOption<WipeMode>[] = [
  { value: 'both', label: '2人', icon: Users, title: '2人を同じ大きさで（W）' },
  { value: 'explain', label: '右を大きく', icon: Maximize2, title: '右を大きく（解説モード・E）' },
  { value: 'host', label: '左だけ', icon: PanelLeft, title: '左の人だけ' },
  { value: 'guest', label: '右だけ', icon: PanelRight, title: '右の人だけ' },
  { value: 'hidden', label: '隠す', icon: EyeOff, title: 'カメラを隠す（H）' },
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
  const lostNames = (['host', 'guest'] as Role[]).filter((r) => lostOf(r)).map((r) => lesson.roleLabels[r]);

  const setSettings = (patch: { wipeScale?: number; wipeZoom?: number }) => dispatch({ type: 'settings', patch });

  /** カメラの状態の印（いつも見えるのはこの1行だけ） */
  const statusTag = () => {
    if (status === null) return <Status tone="idle">表示画面なし</Status>;
    if (status.status === 'running') return <Status tone="ok">動いています</Status>;
    if (status.status === 'starting')
      return status.phase === 'model' ? <Status tone="warn">顔検出を準備中</Status> : <Status tone="warn">許可を待ち中</Status>;
    if (status.status === 'idle') return <Status tone="idle">止まっています</Status>;
    return <Status tone="bad">エラー</Status>;
  };

  const view = () => {
    if (status?.status === 'running') return <RemotePreview remote={cam} />;
    if (status === null)
      return (
        <div className="camera__empty">
          <IconButton icon={Monitor} label="開く" title="表示画面を開く" onClick={() => openDisplay()} />
        </div>
      );
    if (status.status === 'idle') return <div className="camera__empty">始めると、ここに確認の映像が出ます</div>;
    if (status.status === 'starting')
      return (
        <div className="camera__empty">
          {status.phase === 'model' ? '顔検出を読み込んでいます…' : '表示画面の窓で「許可」を押してください'}
        </div>
      );
    if (status.status === 'error') return <div className="camera__empty camera__empty--error">{status.error}</div>;
    if (status.error) return <div className="camera__empty camera__empty--error">{status.error}</div>;
    return <div className="camera__empty">確認の絵を待っています…</div>;
  };

  return (
    <div className="c-panel camera">
      <Section
        icon={Camera}
        title="カメラ"
        aside={statusTag()}
        help={
          <div className="camera__help">
            <p>表示画面の窓に「カメラの使用を許可しますか」が出たら、表示画面で「許可」を押してください。</p>
            <p>顔の映像はこのPCのブラウザの中だけで使い、保存も送信もしません。</p>
          </div>
        }
      >
        <div className="camera__box">{view()}</div>
        {status && (
          <p className="camera__stat">
            検出 {status.faces} 人 / {status.fps} fps{status.tiled ? '・左右に分けて探索' : ''}
            {lostNames.length > 0 && <span className="camera__lost">　見失い中: {lostNames.join('・')}</span>}
          </p>
        )}
        <Row icon={Video} label="カメラ">
          <select className="camera__select" value={status?.deviceId ?? ''} disabled={!open} onChange={(e) => cam.start(e.target.value)}>
            <option value="">既定のカメラ</option>
            {(status?.devices ?? []).map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </Row>
        <div className="camera__actions">
          <IconButton
            icon={Power}
            label={running ? '始め直す' : '始める'}
            title={running ? 'カメラを始め直す' : 'カメラを始める'}
            variant="primary"
            disabled={!open}
            onClick={() => cam.start()}
          />
          <IconButton icon={Square} label="止める" title="カメラを止める" disabled={!open} onClick={() => cam.stop()} />
          <label className={`ui-btn camera__file ${open ? '' : 'is-disabled'}`} title="カメラの代わりに、動画か画像で試す">
            <FileVideo size={16} aria-hidden />
            <span>動画で試す</span>
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
      </Section>

      <Section
        icon={Users}
        title="2人"
        help={
          <div className="camera__help">
            <p>
              2人ともカメラに映った状態で「登録」を押します。画面で左に映っている人が左下、右の人が右下のワイプになります。
              名札は書いたとおりに出ます（空なら「{getStore().lesson.roleLabels.host}」「{getStore().lesson.roleLabels.guest}」）。
            </p>
            <p>名札はこのPCにだけ置き、リポジトリには入りません。ほかの人の名前を出すときは、その人の了承を得てください。解説モード（E）では右の人が大きくなります。</p>
          </div>
        }
      >
        {(['host', 'guest'] as Role[]).map((role) => {
          const cur = state.settings.labelColors?.[role] ?? DEFAULT_LABEL_BG;
          return (
            <Row key={role} icon={role === 'host' ? PanelLeft : PanelRight} label={role === 'host' ? '左の人' : '右の人'}>
              <span className="camera__name">
                <input
                  type="text"
                  maxLength={24}
                  value={state.settings.roleLabels?.[role] ?? ''}
                  placeholder={getStore().lesson.roleLabels[role]}
                  onChange={(e) => dispatch({ type: 'settings', patch: { roleLabels: { ...state.settings.roleLabels, [role]: e.target.value } } })}
                />
                <Swatches
                  colors={LABEL_SWATCHES.map((c) => ({ name: c.name, value: c.bg }))}
                  value={cur}
                  onChange={(v) => dispatch({ type: 'settings', patch: { labelColors: { ...state.settings.labelColors, [role]: v } } })}
                />
                <span className="camera__tag" style={{ background: cur, color: labelText(cur) }}>
                  {lesson.roleLabels[role]}
                </span>
              </span>
            </Row>
          );
        })}
        <div className="camera__actions">
          <IconButton
            icon={ScanFace}
            label="登録"
            title={`左＝${lesson.roleLabels.host}、右＝${lesson.roleLabels.guest} として2人を登録する（2人ともカメラに映っているとき）`}
            variant="primary"
            disabled={!running}
            onClick={() => cam.register()}
          />
          <IconButton icon={ArrowLeftRight} label="入れ替え" title="左右を入れ替える（S）" active={swapped} onClick={() => dispatch({ type: 'swap' })} />
        </div>
      </Section>

      <Section
        icon={PictureInPicture2}
        title="ワイプ"
        aside={<IconButton icon={RotateCcw} title="大きさと寄りを標準に戻す" size={14} onClick={() => setSettings({ wipeScale: 1, wipeZoom: 1 })} />}
        help={
          <div className="camera__help">
            <p>キー: E＝右を大きく ・ H＝カメラを隠す ・ W＝2人同じ大きさ ・ S＝左右を入れ替え</p>
            <p>名札の字は 32px より小さいと、Zoom の共有では読みにくくなります。</p>
          </div>
        }
      >
        <Segmented wrap options={MODES} value={mode} onChange={(m) => dispatch({ type: 'wipe', mode: m })} />
        <Row icon={Maximize2} label="大きさ" title="ワイプの大きさ">
          <Slider min={0.6} max={1.6} step={0.05} value={wipeScale} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setSettings({ wipeScale: v })} />
        </Row>
        <Row icon={ZoomIn} label="寄り" title="顔への寄り">
          <Slider min={0.6} max={1.8} step={0.05} value={wipeZoom} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setSettings({ wipeZoom: v })} />
        </Row>
        <Row icon={Type} label="名札の字" title="名札の字の大きさ">
          <Slider
            min={0.75}
            max={2.5}
            step={0.05}
            value={state.settings.labelScale ?? 1}
            disabled={!showLabels}
            reset={1}
            format={(v) => `${Math.round(32 * v)}px`}
            onChange={(v) => dispatch({ type: 'settings', patch: { labelScale: v } })}
          />
        </Row>
        <Row icon={FlipHorizontal2} label="鏡" title="左右を反転して映す">
          <Toggle checked={mirror} onChange={() => dispatch({ type: 'mirror' })} />
        </Row>
        <Row icon={Tag} label="名札" title="ワイプに名札を出す">
          <Toggle checked={showLabels} onChange={() => dispatch({ type: 'labels' })} />
        </Row>
      </Section>
    </div>
  );
}
