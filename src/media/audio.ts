// 授業で流す音楽の置き場。ファイルはこのブラウザの IndexedDB に置き、外へは送らない。
// 曲の id を状態（music.trackId、場面の music）に書いて使う。
import { useEffect, useSyncExternalStore } from 'react';

export interface Track {
  id: string;
  name: string;
  blob: Blob;
  addedAt: number;
}

export interface TrackView extends Track {
  url: string;
}

const DB_NAME = 'wind-audio';
const STORE = 'tracks';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('wind-audio') : null;

let views: TrackView[] = [];
const listeners = new Set<() => void>();
let loaded = false;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
  });
}

async function reload() {
  let all: Track[] = [];
  try {
    all = await tx('readonly', (s) => s.getAll() as IDBRequest<Track[]>);
  } catch {
    all = [];
  }
  all.sort((a, b) => a.addedAt - b.addedAt);
  const old = new Map(views.map((v) => [v.id, v]));
  const next = all.map((t) => {
    const o = old.get(t.id);
    return { ...t, url: o && o.blob === t.blob ? o.url : URL.createObjectURL(t.blob) };
  });
  const keep = new Set(next.map((v) => v.url));
  for (const v of views) if (!keep.has(v.url)) URL.revokeObjectURL(v.url);
  views = next;
  loaded = true;
  listeners.forEach((fn) => fn());
}

channel?.addEventListener('message', () => void reload());

async function changed() {
  await reload();
  channel?.postMessage('changed');
}

const newId = () => `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** 音のファイルを足す（音でないファイルは無視する）。足した曲の id を返す */
export async function addTracks(files: File[]): Promise<string[]> {
  const ids: string[] = [];
  for (const f of files) {
    if (!f.type.startsWith('audio/')) continue;
    const t: Track = { id: newId(), name: f.name.replace(/\.[^.]+$/, ''), blob: f, addedAt: Date.now() + ids.length };
    await tx('readwrite', (s) => s.put(t));
    ids.push(t.id);
  }
  await changed();
  return ids;
}

export async function renameTrack(id: string, name: string): Promise<void> {
  const cur = views.find((v) => v.id === id);
  if (!cur) return;
  const { url: _url, ...t } = cur;
  await tx('readwrite', (s) => s.put({ ...t, name }));
  await changed();
}

export async function removeTrack(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
  await changed();
}

export function useTracks(): TrackView[] {
  useEffect(() => {
    if (!loaded) void reload();
  }, []);
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => views,
  );
}
