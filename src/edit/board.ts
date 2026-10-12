// 構成（話のタネ → 枝 → 流れ）と、スライドの並びを結ぶ。
// 木: セクションが親、ページが子。ページも子ページを持てる。
// 流れ: セクションの順に「セクション → そのセクションの中の流れ（pageFlow）」をつなぐ。セクションの流れが終わると次のセクションへ。
// その順でスライド（lesson.scenes）になる。いつもこの形にそろえる（normalize）。
// 流れから外したページのスライドは消さずに、カードにしまっておく（stash）。流れに戻すと元に戻る。
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

/** 構成がなければ、いまのスライドから作る（セクション「授業の流れ」の子に、スライドのページを順に並べる） */
export function ensureBoard(lesson: Lesson): Lesson {
  if (lesson.board) return lesson;
  const section: BoardNode = { id: newNodeId(), x: 0, y: 0, text: '授業の流れ', kind: 'section', sectionMode: 'none' };
  const pages: BoardNode[] = lesson.scenes.map((s, i) => ({
    id: newNodeId(),
    x: NODE_W + GAP_X,
    y: i * (NODE_H + GAP_Y),
    text: s.title,
    kind: 'page',
    sceneId: s.id,
  }));
  section.pageFlow = pages.map((p) => p.id);
  const edges: BoardEdge[] = pages.map((p) => ({ id: newEdgeId(), from: section.id, to: p.id }));
  return { ...lesson, board: { nodes: [section, ...pages], edges, sections: [section.id], flow: [] } };
}

/** いちばん上の親（根） */
export function rootOf(board: Board, id: string): string {
  const parent = new Map(board.edges.map((e) => [e.to, e.from]));
  let cur = id;
  const seen = new Set<string>();
  while (parent.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = parent.get(cur)!;
  }
  return cur;
}

/** ページの属するセクション（根がセクションなら、その id） */
export function sectionOf(board: Board, id: string): string | undefined {
  const root = rootOf(board, id);
  const n = board.nodes.find((x) => x.id === root);
  return n && nodeKind(n) === 'section' ? root : undefined;
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

/** 前の版（流れを1本で持っていた）の構成を、セクションごとの流れに移す */
function migrate(board: Board): Board {
  if (board.sections) return board;
  let nodes = board.nodes.map((n) => (n.kind === 'section' || n.kind === 'page' ? n : { ...n, kind: 'page' as const }));
  let edges = board.edges;
  const hasParent = new Set(edges.map((e) => e.to));
  let sections = board.flow.filter((id) => nodes.find((n) => n.id === id)?.kind === 'section' && !hasParent.has(id));
  const flowPages = board.flow.filter((id) => nodes.find((n) => n.id === id)?.kind === 'page');
  // 流れの最初のセクションより前にページがあるとき（セクションがないときも）は、それをまとめる「はじめ」のセクションを先頭に作る
  const firstSection = board.flow.findIndex((id) => sections.includes(id));
  const leading = (firstSection < 0 ? board.flow : board.flow.slice(0, firstSection)).some((id) => flowPages.includes(id));
  let cur: string | undefined;
  if (leading) {
    const sec: BoardNode = { id: newNodeId(), x: Math.min(...nodes.map((n) => n.x)) - NODE_W - GAP_X, y: Math.min(...nodes.map((n) => n.y)), text: sections.length ? 'はじめ' : '授業の流れ', kind: 'section', sectionMode: 'none' };
    nodes = [sec, ...nodes];
    sections = [sec.id, ...sections];
    cur = sec.id;
  }
  const flows = new Map<string, string[]>(sections.map((id) => [id, []]));
  for (const id of board.flow) {
    if (flows.has(id)) {
      cur = id;
      continue;
    }
    const n = nodes.find((x) => x.id === id);
    if (!n || n.kind !== 'page') continue;
    // そのページの根がセクションならそこへ。根がないページは、流れの上で直前のセクションの子にする
    const tmp: Board = { nodes, edges, flow: [] };
    let sec = sectionOf(tmp, id);
    if (!sec && cur) {
      const root = rootOf(tmp, id);
      edges = [...edges, { id: newEdgeId(), from: cur, to: root }];
      sec = cur;
    }
    if (sec) flows.set(sec, [...(flows.get(sec) ?? []), id]);
  }
  nodes = nodes.map((n) => (flows.has(n.id) ? { ...n, pageFlow: flows.get(n.id) } : n));
  return { ...board, nodes, edges, sections };
}

/**
 * 構成とスライドをそろえる。
 * - セクションの順と、各セクションの中の流れから、全体の流れを作る
 * - 流れのカードでスライドになるものにスライドがなければ作る（しまってあれば戻す）
 * - 流れにないカードのスライドは、カードにしまう
 * - どのカードにも結ばれていないスライドは、最後のセクションの子のページにして流れに足す（スライドを失わないため）
 * - スライドの並びを流れの順にする
 */
export function normalize(lesson: Lesson): Lesson {
  const withBoard = ensureBoard(lesson);
  let board = migrate(withBoard.board!);
  const sceneById = new Map(withBoard.scenes.map((s) => [s.id, s]));

  // 根になっているセクションの順（知らないセクションは、上から順に後ろへ足す）
  const hasParent = new Set(board.edges.map((e) => e.to));
  const rootSections = board.nodes.filter((n) => nodeKind(n) === 'section' && !hasParent.has(n.id));
  const known = new Set(rootSections.map((n) => n.id));
  let sections = (board.sections ?? []).filter((id, i, arr) => known.has(id) && arr.indexOf(id) === i);
  for (const n of [...rootSections].sort((a, b) => a.y - b.y || a.x - b.x)) if (!sections.includes(n.id)) sections.push(n.id);

  // どのカードにも結ばれていないスライドを拾う
  const linked = new Set(board.nodes.map((n) => n.sceneId).filter(Boolean));
  const orphans = withBoard.scenes.filter((s) => !linked.has(s.id));
  if (orphans.length) {
    let secId = sections[sections.length - 1];
    let nodes = board.nodes;
    let edges = board.edges;
    if (!secId) {
      const sec: BoardNode = { id: newNodeId(), x: 0, y: 0, text: '授業の流れ', kind: 'section', sectionMode: 'none', pageFlow: [] };
      nodes = [...nodes, sec];
      secId = sec.id;
      sections = [...sections, sec.id];
    }
    const sec = nodes.find((n) => n.id === secId)!;
    const bottom = nodes.reduce((m, n) => Math.max(m, n.y), sec.y);
    const extra: BoardNode[] = orphans.map((s, i) => ({ id: newNodeId(), x: sec.x + NODE_W + GAP_X, y: bottom + (i + 1) * (NODE_H + GAP_Y), text: s.title, kind: 'page', sceneId: s.id }));
    edges = [...edges, ...extra.map((p) => ({ id: newEdgeId(), from: secId, to: p.id }))];
    nodes = [...nodes, ...extra].map((n) => (n.id === secId ? { ...n, pageFlow: [...(n.pageFlow ?? []), ...extra.map((p) => p.id)] } : n));
    board = { ...board, nodes, edges };
  }

  // 各セクションの中の流れ: そのセクションの子孫のページだけ、重なりなく
  const used = new Set<string>();
  const sectionFlows = new Map<string, string[]>();
  for (const sid of sections) {
    const sec = board.nodes.find((n) => n.id === sid)!;
    const pf = (sec.pageFlow ?? []).filter((id) => {
      const n = board.nodes.find((x) => x.id === id);
      if (!n || nodeKind(n) !== 'page' || used.has(id) || sectionOf(board, id) !== sid) return false;
      used.add(id);
      return true;
    });
    sectionFlows.set(sid, pf);
  }
  const flow = sections.flatMap((sid) => [sid, ...sectionFlows.get(sid)!]);
  const inFlow = new Set(flow);

  // スライドの種類が、カードの種類と合わないもの（ページ ↔ セクション を切り替えた）は作り直す
  const fits = (n: BoardNode, sc: Scene | undefined) => !!sc && (nodeKind(n) === 'section') === (sc.kind === 'eyecatch');
  const nodes = board.nodes.map((n) => {
    const base = sectionFlows.has(n.id) ? { ...n, pageFlow: sectionFlows.get(n.id) } : n.pageFlow ? { ...n, pageFlow: undefined } : n;
    if (inFlow.has(n.id) && makesSlide(n)) {
      let scene = (n.sceneId ? sceneById.get(n.sceneId) : undefined) ?? n.stash;
      if (!fits(n, scene)) scene = sceneFromNode(board, n);
      sceneById.set(scene!.id, scene!);
      return { ...base, sceneId: scene!.id, stash: undefined };
    }
    const scene = n.sceneId ? sceneById.get(n.sceneId) : undefined;
    return scene ? { ...base, stash: scene } : base;
  });
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  // セクションの番号（流れの中で何番目のセクションか）を、アイキャッチに入れる
  let sectionNo = 0;
  const scenes: Scene[] = [];
  for (const id of flow) {
    const n = nodeById.get(id)!;
    if (nodeKind(n) === 'section') sectionNo++;
    if (!makesSlide(n)) continue;
    const sc = sceneById.get(n.sceneId!);
    if (!sc) continue;
    scenes.push(sc.kind === 'eyecatch' && sc.props?.num !== sectionNo ? { ...sc, props: { ...sc.props, num: sectionNo } } : sc);
  }
  // スライドが1枚もないと表示画面が空になるので、そのときは最初のスライドを残す
  const finalScenes = scenes.length > 0 ? scenes : withBoard.scenes.slice(0, 1);
  return { ...withBoard, scenes: finalScenes, board: { ...board, nodes, sections, flow } };
}

/** ページを、そのセクションの流れに入れる・外す */
export function togglePage(board: Board, pageId: string): Board {
  const sid = sectionOf(board, pageId);
  if (!sid) return board;
  return {
    ...board,
    nodes: board.nodes.map((n) => {
      if (n.id !== sid) return n;
      const pf = n.pageFlow ?? [];
      return { ...n, pageFlow: pf.includes(pageId) ? pf.filter((x) => x !== pageId) : [...pf, pageId] };
    }),
  };
}

/** セクションの順を変える（before の前へ。null なら最後へ） */
export function moveSection(board: Board, id: string, before: string | null): Board {
  const list = (board.sections ?? []).filter((x) => x !== id);
  const at = before ? list.indexOf(before) : -1;
  list.splice(at < 0 ? list.length : at, 0, id);
  return { ...board, sections: list };
}

/**
 * ページを流れの中で動かす。before のページの前へ（before がセクションなら、そのセクションの流れの先頭へ。null ならセクションの最後へ）。
 * 別のセクションへ動かすときは、そのセクションの子につなぎ直す
 */
export function movePage(board: Board, pageId: string, targetSection: string, before: string | null): Board {
  let edges = board.edges;
  if (sectionOf(board, pageId) !== targetSection) {
    edges = [...edges.filter((e) => e.to !== pageId), { id: newEdgeId(), from: targetSection, to: pageId }];
  }
  const nodes = board.nodes.map((n) => {
    if (nodeKind(n) !== 'section') return n;
    let pf = (n.pageFlow ?? []).filter((x) => x !== pageId);
    if (n.id === targetSection) {
      const at = before && before !== targetSection ? pf.indexOf(before) : before === targetSection ? 0 : -1;
      pf = [...pf];
      pf.splice(at < 0 ? pf.length : at, 0, pageId);
    }
    return { ...n, pageFlow: pf };
  });
  return { ...board, nodes, edges };
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

/** カードを消す。消したカードの子は、そのカードの親につなぎ直す（セクションの中に残るように） */
export function removeNodes(board: Board, ids: string[]): Board {
  const gone = new Set(ids);
  const parent = new Map(board.edges.map((e) => [e.to, e.from]));
  const liveParent = (id: string): string | undefined => {
    let p = parent.get(id);
    while (p && gone.has(p)) p = parent.get(p);
    return p;
  };
  const edges: BoardEdge[] = [];
  for (const e of board.edges) {
    if (gone.has(e.to)) continue;
    if (!gone.has(e.from)) edges.push(e);
    else {
      const p = liveParent(e.to);
      if (p) edges.push({ ...e, from: p });
    }
  }
  return {
    ...board,
    nodes: board.nodes.filter((n) => !gone.has(n.id)).map((n) => (n.pageFlow ? { ...n, pageFlow: n.pageFlow.filter((x) => !gone.has(x)) } : n)),
    edges,
    sections: board.sections?.filter((id) => !gone.has(id)),
    flow: board.flow.filter((id) => !gone.has(id)),
  };
}

/** a が b の子孫か（枝でつなぐと輪になるかを調べる） */
export function isDescendant(board: Board, a: string, b: string): boolean {
  return descendantsOf(board, b).includes(a);
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
