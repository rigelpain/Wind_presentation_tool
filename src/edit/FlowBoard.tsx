// 編集画面の「構成」。話のタネを置き、枝分かれさせて発散し、流れをつくる。流れの順がスライドの順になる。
//
// 操作:
//   何もない所をダブルクリック … タネを置く
//   カードを選んで Tab … 子（枝）を足す / Enter … 兄弟を足す / Delete … 消す
//   カードをダブルクリック、または F2 … 言葉を直す（Enter で決める、Esc でやめる、Tab で決めて子を足す）
//   ← → ↑ ↓ … 親・子・兄弟へ選びを動かす
//   カードの右の点から別のカードの左の点へドラッグ … 枝でつなぐ
//   「流れをつくる」を入れて、話す順にカードを押す … 流れに入る（もう一度押すと外れる）
import '@xyflow/react/dist/style.css';
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  MiniMap,
  PanOnScrollMode,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  Bookmark,
  ChevronRight,
  Copy,
  FileText,
  CirclePlus,
  GitBranchPlus,
  GripVertical,
  Maximize,
  Network,
  PanelRightOpen,
  Redo2,
  Route,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent } from 'react';
import { IconButton, Segmented, Swatches } from '../control/ui';
import type { Board, BoardNode, BoardNodeKind, Lesson } from '../engine/types';
import { addNode, childPosition, childrenOf, descendantsOf, GAP_Y, KIND_INFO, makesSlide, newNodeId, NODE_H, NODE_W, nodeKind, parentOf, removeNodes, tidy } from './board';
import { kindOf, SLIDE_KINDS } from './schema';
import './FlowBoard.css';

type SetLesson = (fn: (l: Lesson) => Lesson, opts?: { merge?: boolean }) => void;

interface CardData extends Record<string, unknown> {
  node: BoardNode;
  /** 流れに入っているか */
  inFlow: boolean;
  /** スライドの番号（流れに入っていてスライドになるとき） */
  slideNo: number | null;
  sceneKind?: string;
  kids: number;
  editing: boolean;
  flowMode: boolean;
}

interface Ctx {
  commitText: (id: string, text: string, then?: 'child' | 'sibling') => void;
  cancelEdit: () => void;
  startEdit: (id: string) => void;
  toggleCollapse: (id: string) => void;
}
const BoardCtx = createContext<Ctx | null>(null);

const COLORS = ['#E8452C', '#F59E0B', '#0E9F6E', '#2F6FEB', '#8A4FD8', '#8A8577'].map((value) => ({ name: value, value }));

function Card({ id, data, selected }: NodeProps<Node<CardData>>) {
  const ctx = useContext(BoardCtx)!;
  const { node, inFlow, slideNo, sceneKind, kids, editing, flowMode } = data;
  const kind = nodeKind(node);
  const color = node.color ?? KIND_INFO[kind].color;
  const placeholder = kind === 'section' ? 'セクション' : 'ページ';
  const [text, setText] = useState(node.text);
  useEffect(() => setText(node.text), [node.text, editing]);
  // 新しいカードは、大きさを測り終えるまで見えない（見えないと文字の欄に入れない）。見えたらすぐ入れる
  const input = useRef<HTMLTextAreaElement | null>(null);
  const focusWhenVisible = useCallback((el: HTMLTextAreaElement | null) => {
    input.current = el;
    if (!el) return;
    let frames = 0;
    const tick = () => {
      if (!el.isConnected || document.activeElement === el) return;
      const host = el.closest('.react-flow__node') as HTMLElement | null;
      if (!host || getComputedStyle(host).visibility === 'visible') {
        el.focus();
        el.select();
        if (document.activeElement === el) return;
      }
      // 窓が隠れていると描き直し（requestAnimationFrame）が止まるので、時計で待つ
      if (++frames < 60) window.setTimeout(tick, 25);
    };
    window.setTimeout(tick, 0);
  }, []);
  const SlideIcon = sceneKind ? kindOf(sceneKind)?.icon : undefined;
  const onKey = (e: RKeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ctx.commitText(id, text);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      ctx.commitText(id, text, 'child');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      ctx.cancelEdit();
    }
  };
  return (
    <div
      className={`card card--${kind} ${selected ? 'is-selected' : ''} ${inFlow ? 'is-flow' : ''} ${flowMode ? 'is-flowmode' : ''}`}
      style={{ '--card': color } as CSSProperties}
      onDoubleClick={(e) => {
        e.stopPropagation();
        ctx.startEdit(id);
      }}
    >
      <Handle type="target" position={Position.Left} id="b" className="card__h card__h--b" />
      {FLOW_SIDES.map(([side, pos]) => (
        <Handle key={`t${side}`} type="target" position={pos} id={`ft${side}`} className="card__h card__h--f" isConnectable={false} />
      ))}
      {inFlow &&
        (slideNo !== null ? (
          <span className="card__num" title="スライドの番号">
            {slideNo}
          </span>
        ) : (
          <span className="card__num card__num--none" title="流れの区切り（スライドにしない）">
            §
          </span>
        ))}
      {kind === 'section' && (
        <span className="card__tag" title={node.sectionMode === 'eyecatch' ? 'アイキャッチ（区切りの題のスライド）を挟む' : 'スライドにしない（流れの区切りだけ）'}>
          <Bookmark size={11} aria-hidden />
          {node.sectionMode === 'eyecatch' ? 'アイキャッチ' : 'スライドなし'}
        </span>
      )}
      {editing ? (
        <textarea
          ref={focusWhenVisible}
          className="card__input nodrag nowheel"
          value={text}
          rows={Math.max(1, text.split('\n').length)}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => ctx.commitText(id, text)}
        />
      ) : (
        <div className={`card__text ${node.text ? '' : 'is-empty'}`}>{node.text || placeholder}</div>
      )}
      {SlideIcon && kind === 'page' && (
        <span className="card__slide" title={`スライド: ${kindOf(sceneKind!)?.label ?? sceneKind}`}>
          <SlideIcon size={12} />
        </span>
      )}
      {kids > 0 && (
        <button
          className={`card__fold nodrag ${node.collapsed ? 'is-folded' : ''}`}
          title={node.collapsed ? `${kids}枚の枝を開く` : '枝をたたむ'}
          onClick={(e) => {
            e.stopPropagation();
            ctx.toggleCollapse(id);
          }}
        >
          {node.collapsed ? `+${kids}` : <ChevronRight size={12} />}
        </button>
      )}
      <Handle type="source" position={Position.Right} id="b" className="card__h card__h--b" />
      {FLOW_SIDES.map(([side, pos]) => (
        <Handle key={`s${side}`} type="source" position={pos} id={`fs${side}`} className="card__h card__h--f" isConnectable={false} />
      ))}
    </div>
  );
}

const nodeTypes = { card: Card };

/** 流れの矢印をつなぐ辺（上下左右） */
const FLOW_SIDES: [string, Position][] = [
  ['t', Position.Top],
  ['b', Position.Bottom],
  ['l', Position.Left],
  ['r', Position.Right],
];

/** 流れの矢印は、次のカードのある向きの辺から出して、向かい合う辺へ入れる */
function flowSides(a: BoardNode, b: BoardNode): [string, string] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dy) * 2.2 >= Math.abs(dx)) return dy >= 0 ? ['b', 't'] : ['t', 'b'];
  return dx >= 0 ? ['r', 'l'] : ['l', 'r'];
}

function hiddenSet(board: Board): Set<string> {
  const out = new Set<string>();
  for (const n of board.nodes) if (n.collapsed) descendantsOf(board, n.id).forEach((d) => out.add(d));
  return out;
}

function Inner({ lesson, setLesson, readOnly, onOpenSlide, onCopy, undo, redo, canUndo, canRedo }: Props) {
  const board = lesson.board!;
  const rf = useReactFlow();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flowMode, setFlowMode] = useState(false);
  const [panel, setPanel] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  const sceneKind = useMemo(() => new Map(lesson.scenes.map((s) => [s.id, s.kind])), [lesson.scenes]);
  const flowIndex = useMemo(() => new Map(board.flow.map((id, i) => [id, i])), [board.flow]);
  // スライドの番号は、スライドになるカードだけで数える（スライドにしないセクションは数えない）
  const slideNo = useMemo(() => {
    const m = new Map<string, number>();
    let k = 0;
    for (const id of board.flow) {
      const n = board.nodes.find((x) => x.id === id);
      if (n && makesSlide(n)) m.set(id, ++k);
    }
    return m;
  }, [board.flow, board.nodes]);
  const hidden = useMemo(() => hiddenSet(board), [board]);

  const build = useCallback(
    (prev: Node<CardData>[]): Node<CardData>[] => {
      const old = new Map(prev.map((n) => [n.id, n]));
      return board.nodes.map((n) => {
        const o = old.get(n.id);
        return {
          id: n.id,
          type: 'card',
          position: { x: n.x, y: n.y },
          hidden: hidden.has(n.id),
          selected: o?.selected ?? false,
          // 大きさの見込みを先に渡す（測り終えるまでカードが見えない・文字を打てない、をなくす）
          measured: o?.measured ?? { width: NODE_W, height: NODE_H },
          draggable: !readOnly && editingId !== n.id,
          style: { width: NODE_W },
          data: {
            node: n,
            inFlow: flowIndex.has(n.id),
            slideNo: slideNo.get(n.id) ?? null,
            sceneKind: n.sceneId && flowIndex.has(n.id) ? sceneKind.get(n.sceneId) : undefined,
            kids: childrenOf(board, n.id).length,
            editing: editingId === n.id,
            flowMode,
          },
        };
      });
    },
    [board, hidden, flowIndex, slideNo, sceneKind, editingId, flowMode, readOnly],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CardData>>([]);
  useEffect(() => setNodes((prev) => build(prev)), [build, setNodes]);
  // 直しているカードが消えた・たたまれたときは、直すのをやめる（キーが効かなくならないように）
  useEffect(() => {
    if (editingId && (!board.nodes.some((n) => n.id === editingId) || hidden.has(editingId))) setEditingId(null);
  }, [editingId, board.nodes, hidden]);

  const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
  const selected = selectedIds.length === 1 ? board.nodes.find((n) => n.id === selectedIds[0]) : undefined;

  const select = (id: string) => setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));

  const edges: Edge[] = useMemo(() => {
    const branch: Edge[] = board.edges.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      sourceHandle: 'b',
      targetHandle: 'b',
      className: 'edge-branch',
      hidden: hidden.has(e.to) || hidden.has(e.from),
    }));
    const byId = new Map(board.nodes.map((n) => [n.id, n]));
    const flowEdges: Edge[] = board.flow.slice(1).map((id, i) => {
      const [from, to] = flowSides(byId.get(board.flow[i])!, byId.get(id)!);
      return {
      id: `flow-${board.flow[i]}-${id}`,
      source: board.flow[i],
      target: id,
      sourceHandle: `fs${from}`,
      targetHandle: `ft${to}`,
      className: 'edge-flow',
      animated: true,
      selectable: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#E8452C', width: 18, height: 18 },
      hidden: hidden.has(id) || hidden.has(board.flow[i]),
      };
    });
    return [...branch, ...flowEdges];
  }, [board, hidden]);

  const updateBoard = (fn: (b: Board) => Board, opts?: { merge?: boolean }) => {
    if (readOnly) return;
    setLesson((l) => ({ ...l, board: fn(l.board!) }), opts);
  };

  /** カードの言葉を変える。スライドの名前（と、まだ同じなら見出し）も合わせる */
  const setText = (id: string, text: string) => {
    if (readOnly) return;
    setLesson(
      (l) => {
        const node = l.board!.nodes.find((n) => n.id === id);
        if (!node || node.text === text) return l;
        const old = node.text;
        const scenes = l.scenes.map((s) => {
          if (s.id !== node.sceneId) return s;
          const props = { ...(s.props ?? {}) };
          for (const k of ['heading', 'title', 'question']) if (props[k] === old) props[k] = text;
          if (Array.isArray(props.lines) && props.lines.length === 1 && props.lines[0] === old) props.lines = [text];
          return { ...s, title: text || s.title, props };
        });
        return { ...l, scenes, board: { ...l.board!, nodes: l.board!.nodes.map((n) => (n.id === id ? { ...n, text } : n)) } };
      },
      { merge: true },
    );
  };

  /** 新しいカードを選んで、すぐ言葉を打てるようにする（id は先に作る。状態の更新は後で走るため） */
  const startNew = (id: string) => {
    setTimeout(() => {
      select(id);
      setEditingId(id);
    }, 0);
  };
  const addChild = (parentId: string) => {
    const id = newNodeId();
    updateBoard((b) => {
      const parent = b.nodes.find((n) => n.id === parentId);
      if (!parent) return b;
      const opened = { ...b, nodes: b.nodes.map((n) => (n.id === parentId ? { ...n, collapsed: false } : n)) };
      return addNode(opened, childPosition(b, parent), parentId, id).board;
    });
    startNew(id);
  };
  const addSibling = (sibId: string) => {
    const parent = parentOf(board, sibId);
    if (parent) return addChild(parent.id);
    const node = board.nodes.find((n) => n.id === sibId);
    if (!node) return;
    const id = newNodeId();
    updateBoard((b) => addNode(b, { x: node.x, y: node.y + NODE_H + GAP_Y + 40 }, undefined, id).board);
    startNew(id);
  };
  const addSeedAt = (x: number, y: number) => {
    const id = newNodeId();
    updateBoard((b) => addNode(b, { x: x - NODE_W / 2, y: y - NODE_H / 2, kind: 'section', sectionMode: 'none' }, undefined, id).board);
    startNew(id);
  };
  const removeSelected = (ids = selectedIds) => {
    if (!ids.length || readOnly) return;
    const withSlides = ids.filter((id) => flowIndex.has(id)).length;
    if (withSlides && !confirm(`流れに入っているカード（${withSlides}枚）を消すと、そのスライドも消えます。消しますか？`)) return;
    updateBoard((b) => removeNodes(b, ids));
  };
  const toggleFlow = (id: string) => {
    updateBoard((b) => (b.flow.includes(id) ? { ...b, flow: b.flow.filter((x) => x !== id) } : { ...b, flow: [...b.flow, id] }));
  };
  const centerOn = (id: string) => {
    const n = board.nodes.find((x) => x.id === id);
    if (n) void rf.setCenter(n.x + NODE_W / 2, n.y + NODE_H / 2, { zoom: Math.max(rf.getZoom(), 0.9), duration: 300 });
    select(id);
  };

  const ctx: Ctx = {
    commitText: (id, text, then) => {
      setText(id, text.trim() ? text : text.trim());
      setEditingId(null);
      if (then === 'child') addChild(id);
      wrap.current?.focus();
    },
    cancelEdit: () => {
      setEditingId(null);
      wrap.current?.focus();
    },
    startEdit: (id) => !readOnly && setEditingId(id),
    toggleCollapse: (id) => updateBoard((b) => ({ ...b, nodes: b.nodes.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n)) })),
  };

  /** 見える範囲の真ん中にセクションを置く */
  const addAtCenter = () => {
    const box = wrap.current?.querySelector('.board__canvas')?.getBoundingClientRect();
    const p = rf.screenToFlowPosition({ x: (box?.left ?? 0) + (box?.width ?? 800) / 2, y: (box?.top ?? 0) + (box?.height ?? 600) / 2 });
    addSeedAt(p.x, p.y);
  };
  const [nudge, setNudge] = useState(0);

  // キーボード。窓全体で受け取る（ボードを一度押していなくても効くように）。カードを直している最中は、カードの欄が受け取る
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (editingId || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
    if (document.querySelector('.panel-backdrop')) return;
    if (!['Tab', 'Enter', 'F2', 'Delete', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    if (readOnly) {
      // 見本は直せないので、写して編集するよう知らせる
      e.preventDefault();
      setNudge((x) => x + 1);
      return;
    }
    const id = selected?.id;
    if (!id) {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        addAtCenter();
      }
      return;
    }
    const go = (target?: BoardNode) => target && (e.preventDefault(), centerOn(target.id));
    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        addChild(id);
        break;
      case 'Enter':
        e.preventDefault();
        addSibling(id);
        break;
      case 'F2':
        e.preventDefault();
        setEditingId(id);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        removeSelected();
        break;
      case 'ArrowLeft':
        go(parentOf(board, id));
        break;
      case 'ArrowRight':
        go(childrenOf(board, id)[0]);
        break;
      case 'ArrowUp':
      case 'ArrowDown': {
        const p = parentOf(board, id);
        const sibs = p ? childrenOf(board, p.id) : [];
        const i = sibs.findIndex((s) => s.id === id);
        go(sibs[i + (e.key === 'ArrowUp' ? -1 : 1)]);
        break;
      }
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** ページのスライドの種類を変える（中身はその種類のひな形に入れ替わる） */
  const setSlideKind = (node: BoardNode, kind: string) => {
    const def = kindOf(kind);
    if (!def || !node.sceneId) return;
    if (!confirm(`スライドを「${def.label}」に変えます。いまの中身は入れ替わります。`)) return;
    setLesson((l) => ({
      ...l,
      scenes: l.scenes.map((sc) => {
        if (sc.id !== node.sceneId) return sc;
        const made = def.make();
        const props = { ...(made.props ?? {}) };
        const text = node.text.trim() || made.title;
        for (const k of ['heading', 'title', 'question']) if (k in props) props[k] = text;
        return { ...made, id: sc.id, title: text, notes: sc.notes, props };
      }),
    }));
  };

  const onConnect = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    updateBoard((b) =>
      b.edges.some((e) => e.from === c.source && e.to === c.target) ? b : { ...b, edges: [...b.edges.filter((e) => e.to !== c.target), { id: `e-${c.source}-${c.target}`, from: c.source!, to: c.target! }] },
    );
  };

  const empty = board.nodes.length === 0;
  const flowNodes = board.flow.map((id) => board.nodes.find((n) => n.id === id)).filter(Boolean) as BoardNode[];
  const dragFrom = useRef<number | null>(null);

  return (
    <BoardCtx.Provider value={ctx}>
      <div className={`board ${flowMode ? 'is-flowmode' : ''}`} ref={wrap} tabIndex={0}>
        <div
          className="board__canvas"
          onDoubleClick={(e) => {
            if (readOnly) {
              setNudge((x) => x + 1);
              return;
            }
            if (!(e.target as HTMLElement).classList.contains('react-flow__pane')) return;
            const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
            addSeedAt(p.x, p.y);
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={(_, __, dragged) => {
              const moved = new Map(dragged.map((n) => [n.id, n.position]));
              updateBoard((b) => ({ ...b, nodes: b.nodes.map((n) => (moved.has(n.id) ? { ...n, x: Math.round(moved.get(n.id)!.x), y: Math.round(moved.get(n.id)!.y) } : n)) }));
            }}
            onNodeClick={(_, n) => {
              if (flowMode && !readOnly) toggleFlow(n.id);
            }}
            onConnect={onConnect}
            onEdgeDoubleClick={(_, edge) => {
              if (!edge.id.startsWith('flow-')) updateBoard((b) => ({ ...b, edges: b.edges.filter((e) => e.id !== edge.id) }));
            }}
            zoomOnDoubleClick={false}
            // トラックパッド: 2本指のスワイプで動かし、ピンチで拡大・縮小する（マウスのホイールも動かす。拡大は ⌘＋ホイール）
            panOnScroll
            panOnScrollMode={PanOnScrollMode.Free}
            zoomOnScroll={false}
            zoomOnPinch
            deleteKeyCode={null}
            selectionKeyCode="Shift"
            multiSelectionKeyCode={['Meta', 'Shift']}
            minZoom={0.15}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} color="#46433b" />
            <MiniMap
              pannable
              zoomable
              className="board__minimap"
              ariaLabel="全体の地図"
              nodeColor={(n) => {
                const d = n.data as CardData;
                return nodeKind(d.node) === 'section' ? '#E8452C' : d.inFlow ? '#FDBA74' : '#CFC8B8';
              }}
              nodeStrokeWidth={0}
              nodeBorderRadius={6}
              maskColor="rgba(8,8,8,0.55)"
              maskStrokeColor="#F1EDE4"
              maskStrokeWidth={3}
            />
            <Panel position="top-left" className="board__tools">
              <IconButton icon={CirclePlus} title="セクションを置く（何もない所をダブルクリックでも）" disabled={readOnly} onClick={() => {
                const p = rf.screenToFlowPosition({ x: (wrap.current?.clientWidth ?? 800) / 2, y: (wrap.current?.clientHeight ?? 600) / 2 });
                addSeedAt(p.x, p.y);
              }} />
              <IconButton icon={GitBranchPlus} title="選んだカードに子（枝）を足す（Tab）" disabled={readOnly || !selected} onClick={() => selected && addChild(selected.id)} />
              <span className="board__sep" />
              <IconButton icon={Route} label="流れをつくる" title="入れてから、話す順にカードを押す。もう一度押すと外れる" active={flowMode} disabled={readOnly} onClick={() => setFlowMode((m) => !m)} />
              <span className="board__sep" />
              <IconButton icon={Network} title="枝を整える（選んだカードの枝。選んでいなければ全部）" disabled={readOnly} onClick={() => updateBoard((b) => tidy(b, selectedIds.length ? selectedIds : undefined))} />
              <IconButton icon={Maximize} title="全体を見る" onClick={() => void rf.fitView({ padding: 0.25, duration: 300, maxZoom: 1 })} />
              <span className="board__sep" />
              <IconButton icon={Undo2} title="取り消す（⌘Z）" disabled={!canUndo} onClick={undo} />
              <IconButton icon={Redo2} title="やり直す（⇧⌘Z）" disabled={!canRedo} onClick={redo} />
              {!panel && <IconButton icon={PanelRightOpen} title="右の欄を開く" onClick={() => setPanel(true)} />}
            </Panel>
            {flowMode && (
              <Panel position="bottom-center" className="board__flowhint">
                話す順にカードを押してください。押した順に番号が付き、スライドになります（もう一度押すと外れます）
              </Panel>
            )}
            {readOnly && (
              <Panel position="bottom-center" className={`board__readonly ${nudge ? 'is-nudged' : ''}`} key={`ro-${nudge}`}>
                <span>これは見本です。直すときは写してから</span>
                <IconButton icon={Copy} label="写して編集" title="この見本を写して、編集できる授業にする" variant="primary" onClick={onCopy} />
              </Panel>
            )}
            {empty && (
              <Panel position="top-center" className="board__empty">
                何もない所をダブルクリックして、話のタネ（セクション）を置きましょう
              </Panel>
            )}
          </ReactFlow>
        </div>

        {panel && (
          <aside className="board__side">
            <section className="board__flow">
              <header>
                <Route size={15} aria-hidden />
                <h3>流れ（{flowNodes.length}）</h3>
                <button className="board__close" title="右の欄を閉じる" onClick={() => setPanel(false)}>
                  <X size={14} />
                </button>
              </header>
              {flowNodes.length === 0 ? (
                <p className="hint">「流れをつくる」を入れて、話す順にカードを押すと、ここに並びます。</p>
              ) : (
                <ol>
                  {flowNodes.map((n, i) => {
                    const isSection = nodeKind(n) === 'section';
                    const k = n.sceneId && makesSlide(n) ? kindOf(sceneKind.get(n.sceneId) ?? '') : undefined;
                    const no = slideNo.get(n.id);
                    return (
                      <li
                        key={n.id}
                        draggable={!readOnly}
                        className={`${selected?.id === n.id ? 'is-on' : ''} ${isSection ? 'is-section' : 'is-page'}`}
                        onDragStart={() => (dragFrom.current = i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = dragFrom.current;
                          dragFrom.current = null;
                          if (from === null || from === i) return;
                          updateBoard((b) => {
                            const flow = [...b.flow];
                            const [x] = flow.splice(from, 1);
                            flow.splice(i, 0, x);
                            return { ...b, flow };
                          });
                        }}
                        onClick={() => centerOn(n.id)}
                        onDoubleClick={() => n.sceneId && makesSlide(n) && onOpenSlide(n.sceneId)}
                        title="押すとカードへ。ダブルクリックでスライドを直す。ドラッグで順番を変える"
                      >
                        <GripVertical size={13} className="board__grip" aria-hidden />
                        {no !== undefined ? <span className="board__num">{no}</span> : <span className="board__num board__num--none">§</span>}
                        {isSection ? <Bookmark size={14} aria-hidden /> : k ? <k.icon size={14} aria-hidden /> : <span />}
                        <span className="board__ftext">{n.text || '（無題）'}</span>
                        {!readOnly && (
                          <button
                            className="board__x"
                            title="流れから外す（スライドはしまっておく）"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFlow(n.id);
                            }}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {selected && (
              <section className="board__inspect">
                <header>
                  <span className="board__dot" style={{ background: selected.color ?? KIND_INFO[nodeKind(selected)].color }} />
                  <h3>選んだカード</h3>
                </header>
                <Segmented<BoardNodeKind>
                  options={[
                    { value: 'section', label: 'セクション', icon: Bookmark, title: '流れの区切り。スライドにしないか、アイキャッチにする' },
                    { value: 'page', label: 'ページ', icon: FileText, title: '流れに入れるとスライドになる' },
                  ]}
                  value={nodeKind(selected)}
                  onChange={(kind) =>
                    updateBoard((b) => ({ ...b, nodes: b.nodes.map((n) => (n.id === selected.id ? { ...n, kind, sectionMode: kind === 'section' ? n.sectionMode ?? 'none' : undefined } : n)) }))
                  }
                />
                {nodeKind(selected) === 'section' ? (
                  <Segmented<'none' | 'eyecatch'>
                    options={[
                      { value: 'none', label: 'スライドにしない', title: '流れの区切りだけ（表示画面には何も出ない）' },
                      { value: 'eyecatch', label: 'アイキャッチ', title: 'セクションの題のスライドを、ページのあいだに挟む' },
                    ]}
                    value={selected.sectionMode ?? 'none'}
                    onChange={(sectionMode) => updateBoard((b) => ({ ...b, nodes: b.nodes.map((n) => (n.id === selected.id ? { ...n, sectionMode } : n)) }))}
                  />
                ) : (
                  selected.sceneId &&
                  flowIndex.has(selected.id) && (
                    <label className="board__kind">
                      <span>スライドの種類</span>
                      <select value={sceneKind.get(selected.sceneId) ?? ''} disabled={readOnly} onChange={(e) => setSlideKind(selected, e.target.value)}>
                        {SLIDE_KINDS.filter((k) => k.kind !== 'eyecatch').map((k) => (
                          <option key={k.kind} value={k.kind}>
                            {k.label}
                          </option>
                        ))}
                        {!kindOf(sceneKind.get(selected.sceneId) ?? '') && <option value={sceneKind.get(selected.sceneId)}>{sceneKind.get(selected.sceneId)}</option>}
                      </select>
                    </label>
                  )
                )}
                <Swatches
                  colors={COLORS}
                  value={selected.color ?? ''}
                  custom={false}
                  onChange={(color) => updateBoard((b) => ({ ...b, nodes: b.nodes.map((n) => (n.id === selected.id ? { ...n, color } : n)) }))}
                />
                <div className="board__actions">
                  <IconButton icon={GitBranchPlus} label="子を足す" title="子（枝）を足す（Tab）" disabled={readOnly} onClick={() => addChild(selected.id)} />
                  <IconButton
                    icon={Route}
                    label={flowIndex.has(selected.id) ? '流れから外す' : '流れに入れる'}
                    title={flowIndex.has(selected.id) ? '流れから外す（スライドはしまっておく）' : '流れの最後に入れる'}
                    active={flowIndex.has(selected.id)}
                    disabled={readOnly}
                    onClick={() => toggleFlow(selected.id)}
                  />
                  {selected.sceneId && flowIndex.has(selected.id) && makesSlide(selected) && (
                    <IconButton icon={PanelRightOpen} label="スライドを直す" title="スライドの中身を直す" onClick={() => onOpenSlide(selected.sceneId!)} />
                  )}
                  <IconButton icon={Trash2} title="カードを消す（Delete）" variant="danger" disabled={readOnly} onClick={() => removeSelected([selected.id])} />
                </div>
                <p className="hint">
                  ページを流れに入れると、カードの言葉が見出し、子のカードが本文の行のスライドができます。セクションは、流れの区切り（スライドにしない）か、アイキャッチ（区切りの題のスライド）を選べます。
                </p>
              </section>
            )}

            <details className="board__keys">
              <summary>操作</summary>
              <ul>
                <li>ダブルクリック（何もない所）… セクションを置く</li>
                <li>Tab … 子（ページ）を足す ／ Enter … 兄弟を足す（何も選んでいなければ、真ん中にセクション）</li>
                <li>ダブルクリック（カード）・F2 … 言葉を直す</li>
                <li>← → ↑ ↓ … 親・子・兄弟へ</li>
                <li>Delete … 消す ／ ⌘Z … 取り消す</li>
                <li>右の点から左の点へドラッグ … 枝でつなぐ（枝をダブルクリックで切る）</li>
                <li>Shift を押しながらドラッグ … まとめて選ぶ</li>
                <li>2本指のスワイプ … 動かす ／ ピンチ … 拡大・縮小</li>
              </ul>
            </details>
          </aside>
        )}
      </div>
    </BoardCtx.Provider>
  );
}

interface Props {
  lesson: Lesson;
  /** 見本を写して編集する */
  onCopy: () => void;
  setLesson: SetLesson;
  readOnly: boolean;
  onOpenSlide: (sceneId: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function FlowBoard(props: Props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
