// 授業を選ぶ。URL の ?lesson=<id> で切り替える。省くと見本。
// src/lessons/private/*.ts（リポジトリに入れない）に置いた授業も、ここで自動で読む。
import type { Lesson } from '../engine/types';
import { demo } from './demo';
import { parts } from './parts';

const privateModules = import.meta.glob<{ default: Lesson }>('./private/*.ts', { eager: true });

export const lessons: Lesson[] = [demo, parts, ...Object.values(privateModules).map((m) => m.default)];

export function pickLesson(): Lesson {
  const id = new URLSearchParams(location.search).get('lesson');
  // 省いたときは private の授業があればそれ、なければ見本
  return lessons.find((l) => l.id === id) ?? (lessons.length > 2 ? lessons[lessons.length - 1] : demo);
}
