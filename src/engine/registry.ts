// 場面の部品の登録簿。reducer は部品そのものを読まず、step の数と演出だけをここから引く。
import type { ComponentType } from 'react';
import type { Action, EffectKind, Lesson, Scene, ShowState } from './types';

export interface SceneViewProps<P = Record<string, unknown>> {
  scene: Scene;
  props: P;
  step: number;
  stepAt: number;
  replay: number;
  state: ShowState;
  lesson: Lesson;
  dispatch: (action: Action) => void;
}

export interface SceneKind<P = any> {
  component: ComponentType<SceneViewProps<P>>;
  /**
   * step ごとに、その step に入ったとき記録する演出。
   * 長さが step の数。[0] は場面に入ったとき。省くと step は1つ・演出なし。
   */
  steps?: (props: P) => EffectKind[][];
  /** 数のボードの場面なら、セルの数（数字キーを受け取る） */
  boardCells?: (props: P) => number;
}

const kinds = new Map<string, SceneKind>();

export function registerKind(name: string, kind: SceneKind): void {
  kinds.set(name, kind);
}

export function getKind(name: string): SceneKind | undefined {
  return kinds.get(name);
}

export function stepsOf(scene: Scene): EffectKind[][] {
  const kind = kinds.get(scene.kind);
  const steps = kind?.steps?.(scene.props ?? {}) ?? [[]];
  return steps.length > 0 ? steps : [[]];
}

export function boardCellsOf(scene: Scene): number {
  const kind = kinds.get(scene.kind);
  return kind?.boardCells?.(scene.props ?? {}) ?? 0;
}
