// 編集画面で作った授業。このPCのブラウザ（localStorage）に置き、リポジトリには入れない。
// 画像は写真の置き場（IndexedDB）に「asset-…」の名前で置く。書き出すときは画像も1つのファイルにまとめる。
import type { Lesson, Scene } from '../engine/types';
import { putPhoto, readAsset, ASSET_PREFIX } from '../media/photos';

const KEY = 'wind-user-lessons';

export function loadUserLessons(): Lesson[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Lesson[]) : [];
    return Array.isArray(list) ? list.filter((l) => l && l.id && Array.isArray(l.scenes)) : [];
  } catch {
    return [];
  }
}

export function saveUserLessons(list: Lesson[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function saveUserLesson(lesson: Lesson) {
  const list = loadUserLessons();
  const i = list.findIndex((l) => l.id === lesson.id);
  if (i >= 0) list[i] = lesson;
  else list.push(lesson);
  saveUserLessons(list);
}

export function deleteUserLesson(id: string) {
  saveUserLessons(loadUserLessons().filter((l) => l.id !== id));
}

export const isUserLesson = (id: string) => id.startsWith('u-');

const newId = (head: string) => `${head}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const newSceneId = () => newId('s-');

/** 新しい授業。構成は、最初のセクション（アイキャッチ）が1つだけ */
export function newLesson(title = '新しい授業'): Lesson {
  const section = newId('n-');
  return {
    id: newId('u-'),
    title,
    durationMin: 30,
    roleLabels: { host: '進行', guest: '解説' },
    scenes: [],
    board: {
      nodes: [{ id: section, x: 0, y: 0, text: title, kind: 'section', sectionMode: 'eyecatch', pageFlow: [] }],
      edges: [],
      sections: [section],
      flow: [],
    },
  };
}

/** 見本の授業などを、編集できる写しにする */
export function copyLesson(src: Lesson, title = `${src.title}（写し）`): Lesson {
  const copy = JSON.parse(JSON.stringify(src)) as Lesson;
  return { ...copy, id: newId('u-'), title };
}

/** 授業に出てくる素材の枠の名前 */
function assetSlots(lesson: Lesson): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string' && v.startsWith(ASSET_PREFIX)) found.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  lesson.scenes.forEach((s: Scene) => walk(s.props));
  return [...found];
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

interface ExportFile {
  format: 'wind-lesson';
  version: 1;
  lesson: Lesson;
  assets: Record<string, string>;
}

/** 授業を1つのファイル（画像込み）にする */
export async function exportLesson(lesson: Lesson): Promise<Blob> {
  const assets: Record<string, string> = {};
  for (const slot of assetSlots(lesson)) {
    const b = await readAsset(slot);
    if (b) assets[slot] = await blobToDataUrl(b);
  }
  const file: ExportFile = { format: 'wind-lesson', version: 1, lesson, assets };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

/** 書き出したファイルを読み込む。同じ id の授業があれば別の id にする */
export async function importLesson(file: File): Promise<Lesson> {
  const data = JSON.parse(await file.text()) as ExportFile;
  if (data.format !== 'wind-lesson' || !data.lesson?.scenes) throw new Error('この道具で書き出した授業のファイルではありません');
  for (const [slot, url] of Object.entries(data.assets ?? {})) {
    const blob = await (await fetch(url)).blob();
    await putPhoto(slot, blob);
  }
  let lesson = data.lesson;
  if (!isUserLesson(lesson.id) || loadUserLessons().some((l) => l.id === lesson.id)) lesson = { ...lesson, id: newId('u-') };
  saveUserLesson(lesson);
  return lesson;
}
