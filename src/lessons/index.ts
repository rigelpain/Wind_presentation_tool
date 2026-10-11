// 授業を選ぶ。URL の ?lesson=<id> で切り替える。省くと見本。
// src/lessons/private/*.ts（リポジトリに入れない）に置いた授業も、ここで自動で読む。
import type { Lesson } from '../engine/types';
import { demo } from './demo';
import { parts } from './parts';
import { loadUserLessons } from './userLessons';

const privateModules = import.meta.glob<{ default: Lesson }>('./private/*.ts', { eager: true });

/** リポジトリにある授業（見本と private）。編集画面では「写して編集」する */
export const builtinLessons: Lesson[] = [demo, parts, ...Object.values(privateModules).map((m) => m.default)];

/** いま選べる授業（リポジトリの授業と、編集画面で作った授業） */
export function allLessons(): Lesson[] {
  return [...builtinLessons, ...loadUserLessons()];
}

export function pickLesson(): Lesson {
  const id = new URLSearchParams(location.search).get('lesson');
  const all = allLessons();
  // 省いたときは private の授業があればそれ、なければ見本
  return all.find((l) => l.id === id) ?? (builtinLessons.length > 2 ? builtinLessons[builtinLessons.length - 1] : demo);
}
