// 状態の変え方。演出の記録（種明かし用）もここで一緒に行う。
import { DEFAULT_SETTINGS, effectiveLesson, orderedScenes } from './lesson';
import { boardCellsOf, stepsOf } from './registry';
import type { Action, BoardState, EffectKind, Lesson, MusicState, Scene, ShowSettings, ShowState, WipeMode } from './types';

export const DEFAULT_MUSIC: MusicState = {
  trackId: null,
  playing: false,
  startedAt: 0,
  offsetSec: 0,
  volume: 0.6,
  loop: true,
  fadeMs: 1500,
  output: 'display',
};

/** いまの曲の位置（秒） */
export function musicPosition(m: MusicState, now = Date.now()): number {
  return m.playing ? m.offsetSec + Math.max(0, now - m.startedAt) / 1000 : m.offsetSec;
}

export function initialState(base: Lesson, settings: ShowSettings = DEFAULT_SETTINGS): ShowState {
  const lesson = effectiveLesson(base, settings);
  const first = lesson.scenes[0];
  return {
    lessonId: lesson.id,
    sceneIndex: 0,
    step: 0,
    stepAt: Date.now(),
    replay: 0,
    startedAt: null,
    wipe: {
      mode: first?.wipe ?? 'both',
      hiddenSince: first?.wipe === 'hidden' ? Date.now() : null,
      swapped: false,
      mirror: false,
      showLabels: true,
    },
    blackout: false,
    effects: [],
    openLoops: [],
    boards: {},
    sceneData: {},
    settings,
    music: DEFAULT_MUSIC,
    rev: 0,
  };
}

function log(s: ShowState, kinds: EffectKind[], now: number, lesson: Lesson): ShowState {
  if (kinds.length === 0 || s.startedAt === null) return s;
  const sceneId = lesson.scenes[s.sceneIndex]?.id ?? '';
  return { ...s, effects: [...s.effects, ...kinds.map((kind) => ({ kind, at: now, sceneId }))] };
}

function setWipe(s: ShowState, mode: WipeMode, now: number, lesson: Lesson): ShowState {
  if (s.wipe.mode === mode) return s;
  const next: ShowState = {
    ...s,
    wipe: { ...s.wipe, mode, hiddenSince: mode === 'hidden' ? now : null },
  };
  const kinds: EffectKind[] = mode === 'hidden' ? ['camera-hide'] : ['wipe-move'];
  if (mode === 'explain') kinds.push('face-zoom');
  return log(next, kinds, now, lesson);
}

function enterScene(s: ShowState, lesson: Lesson, index: number, now: number, atEnd: boolean): ShowState {
  const scene = lesson.scenes[index];
  if (!scene) return s;
  const steps = stepsOf(scene);
  let next: ShowState = {
    ...s,
    sceneIndex: index,
    step: atEnd ? steps.length - 1 : 0,
    // 切り替えの演出があるときは、それが終わった時刻を段階の始まりにする（時間で動く部品が切り替えの最中に始まらないように）
    stepAt: !atEnd && scene.transition && scene.transition !== 'cut' ? now + s.settings.transitionMs : now,
    replay: 0,
    blackout: false,
  };
  if (atEnd) {
    // 戻るときは演出を記録しない
    if (scene.wipe) next = { ...next, wipe: { ...next.wipe, mode: scene.wipe, hiddenSince: scene.wipe === 'hidden' ? (s.wipe.hiddenSince ?? now) : null } };
    return next;
  }
  const kinds: EffectKind[] = [];
  if (scene.transition === 'black') kinds.push('blackout');
  if (scene.transition === 'slide') kinds.push('scene-move');
  next = log(next, kinds, now, lesson);
  next = { ...next, music: musicCue(next.music, scene, now) };
  if (scene.wipe) next = setWipe(next, scene.wipe, now, lesson);
  if (scene.opensLoop && !next.openLoops.some((l) => l.id === scene.opensLoop!.id)) {
    next = { ...next, openLoops: [...next.openLoops, { ...scene.opensLoop, openedAt: now }] };
    next = log(next, ['loop-open'], now, lesson);
  }
  if (scene.closesLoop && next.openLoops.some((l) => l.id === scene.closesLoop)) {
    next = { ...next, openLoops: next.openLoops.filter((l) => l.id !== scene.closesLoop) };
    next = log(next, ['loop-close'], now, lesson);
  }
  next = log(next, steps[0] ?? [], now, lesson);
  return next;
}

/** 場面に入ったときの音楽 */
function musicCue(m: MusicState, scene: Scene, now: number): MusicState {
  if (!scene.music) return m;
  if (scene.music === 'stop') return m.playing ? { ...m, playing: false, offsetSec: musicPosition(m, now) } : m;
  if (m.trackId === scene.music && m.playing) return m;
  return { ...m, trackId: scene.music, playing: true, startedAt: now, offsetSec: 0 };
}

/** 設定が変わっても、いま映している場面（と段階）はそのままにする */
function withSettings(s: ShowState, base: Lesson, settings: ShowSettings): ShowState {
  const before = effectiveLesson(base, s.settings);
  const currentId = before.scenes[s.sceneIndex]?.id;
  const after = effectiveLesson(base, settings);
  let index = after.scenes.findIndex((sc) => sc.id === currentId);
  let step = s.step;
  if (index < 0) {
    // いまの場面を飛ばすことにしたら、並びの上でその次の場面へ
    const full = orderedScenes(base, settings);
    const pos = full.findIndex((o) => o.scene.id === currentId);
    const nextOne = full.slice(pos + 1).find((o) => !o.skipped) ?? [...full].reverse().find((o) => !o.skipped);
    index = nextOne ? nextOne.index : 0;
    step = 0;
  }
  return { ...s, settings, sceneIndex: Math.max(0, index), step };
}

function board(s: ShowState, sceneId: string, cells: number): BoardState {
  const b = s.boards[sceneId];
  if (b && b.values.length === cells) return b;
  return { values: Array.from({ length: cells }, (_, i) => b?.values[i] ?? null), marks: b?.marks ?? [], cursor: b?.cursor ?? 0, draft: '' };
}

function boardKey(b: BoardState, key: string, cells: number): BoardState {
  if (/^[0-9]$/.test(key)) return { ...b, draft: (b.draft + key).slice(0, 4) };
  if (key === 'Backspace') {
    if (b.draft) return { ...b, draft: b.draft.slice(0, -1) };
    const values = [...b.values];
    values[b.cursor] = null;
    return { ...b, values };
  }
  if (key === 'Enter') {
    const values = [...b.values];
    if (b.draft) values[b.cursor] = Number(b.draft);
    return { ...b, values, draft: '', cursor: (b.cursor + 1) % cells };
  }
  if (key === 'ArrowDown') return { ...b, draft: '', cursor: (b.cursor + 1) % cells };
  if (key === 'ArrowUp') return { ...b, draft: '', cursor: (b.cursor - 1 + cells) % cells };
  if (key === '*') {
    const marks = b.marks.includes(b.cursor) ? b.marks.filter((m) => m !== b.cursor) : [...b.marks, b.cursor];
    return { ...b, marks };
  }
  return b;
}

/** 予告を出す場面の最後の段階に来たら、予告を出したと記録する */
function withTeaser(prev: ShowState, next: ShowState, lesson: Lesson, now: number): ShowState {
  if (next === prev || (next.sceneIndex === prev.sceneIndex && next.step === prev.step)) return next;
  const scene = lesson.scenes[next.sceneIndex];
  if (!scene?.teaser || !lesson.scenes[next.sceneIndex + 1]) return next;
  if (next.step !== stepsOf(scene).length - 1) return next;
  return log(next, ['teaser'], now, lesson);
}

export function reduce(s: ShowState, action: Action, base: Lesson): ShowState {
  const now = Date.now();
  const lesson = effectiveLesson(base, s.settings);
  const r = reduceInner(s, action, base, lesson, now);
  return action.type === 'next' || action.type === 'goto' ? withTeaser(s, r, lesson, now) : r;
}

function reduceInner(s: ShowState, action: Action, base: Lesson, lesson: Lesson, now: number): ShowState {
  const scene = lesson.scenes[s.sceneIndex];
  const steps = scene ? stepsOf(scene) : [[]];

  switch (action.type) {
    case 'next': {
      let base = s;
      if (base.startedAt === null) base = { ...base, startedAt: now };
      if (base.step < steps.length - 1) {
        const step = base.step + 1;
        return log({ ...base, step, stepAt: now, replay: 0, blackout: false }, steps[step] ?? [], now, lesson);
      }
      if (base.sceneIndex >= lesson.scenes.length - 1) return base;
      return enterScene(base, lesson, base.sceneIndex + 1, now, false);
    }
    case 'prev': {
      if (s.step > 0) return { ...s, step: s.step - 1, stepAt: now, replay: 0, blackout: false };
      if (s.sceneIndex === 0) return s;
      return enterScene(s, lesson, s.sceneIndex - 1, now, true);
    }
    case 'goto': {
      if (action.index < 0 || action.index >= lesson.scenes.length) return s;
      return enterScene(s, lesson, action.index, now, false);
    }
    case 'replay': {
      // 同じ step をやり直す。step に紐づく演出をもう一度数える
      return log({ ...s, replay: s.replay + 1, stepAt: now }, steps[s.step] ?? [], now, lesson);
    }
    case 'start':
      return { ...s, startedAt: s.startedAt ?? now };
    case 'reset': {
      // 進み具合と記録だけを消す。並び・設定・カメラの向きは残す
      const fresh = initialState(base, s.settings);
      return {
        ...fresh,
        wipe: { ...fresh.wipe, swapped: s.wipe.swapped, mirror: s.wipe.mirror, showLabels: s.wipe.showLabels },
        music: { ...s.music, playing: false, offsetSec: 0 },
      };
    }
    case 'wipe':
      return setWipe(s, action.mode, now, lesson);
    case 'toggle-explain':
      return setWipe(s, s.wipe.mode === 'explain' ? 'both' : 'explain', now, lesson);
    case 'toggle-hidden':
      return setWipe(s, s.wipe.mode === 'hidden' ? 'both' : 'hidden', now, lesson);
    case 'swap':
      return { ...s, wipe: { ...s.wipe, swapped: !s.wipe.swapped } };
    case 'mirror':
      return { ...s, wipe: { ...s.wipe, mirror: !s.wipe.mirror } };
    case 'labels':
      return { ...s, wipe: { ...s.wipe, showLabels: !s.wipe.showLabels } };
    case 'blackout':
      return { ...s, blackout: !s.blackout };
    case 'effect':
      return log(s, [action.kind], now, lesson);
    case 'board-key':
    case 'board-cursor': {
      if (!scene) return s;
      const cells = boardCellsOf(scene);
      if (cells === 0) return s;
      const b = board(s, scene.id, cells);
      const nb = action.type === 'board-key' ? boardKey(b, action.key, cells) : { ...b, draft: '', cursor: Math.max(0, Math.min(cells - 1, action.index)) };
      return { ...s, boards: { ...s.boards, [scene.id]: nb } };
    }
    case 'scene-data':
      return { ...s, sceneData: { ...s.sceneData, [action.sceneId]: action.value } };
    case 'settings':
      return withSettings(s, base, { ...s.settings, ...action.patch });
    case 'scene-override': {
      const cur = { ...(s.settings.overrides[action.sceneId] ?? {}), ...action.patch };
      for (const k of Object.keys(cur) as (keyof typeof cur)[]) if (cur[k] === undefined) delete cur[k];
      const overrides = { ...s.settings.overrides, [action.sceneId]: cur };
      if (Object.keys(cur).length === 0) delete overrides[action.sceneId];
      return withSettings(s, base, { ...s.settings, overrides });
    }
    case 'music-play': {
      const m = s.music;
      const id = action.trackId ?? m.trackId;
      if (!id) return s;
      if (id !== m.trackId) return { ...s, music: { ...m, trackId: id, playing: true, startedAt: now, offsetSec: 0 } };
      if (m.playing) return s;
      return { ...s, music: { ...m, playing: true, startedAt: now } };
    }
    case 'music-pause':
      return s.music.playing ? { ...s, music: { ...s.music, playing: false, offsetSec: musicPosition(s.music, now) } } : s;
    case 'music-stop':
      return { ...s, music: { ...s.music, playing: false, offsetSec: 0 } };
    case 'music-seek':
      return { ...s, music: { ...s.music, offsetSec: Math.max(0, action.sec), startedAt: now } };
    case 'music-set':
      return { ...s, music: { ...s.music, ...action.patch } };
  }
}

export function boardOf(s: ShowState, sceneId: string, cells: number): BoardState {
  return board(s, sceneId, cells);
}
