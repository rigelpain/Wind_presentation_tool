// コントロール画面の「字幕」の枠。話し声を聞き取って、表示画面に字幕を出す。
import { useCaptions, useCaptionStatus } from '../captions/engine';
import { captionFontSize, captionHeight, captionRect, lineRatio } from '../captions/layout';
import { labelText } from '../engine/labelColors';
import { CaptionBoxEditor } from './CaptionBoxEditor';
import { dispatch, useShow } from '../engine/store';
import type { CaptionSettings } from '../engine/types';
import './CaptionsPanel.css';
import { MicMeter } from '../captions/MicMeter';

/** 字幕の字の色 */
const CAPTION_COLORS: [string, string][] = [
  ['白', '#FFFFFF'],
  ['黄', '#FDE047'],
  ['水色', '#7DD3FC'],
  ['黄緑', '#BEF264'],
  ['桃', '#F9A8D4'],
  ['橙', '#FDBA74'],
  ['墨（白い地のとき）', '#141414'],
];

/** 字幕の地の色。none は地なし（字に縁取り） */
const CAPTION_BGS: [string, string][] = [
  ['黒', '#141414'],
  ['紺', '#1E2A4A'],
  ['深緑', '#14352A'],
  ['えんじ', '#5A1A24'],
  ['白', '#FFFFFF'],
  ['地なし（字に縁取り）', 'none'],
];

export function CaptionsPanel() {
  const state = useShow();
  const c = state.settings.captions;
  const status = useCaptionStatus();
  const cap = useCaptions();
  const set = (patch: Partial<CaptionSettings>) => dispatch({ type: 'settings', patch: { captions: { ...c, ...patch } } });
  /** 行の数。自由な位置のときは、字の大きさを保って箱の高さを変える */
  const setLines = (lines: 1 | 2) => {
    if (c.position === 'free' && c.box) {
      const size = captionFontSize(c);
      const h = captionHeight(size, lines, lineRatio(c));
      set({ lines, box: { ...c.box, y: Math.max(0, c.box.y + c.box.h - h), h } });
    } else set({ lines });
  };
  /** 字の大きさ。自由な位置のときは、箱の高さを変えて合わせる（下の辺を基準にする） */
  const setSize = (size: number) => {
    if (c.position === 'free' && c.box) {
      const h = captionHeight(size, c.lines, lineRatio(c));
      const y = Math.max(0, c.box.y + c.box.h - h);
      set({ size, box: { ...c.box, y, h: Math.min(h, 1080) } });
    } else set({ size });
  };
  /** 行間。自由な位置のときは、字の大きさを保って箱の高さを変える（下の辺を基準にする） */
  const setLineHeight = (lineHeight: number) => {
    if (c.position === 'free' && c.box) {
      const size = captionFontSize(c);
      const h = Math.min(1080, captionHeight(size, c.lines, lineHeight));
      set({ lineHeight, box: { ...c.box, y: Math.max(0, c.box.y + c.box.h - h), h } });
    } else set({ lineHeight });
  };
  /** 地の色を変える。白い字に白い地のように読めなくなるときは、字を白か墨に入れ替える */
  const setBg = (bg: string) => {
    const color = (c.color || '#FFFFFF').toUpperCase();
    if (bg !== 'none') {
      const readable = labelText(bg);
      if (readable === '#141414' && color === '#FFFFFF') return set({ bg, color: '#141414' });
      if (readable === '#FFFFFF' && color === '#141414') return set({ bg, color: '#FFFFFF' });
    } else if (color === '#141414') {
      return set({ bg, color: '#FFFFFF' });
    }
    set({ bg });
  };

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
        <input type="range" min={24} max={120} step={2} value={captionFontSize(c)} onChange={(e) => setSize(Number(e.target.value))} />
        <span>{captionFontSize(c)}px</span>
      </label>
      <label className="captions-panel__row">
        行間
        <input type="range" min={1} max={2.2} step={0.05} value={lineRatio(c)} onChange={(e) => setLineHeight(Number(e.target.value))} />
        <span>{lineRatio(c).toFixed(2)}倍</span>
        <button onClick={() => setLineHeight(1.4)}>標準</button>
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
      </div>
      <div className="captions-panel__row">
        地の色
        {CAPTION_BGS.map(([name, hex]) => (
          <button
            key={hex}
            title={name}
            aria-label={name}
            className={`captions-panel__swatch ${hex === 'none' ? 'captions-panel__swatch--none' : ''} ${(c.bg || '#141414').toUpperCase() === hex.toUpperCase() ? 'is-on' : ''}`}
            style={hex === 'none' ? undefined : { background: hex }}
            onClick={() => setBg(hex)}
          />
        ))}
        <input
          type="color"
          title="ほかの色"
          value={c.bg && c.bg !== 'none' ? c.bg.toLowerCase() : '#141414'}
          onChange={(e) => setBg(e.target.value.toUpperCase())}
        />
      </div>
      <div className="captions-panel__row">
        見本
        <span
          className={`captions-panel__sample ${c.bg === 'none' ? 'captions-panel__sample--nobg' : ''}`}
          style={{ color: c.color || '#FFFFFF', background: c.bg === 'none' ? 'transparent' : c.bg || '#141414' }}
        >
          見えてるのに、見えてない
        </span>
      </div>
      <div className="captions-panel__row">
        位置
        <button className={c.position === 'bottom' ? 'is-on' : ''} onClick={() => set({ position: 'bottom' })}>
          自動（ワイプのあいだ）
        </button>
        <button className={c.position === 'top' ? 'is-on' : ''} onClick={() => set({ position: 'top' })}>
          上
        </button>
        <button className={c.position === 'free' ? 'is-on' : ''} onClick={() => set({ position: 'free', box: c.box ?? captionRect(state).rect })}>
          自由（ドラッグ）
        </button>
      </div>
      <CaptionBoxEditor />
      <div className="captions-panel__row">
        行の数（多いときは上へ送られて消える）
        <button className={c.lines === 1 ? 'is-on' : ''} onClick={() => setLines(1)}>
          1行
        </button>
        <button className={c.lines === 2 ? 'is-on' : ''} onClick={() => setLines(2)}>
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
