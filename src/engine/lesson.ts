// コントロール画面の設定（並び・飛ばす場面・場面ごとの上書き）を、授業のデータに当てる。
// 授業のデータそのものは変えない。設定は状態に持つので、リロードしても残る。
import type { Lesson, Scene, ShowSettings } from './types';

export const DEFAULT_SETTINGS: ShowSettings = {
  order: null,
  skipped: [],
  overrides: {},
  defaultTransition: 'cut',
  transitionMs: 500,
  durationMin: null,
  stageClock: 'none',
  wipeScale: 1,
  wipeZoom: 1,
  roleLabels: {},
  labelScale: 1,
  labelColors: {},
  captions: { enabled: false, size: 52, position: 'bottom', lines: 2, holdSec: 4, color: '#FFFFFF', bg: '#141414', box: null },
};

/** 設定の並びを、授業のデータの場面に合わせる（消えた場面を外し、新しい場面を後ろに足す） */
export function orderedIds(base: Lesson, settings: ShowSettings): string[] {
  const all = base.scenes.map((s) => s.id);
  if (!settings.order) return all;
  const known = new Set(all);
  const ordered = settings.order.filter((id) => known.has(id));
  const seen = new Set(ordered);
  return [...ordered, ...all.filter((id) => !seen.has(id))];
}

/** 上書きを当てた場面 */
export function applyOverride(scene: Scene, settings: ShowSettings): Scene {
  const o = settings.overrides[scene.id] ?? {};
  return {
    ...scene,
    transition: o.transition ?? scene.transition ?? settings.defaultTransition,
    wipe: o.wipe ?? scene.wipe,
    music: o.music ? o.music : scene.music,
  };
}

export interface OrderedScene {
  scene: Scene;
  skipped: boolean;
  /** 実際に進む順での番号。飛ばす場面は -1 */
  index: number;
}

const fullCache = new WeakMap<ShowSettings, Map<Lesson, OrderedScene[]>>();
const effCache = new WeakMap<ShowSettings, Map<Lesson, Lesson>>();

/** 飛ばす場面も含めた並び（コントロール画面の一覧用） */
export function orderedScenes(base: Lesson, settings: ShowSettings): OrderedScene[] {
  const hit = fullCache.get(settings)?.get(base);
  if (hit) return hit;
  const byId = new Map(base.scenes.map((s) => [s.id, s]));
  const skipped = new Set(settings.skipped);
  let i = 0;
  const list = orderedIds(base, settings).map((id) => {
    const scene = applyOverride(byId.get(id)!, settings);
    const sk = skipped.has(id);
    return { scene, skipped: sk, index: sk ? -1 : i++ };
  });
  if (!fullCache.has(settings)) fullCache.set(settings, new Map());
  fullCache.get(settings)!.set(base, list);
  return list;
}

/** 実際に進む授業（並び替え・飛ばし・上書きを当てたもの） */
export function effectiveLesson(base: Lesson, settings: ShowSettings): Lesson {
  const hit = effCache.get(settings)?.get(base);
  if (hit) return hit;
  let scenes = orderedScenes(base, settings)
    .filter((o) => !o.skipped)
    .map((o) => o.scene);
  // 全部飛ばしたときは、最初の場面だけ残す（画面が空にならないように）
  if (scenes.length === 0 && base.scenes[0]) scenes = [applyOverride(base.scenes[0], settings)];
  const names = settings.roleLabels ?? {};
  const lesson: Lesson = {
    ...base,
    durationMin: settings.durationMin ?? base.durationMin,
    roleLabels: { host: names.host?.trim() || base.roleLabels.host, guest: names.guest?.trim() || base.roleLabels.guest },
    scenes,
  };
  if (!effCache.has(settings)) effCache.set(settings, new Map());
  effCache.get(settings)!.set(base, lesson);
  return lesson;
}
