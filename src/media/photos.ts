// 授業中に読み込む写真（ボードゲームの紙など）の置き場。名前の付いた枠（slot）ごとに1枚。
// IndexedDB に置くのでリロードしても残る。窓どうしは BroadcastChannel で知らせ合う。
// 授業が終わったら clearAll() で消す（発表者用の画面の「写真を全部消す」）。
import { useEffect, useSyncExternalStore, type CSSProperties } from 'react';

export interface Photo {
  slot: string;
  blob: Blob;
  /** 0, 90, 180, 270 */
  rotation: number;
  /** 1 が元の明るさ */
  brightness: number;
  addedAt: number;
}

export interface PhotoView extends Photo {
  url: string;
}

const DB_NAME = 'wind-photos';
const STORE = 'photos';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('wind-photos') : null;

let views: Record<string, PhotoView> = {};
const listeners = new Set<() => void>();
let loaded = false;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
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
  let all: Photo[] = [];
  try {
    all = await tx('readonly', (s) => s.getAll() as IDBRequest<Photo[]>);
  } catch {
    all = [];
  }
  const next: Record<string, PhotoView> = {};
  for (const p of all) {
    const old = views[p.slot];
    const url = old && old.blob === p.blob ? old.url : URL.createObjectURL(p.blob);
    next[p.slot] = { ...p, url };
  }
  for (const [slot, v] of Object.entries(views)) {
    if (!next[slot] || next[slot].url !== v.url) URL.revokeObjectURL(v.url);
  }
  views = next;
  loaded = true;
  listeners.forEach((fn) => fn());
}

channel?.addEventListener('message', () => void reload());

async function changed() {
  await reload();
  channel?.postMessage('changed');
}

export async function putPhoto(slot: string, blob: Blob): Promise<void> {
  const p: Photo = { slot, blob, rotation: 0, brightness: 1, addedAt: Date.now() };
  await tx('readwrite', (s) => s.put(p));
  await changed();
}

/** 空いている枠に順に入れる。slots は入れてよい枠の順番 */
export async function putPhotosInOrder(files: Blob[], slots: string[]): Promise<void> {
  const empty = slots.filter((s) => !views[s]);
  for (let i = 0; i < files.length && i < empty.length; i++) {
    const p: Photo = { slot: empty[i], blob: files[i], rotation: 0, brightness: 1, addedAt: Date.now() };
    await tx('readwrite', (s) => s.put(p));
  }
  await changed();
}

export async function updatePhoto(slot: string, patch: Partial<Pick<Photo, 'rotation' | 'brightness'>>): Promise<void> {
  const cur = views[slot];
  if (!cur) return;
  const { url: _url, ...photo } = cur;
  await tx('readwrite', (s) => s.put({ ...photo, ...patch }));
  await changed();
}

export async function swapPhotos(a: string, b: string): Promise<void> {
  const pa = views[a];
  const pb = views[b];
  await tx('readwrite', (s) => {
    if (pa) s.delete(a);
    if (pb) s.delete(b);
    const strip = (v: PhotoView, slot: string): Photo => ({ slot, blob: v.blob, rotation: v.rotation, brightness: v.brightness, addedAt: v.addedAt });
    if (pa) s.put(strip(pa, b));
    if (pb) s.put(strip(pb, a));
    return s.count();
  });
  await changed();
}

export async function removePhoto(slot: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(slot));
  await changed();
}

export async function clearAll(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
  await changed();
}

export function usePhotos(): Record<string, PhotoView> {
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

/** 写真の表示用の CSS（回転と明るさ） */
export function photoStyle(p: Pick<Photo, 'rotation' | 'brightness'>): CSSProperties {
  return {
    transform: p.rotation ? `rotate(${p.rotation}deg)` : undefined,
    filter: p.brightness !== 1 ? `brightness(${p.brightness})` : undefined,
  };
}

/** ボードゲームのチームの枠の名前 */
export const teamSlot = (n: number) => `team-${n}`;
