// アイキャッチ: セクションの区切りに挟む題のスライド。暗い地に、セクションの番号と題を大きく。
import type { SceneKind, SceneViewProps } from '../engine/registry';
import { rich } from './basic';
import './EyecatchScene.css';

interface EyecatchProps {
  title: string;
  /** セクションの番号（構成の流れから自動で入る） */
  num?: number;
  /** 番号の代わりに出す一言（なくてよい） */
  kicker?: string;
  subtitle?: string;
}

function EyecatchView({ props }: SceneViewProps<EyecatchProps>) {
  return (
    <div className="scene eyecatch">
      <div className="eyecatch__kicker">{props.kicker || (props.num ? `Section ${props.num}` : '')}</div>
      <h1 className="eyecatch__title">{rich(props.title ?? '')}</h1>
      {props.subtitle && <p className="eyecatch__sub">{rich(props.subtitle)}</p>}
    </div>
  );
}

export const EyecatchScene: SceneKind<EyecatchProps> = {
  component: EyecatchView,
  // 区切りを見せる（進み具合）
  steps: () => [['unlock']],
};
