// 状態の変え方。演出の記録（種明かし用）もここで一緒に行う。
import { boardCellsOf, stepsOf } from './registry';
import type { Action, BoardState, EffectKind, Lesson, ShowState, WipeMode } from './types';

export function initialState(lesson: Lesson): ShowState {
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
    stepAt: now,
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
  next = log(next, kinds, now, lesson);
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

export function reduce(s: ShowState, action: Action, lesson: Lesson): ShowState {
  const now = Date.now();
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
    case 'reset':
      return { ...initialState(lesson), wipe: { ...initialState(lesson).wipe, swapped: s.wipe.swapped, mirror: s.wipe.mirror, showLabels: s.wipe.showLabels } };
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
  }
}

export function boardOf(s: ShowState, sceneId: string, cells: number): BoardState {
  return board(s, sceneId, cells);
}
