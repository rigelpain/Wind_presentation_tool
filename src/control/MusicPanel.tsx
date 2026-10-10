// コントロール画面の「音楽」の枠。作業員が仕上げる（指示書: docs/briefs/13_音楽.md）。
// 曲は addTracks などで IndexedDB に置き、鳴らすのは MusicPlayer（表示画面とこの画面の両方にある）。
import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { musicPosition } from '../engine/reducer';
import { dispatch, useNow, useShow } from '../engine/store';
import { addTracks, removeTrack, renameTrack, useTracks, type TrackView } from '../media/audio';
import { useMusicStatus } from '../media/MusicPlayer';
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
      <h3>いまの曲</h3>
      <div className="music__now-title">{current ? current.name : '曲を選んでいません'}</div>
      <div className="music__transport">
        {m.playing ? (
          <button onClick={() => dispatch({ type: 'music-pause' })}>一時停止</button>
        ) : (
          <button className="primary" disabled={!current} onClick={() => dispatch({ type: 'music-play' })}>
            再生
          </button>
        )}
        <button onClick={() => dispatch({ type: 'music-stop' })}>止める</button>
      </div>
      <div className="music__field">
        <input
          className="music__range"
          type="range"
          aria-label="曲の位置"
          min={0}
          max={duration}
          step="any"
          value={pos}
          disabled={!current || duration <= 0}
          onChange={(e) => dispatch({ type: 'music-seek', sec: Number(e.target.value) })}
        />
        <span className="music__time">
          {songTime(pos)} / {duration > 0 ? songTime(duration) : '—'}
        </span>
      </div>
      {status?.blocked && (
        <p className="music__alert">
          ブラウザが自動再生を止めています。{m.output === 'display' ? '表示画面' : 'この画面'}を一度クリックしてください。
        </p>
      )}
      {!status && m.playing && <p className="music__notice">鳴らす窓が開いていません</p>}

      <h3>音量など</h3>
      <div className="music__field">
        <span>音量</span>
        <input
          className="music__range"
          type="range"
          aria-label="音量"
          min={0}
          max={1}
          step={0.05}
          value={m.volume}
          onChange={(e) => dispatch({ type: 'music-set', patch: { volume: Number(e.target.value) } })}
        />
        <span className="music__time">{Math.round(m.volume * 100)}%</span>
      </div>
      <label className="music__field">
        <input
          type="checkbox"
          checked={m.loop}
          onChange={(e) => dispatch({ type: 'music-set', patch: { loop: e.target.checked } })}
        />
        くり返す
      </label>
      <label className="music__field">
        フェード
        <select
          value={String(m.fadeMs)}
          onChange={(e) => dispatch({ type: 'music-set', patch: { fadeMs: Number(e.target.value) } })}
        >
          {FADES.map(([ms, label]) => (
            <option key={ms} value={ms}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="music__field">
        鳴らす窓
        <select
          value={m.output}
          onChange={(e) => dispatch({ type: 'music-set', patch: { output: e.target.value as 'display' | 'control' } })}
        >
          <option value="display">表示画面（画面共有で音を送るとき）</option>
          <option value="control">この画面（手元で鳴らすとき）</option>
        </select>
      </label>

      <h3>曲の一覧</h3>
      {tracks.length === 0 && <p className="hint">曲はまだありません。</p>}
      <ul className="music__list">
        {tracks.map((t) => (
          <TrackRow key={t.id} track={t} current={t.id === m.trackId} onError={setError} />
        ))}
      </ul>
      {error && <p className="music__alert">{error}</p>}
      <div className="music__add">
        <button onClick={() => fileInput.current?.click()}>曲を足す</button>
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
      </div>
      <p className="hint">音のファイルをこの枠にドロップしても足せます。</p>
      <p className="hint">
        曲はこのPCのブラウザの中に置きます。場面ごとに流す曲は『スライド』の枠で決められます。著作権のある曲は、授業で使ってよいか確かめてから入れてください。
      </p>
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
      <button onClick={() => dispatch({ type: 'music-play', trackId: track.id })}>流す</button>
      <button className="danger" onClick={() => void remove()}>
        消す
      </button>
    </li>
  );
}
