// 場面「board」。挙手の数やスコアを大きく出す。値・入力中・印はエンジン（reducer の board 状態）から読む。
// キーの受け取りと値の保存はエンジンがする。この部品は表示と、セルのクリックだけを作る。
import type { SceneKind, SceneViewProps } from '../engine/registry';
import { boardOf } from '../engine/reducer';
import './BoardScene.css';

export interface BoardProps {
  heading?: string;
  cells: { label: string }[];
  layout?: 'single' | 'grid';
  unit?: string;
  highlightTop?: boolean;
  markLabel?: string;
}

/** 確定した値のうち最大のセル（同点は全部）。値がなければ空。 */
export function topCells(values: (number | null)[]): Set<number> {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return new Set();
  const max = Math.max(...nums);
  return new Set(values.flatMap((v, i) => (v === max ? [i] : [])));
}

function BoardView({ scene, props, step, state, dispatch }: SceneViewProps<BoardProps>) {
  const n = props.cells.length;
  const layout = props.layout ?? (n === 1 ? 'single' : 'grid');
  const b = boardOf(state, scene.id, n);
  // 段階1（以上）で最大値を目立たせる
  const top = props.highlightTop && step >= 1 ? topCells(b.values) : null;

  return (
    <div className={`scene board board--${layout}`}>
      {props.heading && <div className="heading board__heading">{props.heading}</div>}
      <div className="board__cells">
        {props.cells.map((c, i) => {
          const isCursor = i === b.cursor;
          // 入力中のセルは draft があれば draft を出す。なければ確定した値
          const raw = isCursor && b.draft ? b.draft : b.values[i];
          const hasValue = raw !== null && raw !== undefined && raw !== '';
          const isTop = top?.has(i) ?? false;
          const isDim = top !== null && top.size > 0 && !isTop;
          const marked = b.marks.includes(i);
          const cls = ['board__cell', isCursor && 'is-cursor', isTop && 'is-top', isDim && 'is-dim']
            .filter(Boolean)
            .join(' ');
          return (
            <div key={i} className={cls} onClick={() => dispatch({ type: 'board-cursor', index: i })}>
              {marked && <div className="board__mark">{props.markLabel ?? '★'}</div>}
              <div className="board__label">{c.label}</div>
              <div className="board__value">
                {hasValue ? String(raw) : '—'}
                {hasValue && props.unit && <span className="board__unit">{props.unit}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const BoardScene: SceneKind<BoardProps> = {
  component: BoardView,
  boardCells: (p) => p.cells.length,
  steps: (p) => (p.highlightTop ? [[], ['reveal']] : [[]]),
};
