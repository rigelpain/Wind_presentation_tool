// コントロール画面の「字幕」の枠。話し声を聞き取って、表示画面に字幕を出す。
import { useCaptions, useCaptionStatus } from '../captions/engine';
import { dispatch, useShow } from '../engine/store';
import type { CaptionSettings } from '../engine/types';
import './CaptionsPanel.css';
import { MicMeter } from '../captions/MicMeter';

/** 字幕の地（黒に近い）の上で読みやすい色 */
const CAPTION_COLORS: [string, string][] = [
  ['白', '#FFFFFF'],
  ['黄', '#FDE047'],
  ['水色', '#7DD3FC'],
  ['黄緑', '#BEF264'],
  ['桃', '#F9A8D4'],
  ['橙', '#FDBA74'],
];

export function CaptionsPanel() {
  const c = useShow().settings.captions;
  const status = useCaptionStatus();
  const cap = useCaptions();
  const set = (patch: Partial<CaptionSettings>) => dispatch({ type: 'settings', patch: { captions: { ...c, ...patch } } });

  let note = '';
  let bad = false;
  if (status.state === 'unsupported') {
    note = 'このブラウザは音声認識が使えません。Google Chrome で開いてください。';
    bad = true;
  } else if (status.state === 'starting') note = 'マイクを準備しています…（この窓にマイクの許可が出たら「許可」）';
  else if (status.state === 'listening') note = status.local ? '聞き取り中（このPCの中で文字にしています）' : '聞き取り中（Google のサーバーで文字にしています。ネットが要ります）';
  else if (status.state === 'error') {
    note = status.message;
    bad = true;
  }

  return (
    <div className="c-panel captions-panel">
      <label className="captions-panel__switch">
        <input type="checkbox" checked={c.enabled} onChange={() => set({ enabled: !c.enabled })} />
        <b>字幕を出す</b>
      </label>
      {note && <p className={`hint ${bad ? 'captions-panel__bad' : ''}`}>{note}</p>}
      <div className="captions-panel__meter">
        <MicMeter />
      </div>
      {c.enabled && (
        <div className="captions-panel__live">
          {[...(cap?.finals ?? []).slice(-3), ...(cap?.interim ? [cap.interim] : [])].map((l) => (
            <div key={l.id}>{l.text}</div>
          ))}
          {!cap?.finals.length && !cap?.interim && <span className="hint">話すと、ここと表示画面に出ます</span>}
        </div>
      )}

      <h3>見た目</h3>
      <label className="captions-panel__row">
        字の大きさ
        <input type="range" min={36} max={96} step={2} value={c.size} onChange={(e) => set({ size: Number(e.target.value) })} />
        <span>{c.size}px</span>
      </label>
      <div className="captions-panel__row">
        字の色
        {CAPTION_COLORS.map(([name, hex]) => (
          <button
            key={hex}
            title={name}
            aria-label={name}
            className={`captions-panel__swatch ${(c.color || '#FFFFFF').toUpperCase() === hex ? 'is-on' : ''}`}
            style={{ background: hex }}
            onClick={() => set({ color: hex })}
          />
        ))}
        <input type="color" title="ほかの色" value={(c.color || '#FFFFFF').toLowerCase()} onChange={(e) => set({ color: e.target.value.toUpperCase() })} />
        <span className="captions-panel__sample" style={{ color: c.color || '#FFFFFF' }}>
          字幕の見本
        </span>
      </div>
      <div className="captions-panel__row">
        位置
        <button className={c.position === 'bottom' ? 'is-on' : ''} onClick={() => set({ position: 'bottom' })}>
          下（ワイプのあいだ）
        </button>
        <button className={c.position === 'top' ? 'is-on' : ''} onClick={() => set({ position: 'top' })}>
          上
        </button>
      </div>
      <div className="captions-panel__row">
        行の数（多いときは上へ送られて消える）
        <button className={c.lines === 1 ? 'is-on' : ''} onClick={() => set({ lines: 1 })}>
          1行
        </button>
        <button className={c.lines === 2 ? 'is-on' : ''} onClick={() => set({ lines: 2 })}>
          2行
        </button>
      </div>
      <label className="captions-panel__row">
        話が止まってから消えるまで
        <input type="range" min={2} max={10} step={1} value={c.holdSec} onChange={(e) => set({ holdSec: Number(e.target.value) })} />
        <span>{c.holdSec}秒</span>
      </label>

      <p className="hint">
        この窓のマイクで聞き取ります（Zoom と同じマイクを使ってかまいません）。日本語は、Chrome がこのPCの中で文字にできればそうし、できなければ Google のサーバーに声を送って文字にします（無料。ネットが要ります）。だれが話したかは分けられません。聞き取った文字は保存しません。担当の先生の声も送るので、使うときは事前に伝えてください。
      </p>
      <p className="hint">この窓（コントロール画面）を閉じると字幕も止まります。</p>
    </div>
  );
}
