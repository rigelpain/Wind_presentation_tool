// 音楽を鳴らす部品。表示画面とコントロール画面の両方に置き、状態の music.output と同じ窓だけが鳴らす。
// 位置は状態（startedAt と offsetSec）から計算するので、どちらの窓で操作しても、リロードしても合う。
import { useEffect, useRef, useState } from 'react';
import { musicPosition } from '../engine/reducer';
import { useShow } from '../engine/store';
import type { MusicState } from '../engine/types';
import { useTracks } from './audio';

export interface MusicStatus {
  role: 'display' | 'control';
  /** ブラウザが自動再生を止めた（その窓を一度クリックすると鳴る） */
  blocked: boolean;
  position: number;
  duration: number;
  at: number;
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('wind-music') : null;

export function MusicPlayer({ role }: { role: 'display' | 'control' }) {
  const state = useShow();
  const tracks = useTracks();
  const audio = useRef<HTMLAudioElement | null>(null);
  const music = useRef<MusicState>(state.music);
  music.current = state.music;
  const urls = useRef(new Map<string, string>());
  urls.current = new Map(tracks.map((t) => [t.id, t.url]));
  const active = state.music.output === role;

  useEffect(() => {
    if (!audio.current) audio.current = new Audio();
    const a = audio.current;
    let fadeOutFrom: number | null = null;
    let wasPlaying = false;
    let blocked = false;

    const tick = () => {
      const m = music.current;
      const now = Date.now();
      const url = m.trackId ? urls.current.get(m.trackId) : undefined;
      if (!active || !url) {
        if (!a.paused) a.pause();
        wasPlaying = false;
        return;
      }
      if (a.src !== url) a.src = url;
      const dur = Number.isFinite(a.duration) ? a.duration : 0;
      let pos = musicPosition(m, now);
      const ended = !m.loop && dur > 0 && pos >= dur;
      if (m.loop && dur > 0) pos %= dur;

      if (m.playing && !ended) {
        fadeOutFrom = null;
        // 流し始めと再開は、fadeMs かけて音を上げる
        const v = m.fadeMs > 0 ? Math.min(1, Math.max(0, now - m.startedAt) / m.fadeMs) : 1;
        a.volume = Math.max(0, Math.min(1, m.volume * v));
        if (a.paused) {
          a.currentTime = pos;
          a.play().then(
            () => (blocked = false),
            () => (blocked = true),
          );
        } else if (Math.abs(a.currentTime - pos) > 0.6) {
          a.currentTime = pos;
        }
        wasPlaying = true;
      } else if (!a.paused) {
        // 止めるときは、fadeMs かけて音を下げてから止める
        if (wasPlaying && fadeOutFrom === null) fadeOutFrom = now;
        wasPlaying = false;
        const k = fadeOutFrom !== null && m.fadeMs > 0 ? 1 - (now - fadeOutFrom) / m.fadeMs : 0;
        if (k <= 0 || ended) {
          a.pause();
          fadeOutFrom = null;
        } else {
          a.volume = Math.max(0, Math.min(1, m.volume * k));
        }
      }
      channel?.postMessage({ role, blocked, position: a.currentTime, duration: dur, at: now } satisfies MusicStatus);
    };
    const id = window.setInterval(tick, 100);
    tick();
    return () => {
      window.clearInterval(id);
      a.pause();
    };
  }, [active, role]);

  return null;
}

/** コントロール画面で、鳴らしている窓の様子を受け取る */
export function useMusicStatus(): MusicStatus | null {
  const [st, setSt] = useState<MusicStatus | null>(null);
  useEffect(() => {
    if (!channel) return;
    const ch = new BroadcastChannel('wind-music');
    ch.onmessage = (e: MessageEvent<MusicStatus>) => setSt(e.data);
    const t = window.setInterval(() => setSt((s) => (s && Date.now() - s.at > 2000 ? null : s)), 1000);
    return () => {
      window.clearInterval(t);
      ch.close();
    };
  }, []);
  return st;
}
