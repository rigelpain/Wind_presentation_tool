// 構成（話のタネ → 枝 → 流れ）と、スライドの並びを結ぶ。
// 決まり: 流れ（board.flow）に並べたカードが、その順でスライド（lesson.scenes）になる。いつもこの形にそろえる（normalize）。
// 流れから外したカードのスライドは消さずに、カードにしまっておく（stash）。流れに戻すと元に戻る。
import type { Board, BoardEdge, BoardNode, BoardNodeKind, Lesson, Scene } from '../engine/types';
import { newSceneId } from '../lessons/userLessons';

const rid = (head: string) => `${head}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const newNodeId = () => rid('n-');
export const newEdgeId = () => rid('e-');

export const NODE_W = 220;
export const GAP_X = 70;
export const GAP_Y = 22;
export const NODE_H = 56;

export const KIND_INFO: Record<BoardNodeKind, { label: string; color: string }> = {
  section: { label: 'セクション', color: '#E8452C' },
  page: { label: 'ページ', color: '#8A8577' },
};

/** 前の版の種類（タネ・ことば・問い・メモ）は、ページとして読む */
export function nodeKind(n: BoardNode): BoardNodeKind {
  return n.kind === 'section' ? 'section' : 'page';
}

/** 流れに入れたとき、スライドができるカードか */
export function makesSlide(n: BoardNode): boolean {
  return nodeKind(n) === 'page' || n.sectionMode === 'eyecatch';
}

/** 構成がなければ、いまのスライドから作る（スライドを縦に並べ、そのまま流れにする） */
export function ensureBoard(lesson: Lesson): Lesson {
  if (lesson.board) return lesson;
  const nodes: BoardNode[] = lesson.scenes.map((s, i) => ({
    id: newNodeId(),
    x: 0,
    y: i * (NODE_H + 60),
    text: s.title,
    kind: 'page',
    sceneId: s.id,
  }));
  return { ...lesson, board: { nodes, edges: [], flow: nodes.map((n) => n.id) } };
}

export function childrenOf(board: Board, id: string): BoardNode[] {
  const ids = board.edges.filter((e) => e.from === id).map((e) => e.to);
  return board.nodes.filter((n) => ids.includes(n.id)).sort((a, b) => a.y - b.y);
}

export function parentOf(board: Board, id: string): BoardNode | undefined {
  const e = board.edges.find((x) => x.to === id);
  return e ? board.nodes.find((n) => n.id === e.from) : undefined;
}

/** 子・孫をすべて */
export function descendantsOf(board: Board, id: string): string[] {
  const out: string[] = [];
  const walk = (x: string) => {
    for (const c of childrenOf(board, x)) {
      if (out.includes(c.id)) continue;
      out.push(c.id);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

/** カードからスライドを作る。セクションはアイキャッチ。ページはカードの言葉が見出し、子のカードが本文の行になる */
export function sceneFromNode(board: Board, node: BoardNode): Scene {
  const kids = childrenOf(board, node.id)
    .map((c) => c.text.trim())
    .filter(Boolean);
  const text = node.text.trim() || '（無題）';
  if (nodeKind(node) === 'section') {
    return { id: newSceneId(), kind: 'eyecatch', title: text, transition: 'black', props: { title: text, num: 1 } };
  }
  if (kids.length === 0) {
    return { id: newSceneId(), kind: 'text', title: text, props: { lines: [text], align: 'center', size: 'xl' } };
  }
  return { id: newSceneId(), kind: 'text', title: text, props: { heading: text, lines: kids, build: true, align: 'left', size: 'l' } };
}

/**
 * 流れとスライドをそろえる。
 * - 流れのカードにスライドがなければ作る（しまってあれば戻す）
 * - 流れにないカードのスライドは、カードにしまう
 * - どのカードにも結ばれていないスライドは、カードを作って流れの最後に足す（スライドを失わないため）
 * - スライドの並びを流れの順にする
 */
export function normalize(lesson: Lesson): Lesson {
  const withBoard = ensureBoard(lesson);
  let board = withBoard.board!;
  const sceneById = new Map(withBoard.scenes.map((s) => [s.id, s]));

  // どのカードにも結ばれていないスライドを拾う
  const linked = new Set(board.nodes.map((n) => n.sceneId).filter(Boolean));
  const orphans = withBoard.scenes.filter((s) => !linked.has(s.id));
  if (orphans.length) {
    const bottom = board.nodes.reduce((m, n) => Math.max(m, n.y), -NODE_H - 60);
    const extra = orphans.map((s, i) => ({ id: newNodeId(), x: 0, y: bottom + (i + 1) * (NODE_H + 60), text: s.title, kind: 'page' as const, sceneId: s.id }));
    board = { ...board, nodes: [...board.nodes, ...extra], flow: [...board.flow, ...extra.map((n) => n.id)] };
  }

  const exists = new Set(board.nodes.map((n) => n.id));
  const flow = board.flow.filter((id, i, arr) => exists.has(id) && arr.indexOf(id) === i);
  const inFlow = new Set(flow);
  // スライドの種類が、カードの種類と合わないもの（ページ ↔ セクション を切り替えた）は作り直す
  const fits = (n: BoardNode, s: Scene | undefined) => !!s && (nodeKind(n) === 'section') === (s.kind === 'eyecatch');
  const nodes = board.nodes.map((n0) => {
    const n: BoardNode = n0.kind === 'section' || n0.kind === 'page' ? n0 : { ...n0, kind: 'page' };
    if (inFlow.has(n.id) && makesSlide(n)) {
      let scene = (n.sceneId ? sceneById.get(n.sceneId) : undefined) ?? n.stash;
      if (!fits(n, scene)) scene = sceneFromNode(board, n);
      sceneById.set(scene!.id, scene!);
      return { ...n, sceneId: scene!.id, stash: undefined };
    }
    const scene = n.sceneId ? sceneById.get(n.sceneId) : undefined;
    return scene ? { ...n, stash: scene } : n;
  });
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  // セクションの番号（流れの中で何番目のセクションか）を、アイキャッチに入れる
  let sectionNo = 0;
  const scenes: Scene[] = [];
  for (const id of flow) {
    const n = nodeById.get(id)!;
    if (nodeKind(n) === 'section') sectionNo++;
    if (!makesSlide(n)) continue;
    const s = sceneById.get(n.sceneId!);
    if (!s) continue;
    scenes.push(s.kind === 'eyecatch' && s.props?.num !== sectionNo ? { ...s, props: { ...s.props, num: sectionNo } } : s);
  }
  // 流れが空だと表示画面が空になるので、そのときは最初のスライドを残す
  const finalScenes = scenes.length > 0 ? scenes : withBoard.scenes.slice(0, 1);
  return { ...withBoard, scenes: finalScenes, board: { ...board, nodes, flow } };
}

/** 新しいカードの置き場所: 親の右、いちばん下の子の下 */
export function childPosition(board: Board, parent: BoardNode): { x: number; y: number } {
  const kids = childrenOf(board, parent.id);
  const last = kids[kids.length - 1];
  return { x: parent.x + NODE_W + GAP_X, y: last ? last.y + NODE_H + GAP_Y : parent.y };
}

export function addNode(board: Board, node: Partial<BoardNode> & { x: number; y: number }, parentId?: string, id: string = newNodeId()): { board: Board; id: string } {
  const n: BoardNode = { id, text: '', kind: parentId ? 'page' : 'section', sectionMode: parentId ? undefined : 'none', ...node };
  const edges: BoardEdge[] = parentId ? [...board.edges, { id: newEdgeId(), from: parentId, to: id }] : board.edges;
  return { board: { ...board, nodes: [...board.nodes, n], edges }, id };
}

export function removeNodes(board: Board, ids: string[]): Board {
  const gone = new Set(ids);
  return {
    nodes: board.nodes.filter((n) => !gone.has(n.id)),
    edges: board.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to)),
    flow: board.flow.filter((id) => !gone.has(id)),
  };
}

/** 木の形に整える。親の右に子を、子孫の高さに合わせて縦に並べる（根の位置は動かさない） */
export function tidy(board: Board, rootIds?: string[]): Board {
  const hasParent = new Set(board.edges.map((e) => e.to));
  const roots = rootIds ?? board.nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id);
  const pos = new Map(board.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const seen = new Set<string>();
  const height = (id: string): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const node = board.nodes.find((n) => n.id === id);
    const kids = node?.collapsed ? [] : childrenOf(board, id);
    const h = kids.reduce((a, k) => a + height(k.id), 0) + Math.max(0, kids.length - 1) * GAP_Y;
    return Math.max(NODE_H, h);
  };
  const place = (id: string, x: number, top: number) => {
    const node = board.nodes.find((n) => n.id === id);
    const kids = node?.collapsed ? [] : childrenOf(board, id);
    const h = height(id);
    pos.set(id, { x, y: top + h / 2 - NODE_H / 2 });
    let y = top;
    for (const k of kids) {
      seen.delete(k.id);
      const kh = height(k.id);
      place(k.id, x + NODE_W + GAP_X, y);
      y += kh + GAP_Y;
    }
  };
  for (const r of roots) {
    const node = board.nodes.find((n) => n.id === r);
    if (!node) continue;
    seen.clear();
    const h = height(r);
    seen.clear();
    // 根は今の高さの真ん中に来るように
    place(r, node.x, node.y + NODE_H / 2 - h / 2);
    pos.set(r, { x: node.x, y: node.y });
  }
  return { ...board, nodes: board.nodes.map((n) => ({ ...n, ...pos.get(n.id)! })) };
}
