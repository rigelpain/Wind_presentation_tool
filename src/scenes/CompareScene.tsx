// 場面「compare」: 2枚を並べる（side）・前後を切り替える（toggle）・2枚を交互に映す（flicker）。
// 座標は 1920×1080。画像の領域は、ワイプが出ているあいだは上から 720px まで
// （side の大きくする方だけ 1016px まで）。
import type { SceneKind, SceneViewProps } from '../engine/registry';
import { useNow } from '../engine/store';
import type { EffectKind } from '../engine/types';
import { useSnapshots } from '../media/snapshots';
import { trackOf } from '../wipe/WipeLayer';
import { MediaView } from './basic';
import './CompareScene.css';

type Side = 'both' | 'left' | 'right';

interface CompareItem {
  /** public/ からのパス */
  src?: string;
  /** 写真の読み込み（U）で入れた写真の枠 */
  slot?: string;
  /** カメラを隠す前・後の静止画 */
  snapshot?: 'before' | 'after';
  /** snapshot のとき、誰の切り出しか。既定 'full'（カメラ全体） */
  role?: 'host' | 'guest' | 'full';
  caption?: string;
}

interface CompareProps {
  heading?: string;
  left: CompareItem;
  right: CompareItem;
  /** 左右の札 */
  labels?: [string, string];
  /** 既定 'side' */
  mode?: 'side' | 'toggle' | 'flicker';
  /** side の段階ごとの見せ方。既定 ['both'] */
  steps?: Side[];
  /** flicker で1枚を映す時間。既定 800 */
  flickerMs?: number;
  /** flicker の黒の時間。既定 250 */
  gapMs?: number;
}

const W = 1920;
const MARGIN_X = 96;
const GAP = 48;
const INNER = W - MARGIN_X * 2; // 1728
const HALF = (INNER - GAP) / 2; // 840
const BIG = Math.round(INNER * 0.7); // 1210
const SMALL = Math.round(INNER * 0.25); // 432
const WIPE_LIMIT = 720; // ワイプが出ているときの画像の下端
const FREE_BOTTOM = 1016; // ワイプを隠したとき（下の余白 64px）
const FLICKER_MIN_MS = 300;
const GAP_MIN_MS = 80;

interface Span {
  x: number;
  w: number;
}

function sidePlacement(s: Side): [Span, Span] {
  if (s === 'left') return [{ x: MARGIN_X, w: BIG }, { x: W - MARGIN_X - SMALL, w: SMALL }];
  if (s === 'right') return [{ x: MARGIN_X, w: SMALL }, { x: W - MARGIN_X - BIG, w: BIG }];
  return [{ x: MARGIN_X, w: HALF }, { x: MARGIN_X + HALF + GAP, w: HALF }];
}

/** flicker の経過時間から、今どれを出すか。左 → 黒 → 右 → 黒 を繰り返す。経過が負（描き直しの遅れ）は 0 とみなす。 */
export function flickerPhase(elapsedMs: number, flickerMs: number, gapMs: number): 'left' | 'right' | 'black' {
  const f = Math.max(flickerMs, FLICKER_MIN_MS);
  const g = Math.max(gapMs, GAP_MIN_MS);
  const cycle = 2 * (f + g);
  const t = Math.max(0, elapsedMs) % cycle;
  if (t < f) return 'left';
  if (t < f + g) return 'black';
  if (t < 2 * f + g) return 'right';
  return 'black';
}

/** 画像（または静止画）。画像の領域いっぱいに、縮めて収める。 */
function Picture({ item, swapped }: { item: CompareItem; swapped: boolean }) {
  const snaps = useSnapshots();
  if (item.snapshot) {
    const snap = item.snapshot === 'before' ? snaps.before : snaps.after;
    const role = item.role ?? 'full';
    const url = snap && (role === 'full' ? snap.full : snap[trackOf(role, swapped)]);
    return (
      <div className="compare__pic">
        {url ? (
          <img className="compare__img" src={url} alt={item.caption ?? ''} />
        ) : (
          <div className="compare__empty">静止画がまだありません（カメラを隠して戻すと自動で撮ります）</div>
        )}
      </div>
    );
  }
  return (
    <div className="compare__pic">
      <MediaView item={{ src: item.src, slot: item.slot, fit: 'contain' }} />
    </div>
  );
}

/** 札・画像・説明を縦に並べた1枚分 */
function Cell({
  item,
  label,
  swapped,
  style,
  off,
}: {
  item: CompareItem;
  label?: string;
  swapped: boolean;
  style: { left: number; top: number; width: number; height: number };
  off?: boolean;
}) {
  return (
    <div className={`compare__cell${off ? ' compare__cell--off' : ''}`} style={style}>
      {label && <div className="compare__label">{label}</div>}
      <div className="compare__box">
        <Picture item={item} swapped={swapped} />
      </div>
      {item.caption && <div className="compare__caption">{item.caption}</div>}
    </div>
  );
}

/** flicker: 段階 0 は左を止めて出す。段階 1 以上は stepAt からの経過で左・黒・右を決める。 */
function Flicker({ props, step, stepAt, swapped }: { props: CompareProps; step: number; stepAt: number; swapped: boolean }) {
  const now = useNow(30);
  const phase = step > 0 ? flickerPhase(now - stepAt, props.flickerMs ?? 800, props.gapMs ?? 250) : 'left';
  const item = phase === 'right' ? props.right : props.left;
  const label = phase === 'right' ? props.labels?.[1] : props.labels?.[0];
  return (
    <div className="compare__flicker">
      {phase !== 'black' && (
        <div className="compare__full">
          <Picture item={item} swapped={swapped} />
          {label && <div className="compare__tag">{label}</div>}
        </div>
      )}
    </div>
  );
}

function CompareView({ props, step, stepAt, state }: SceneViewProps<CompareProps>) {
  const mode = props.mode ?? 'side';
  const swapped = state.wipe.swapped;
  if (mode === 'flicker') {
    return <Flicker props={props} step={step} stepAt={stepAt} swapped={swapped} />;
  }

  const top = props.heading ? 200 : 80;
  const wipeVisible = state.wipe.mode !== 'hidden';
  // 下端。大きくする方（big）は、ワイプが出ていても 1016px まで使ってよい（指示書 4節の改め）
  const bottomFor = (big: boolean) => (big || !wipeVisible ? FREE_BOTTOM : WIPE_LIMIT);
  const heading = props.heading ? <h2 className="compare__heading">{props.heading}</h2> : null;
  const [labelL, labelR] = props.labels ?? [];

  if (mode === 'toggle') {
    const active = Math.min(step, 1);
    const span = { left: MARGIN_X, width: INNER, top, height: bottomFor(false) - top };
    return (
      <div className="compare">
        {heading}
        <Cell item={props.left} label={labelL} swapped={swapped} style={span} off={active !== 0} />
        <Cell item={props.right} label={labelR} swapped={swapped} style={span} off={active !== 1} />
      </div>
    );
  }

  const list: Side[] = props.steps?.length ? props.steps : ['both'];
  const plan = list[Math.min(step, list.length - 1)];
  const [l, r] = sidePlacement(plan);
  return (
    <div className="compare">
      {heading}
      <Cell
        item={props.left}
        label={labelL}
        swapped={swapped}
        style={{ left: l.x, width: l.w, top, height: bottomFor(plan === 'left') - top }}
      />
      <Cell
        item={props.right}
        label={labelR}
        swapped={swapped}
        style={{ left: r.x, width: r.w, top, height: bottomFor(plan === 'right') - top }}
      />
    </div>
  );
}

export const CompareScene: SceneKind<CompareProps> = {
  component: CompareView,
  steps: (p) => {
    if ((p.mode ?? 'side') !== 'side') return [[], []];
    const list: Side[] = p.steps?.length ? p.steps : ['both'];
    return list.map((): EffectKind[] => []);
  },
};
