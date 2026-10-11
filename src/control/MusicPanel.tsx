// コントロール画面の「音楽」の枠。作業員が仕上げる（指示書: docs/briefs/20_コントロール画面を見やすく.md）。
// 曲は addTracks などで IndexedDB に置き、鳴らすのは MusicPlayer（表示画面とこの画面の両方にある）。
import { Laptop, ListMusic, Monitor, Music, Pause, Pencil, Play, Repeat, Square, Trash2, Upload, Volume2 } from 'lucide-react';
import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { DEFAULT_MUSIC, musicPosition } from '../engine/reducer';
import { dispatch, useNow, useShow } from '../engine/store';
import { addTracks, removeTrack, renameTrack, useTracks, type TrackView } from '../media/audio';
import { useMusicStatus } from '../media/MusicPlayer';
import { IconButton, Row, Section, Segmented, Slider, Status, Toggle } from './ui';
import './MusicPanel.css';

/** 曲の時刻（秒）を「分:秒」にする。秒は2桁、小数は切り捨てる（0:00 / 0:59 / 1:00 / 3:45） */
export function songTime(sec: number): string {
  const s = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const FADES: [number, string][] = [
  [0, 'なし'],
  [500, '0.5秒'],
  [1000, '1秒'],
  [1500, '1.5秒'],
  [3000, '3秒'],
];

export function MusicPanel() {
  const state = useShow();
  const tracks = useTracks();
  const now = useNow(250);
  const status = useMusicStatus();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const m = state.music;
  const current = tracks.find((t) => t.id === m.trackId);
  const duration = status?.duration ?? 0;
  const raw = musicPosition(m, now);
  // 繰り返すときは曲の長さで折り返す（鳴らす窓と同じ見せ方）。繰り返さないときは最後で止まる
  const pos = duration > 0 ? (m.loop ? raw % duration : Math.min(raw, duration)) : raw;

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (!files.some((f) => f.type.startsWith('audio/'))) {
      setError('音のファイルではありません');
      return;
    }
    setError(null);
    try {
      await addTracks(files);
    } catch {
      setError('曲を足せませんでした。このブラウザの保存領域を確かめてください');
    }
  };

  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
  };
  const onDrop = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragOver(false);
    void addFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div
      className={`c-panel music ${dragOver ? 'is-drop' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Section icon={Music} title="再生">
        <div className="music__now-title">{current ? current.name : '曲を選んでいません'}</div>
        <div className="music__transport">
          {m.playing ? (
            <IconButton icon={Pause} title="一時停止" onClick={() => dispatch({ type: 'music-pause' })} />
          ) : (
            <IconButton icon={Play} title="再生" variant="primary" disabled={!current} onClick={() => dispatch({ type: 'music-play' })} />
          )}
          <IconButton icon={Square} title="止める" onClick={() => dispatch({ type: 'music-stop' })} />
        </div>
        <Slider
          min={0}
          max={duration}
          step={0.01}
          value={pos}
          disabled={!current || duration <= 0}
          onChange={(v) => dispatch({ type: 'music-seek', sec: v })}
          format={(v) => `${songTime(v)} / ${duration > 0 ? songTime(duration) : '—'}`}
        />
        {status?.blocked && <Status tone="warn">自動再生が止まっています（{m.output === 'display' ? '表示画面' : 'この画面'}をクリック）</Status>}
        {!status && m.playing && <Status tone="bad">鳴らす窓が開いていません</Status>}
      </Section>

      <Section icon={Volume2} title="音">
        <Row label="音量">
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={m.volume}
            format={(v) => `${Math.round(v * 100)}%`}
            reset={DEFAULT_MUSIC.volume}
            onChange={(v) => dispatch({ type: 'music-set', patch: { volume: v } })}
          />
        </Row>
        <Row icon={Repeat} label="くり返す">
          <Toggle checked={m.loop} onChange={(v) => dispatch({ type: 'music-set', patch: { loop: v } })} />
        </Row>
        <Row label="フェード">
          <Segmented
            wrap
            options={FADES.map(([ms, label]) => ({ value: ms, label }))}
            value={m.fadeMs}
            onChange={(v) => dispatch({ type: 'music-set', patch: { fadeMs: v } })}
          />
        </Row>
        <Row label="鳴らす窓">
          <Segmented<'display' | 'control'>
            options={[
              { value: 'display', label: '表示画面', icon: Monitor, title: '表示画面で鳴らす（画面共有で音を送るとき）' },
              { value: 'control', label: 'この画面', icon: Laptop, title: 'この画面で鳴らす（手元で鳴らすとき）' },
            ]}
            value={m.output}
            onChange={(v) => dispatch({ type: 'music-set', patch: { output: v } })}
          />
        </Row>
      </Section>

      <Section
        icon={ListMusic}
        title="曲"
        help="曲はこのPCのブラウザの中に置きます。場面ごとに流す曲は『スライド』の枠で決められます。著作権のある曲は、授業で使ってよいか確かめてから入れてください。音のファイルをこの枠にドロップしても足せます。"
        aside={
          <>
            <IconButton icon={Upload} label="足す" title="曲を足す（音のファイルを選ぶ。枠にドロップしても足せます）" onClick={() => fileInput.current?.click()} />
            <input
              ref={fileInput}
              type="file"
              accept="audio/*"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                void addFiles(files);
              }}
            />
          </>
        }
      >
        {tracks.length === 0 && <p className="hint">曲はまだありません。</p>}
        <ul className="music__list">
          {tracks.map((t) => (
            <TrackRow key={t.id} track={t} current={t.id === m.trackId} onError={setError} />
          ))}
        </ul>
        {error && <Status tone="bad">{error}</Status>}
      </Section>
    </div>
  );
}

function TrackRow({
  track,
  current,
  onError,
}: {
  track: TrackView;
  current: boolean;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(track.name);
  const cancel = useRef(false);

  const startEdit = () => {
    setDraft(track.name);
    setEditing(true);
  };

  // 名前の入力欄から出たとき（Enter・Esc は blur を呼ぶ）に、一度だけ保存する
  const finishEdit = () => {
    setEditing(false);
    if (cancel.current) {
      cancel.current = false;
      return;
    }
    const name = draft.trim();
    if (!name || name === track.name) return;
    renameTrack(track.id, name).catch(() => onError('名前を直せませんでした'));
  };

  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return; // 日本語の変換中の Enter は確定だけ
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      cancel.current = true;
      e.currentTarget.blur();
    }
  };

  const remove = async () => {
    if (!confirm(`「${track.name}」を消します。元に戻せません。`)) return;
    if (current) dispatch({ type: 'music-stop' });
    try {
      await removeTrack(track.id);
    } catch {
      onError('曲を消せませんでした');
    }
  };

  return (
    <li className={`music__row ${current ? 'is-current' : ''}`}>
      <IconButton icon={Play} title="流す" onClick={() => dispatch({ type: 'music-play', trackId: track.id })} />
      {editing ? (
        <input
          className="music__name-input"
          aria-label="曲の名前"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onNameKey}
          onBlur={finishEdit}
        />
      ) : (
        <button className="music__name" title="クリックで名前を直す" onClick={startEdit}>
          {track.name}
        </button>
      )}
      {!editing && <IconButton icon={Pencil} title="名前を直す" onClick={startEdit} />}
      <IconButton icon={Trash2} title="消す" variant="danger" onClick={() => void remove()} />
    </li>
  );
}
