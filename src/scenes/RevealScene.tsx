// 場面「reveal」。作業員が仕上げる（指示書: docs/briefs/）。
import type { SceneKind, SceneViewProps } from '../engine/registry';

function View({ scene }: SceneViewProps) {
  return <div className="scene"><p className="hint-big">（未実装: {scene.kind}）</p></div>;
}

export const RevealScene: SceneKind = { component: View };
