// コントロール画面の「字幕」の枠。話し声を聞き取って、表示画面に字幕を出す。
import { AlignVerticalSpaceAround, Baseline, Captions, Move, PaintBucket, PanelBottom, PanelTop, Type } from 'lucide-react';
import { useCaptions, useCaptionStatus } from '../captions/engine';
import { captionFontSize, captionHeight, captionRect, lineRatio } from '../captions/layout';
import { labelText } from '../engine/labelColors';
import { CaptionBoxEditor } from './CaptionBoxEditor';
import { dispatch, useShow } from '../engine/store';
import type { CaptionSettings } from '../engine/types';
import './CaptionsPanel.css';
import { MicMeter } from '../captions/MicMeter';
import { Row, Section, Segmented, Slider, Status, Swatches, Toggle } from './ui';

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

  let tone: 'ok' | 'warn' | 'bad' | 'idle' = 'idle';
  let note = '止まっています';
  if (status.state === 'unsupported') {
    note = 'このブラウザは非対応（Chrome で開く）';
    tone = 'bad';
  } else if (status.state === 'starting') {
    note = 'マイクを準備中…';
    tone = 'warn';
  } else if (status.state === 'listening') {
    note = status.local ? '聞き取り中（PC の中）' : '聞き取り中（Google）';
    tone = 'ok';
  } else if (status.state === 'error') {
    note = status.message;
    tone = 'bad';
  }

  return (
    <div className="c-panel captions-panel">
      <Section
        icon={Captions}
        title="字幕"
        help={
          <>
            <p className="hint">
              この窓のマイクで聞き取ります（Zoom と同じマイクを使ってかまいません）。日本語は、Chrome がこのPCの中で文字にできればそうし、できなければ Google のサーバーに声を送って文字にします（無料。ネットが要ります）。だれが話したかは分けられません。聞き取った文字は保存しません。担当の先生の声も送るので、使うときは事前に伝えてください。
            </p>
            <p className="hint">マイクの許可は、この窓に出たら「許可」。この窓（コントロール画面）を閉じると字幕も止まります。</p>
          </>
        }
      >
        <div className="captions-panel__switch">
          <Toggle checked={c.enabled} onChange={() => set({ enabled: !c.enabled })} label="字幕を出す" />
        </div>
        <Status tone={tone}>{note}</Status>
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
      </Section>

      <Section
        icon={Type}
        title="文字"
        help={<p className="hint">行の数は、多いときは上へ送られて消えます。消えるまでは、話が止まってから消えるまでの秒数です。</p>}
      >
        <Row icon={Type} label="大きさ">
          <Slider min={24} max={120} step={2} value={captionFontSize(c)} onChange={setSize} format={(v) => `${v}px`} />
        </Row>
        <Row icon={AlignVerticalSpaceAround} label="行間">
          <Slider min={1} max={2.2} step={0.05} value={lineRatio(c)} onChange={setLineHeight} format={(v) => `${v.toFixed(2)}倍`} reset={1.4} />
        </Row>
        <Row label="消えるまで" title="話が止まってから消えるまで">
          <Slider min={2} max={10} step={1} value={c.holdSec} onChange={(v) => set({ holdSec: v })} format={(v) => `${v}秒`} />
        </Row>
        <Row label="行の数" title="多いときは上へ送られて消える">
          <Segmented<1 | 2> options={[{ value: 1, label: '1行' }, { value: 2, label: '2行' }]} value={c.lines} onChange={setLines} />
        </Row>
        <Row icon={Baseline} label="字の色">
          <Swatches colors={CAPTION_COLORS.map(([name, value]) => ({ name, value }))} value={c.color || '#FFFFFF'} onChange={(v) => set({ color: v })} />
        </Row>
        <Row icon={PaintBucket} label="地の色">
          <Swatches colors={CAPTION_BGS.map(([name, value]) => ({ name, value }))} value={c.bg || '#141414'} onChange={setBg} />
        </Row>
        <Row label="見本">
          <span
            className={`captions-panel__sample ${c.bg === 'none' ? 'captions-panel__sample--nobg' : ''}`}
            style={{ color: c.color || '#FFFFFF', background: c.bg === 'none' ? 'transparent' : c.bg || '#141414' }}
          >
            見えてるのに、見えてない
          </span>
        </Row>
      </Section>

      <Section
        icon={Move}
        title="位置"
        help={<p className="hint">箱をドラッグして動かし、辺や角をドラッグして大きさを変えます。動かすと、表示画面にもすぐ効きます。</p>}
      >
        <Segmented<CaptionSettings['position']>
          options={[
            { value: 'bottom', label: '自動', icon: PanelBottom, title: '自動（ワイプのあいだ）' },
            { value: 'top', label: '上', icon: PanelTop },
            { value: 'free', label: '自由', icon: Move, title: 'ドラッグで決める' },
          ]}
          value={c.position}
          onChange={(p) => (p === 'free' ? set({ position: 'free', box: c.box ?? captionRect(state).rect }) : set({ position: p }))}
        />
        <CaptionBoxEditor />
      </Section>
    </div>
  );
}
