// 構成の「考える手がかり」。選んだカードの次に考えるとよいことを、薄いカードで出す。
// 決まった言葉の並びから選ぶだけ（このPCの中で終わる。どこへも送らない）。
import type { Board, BoardNode } from '../engine/types';
import { childPosition, childrenOf, descendantsOf, GAP_Y, NODE_H, nodeKind, parentOf } from './board';

export interface Hint {
  /** 薄いカードの id（ボードのカードとは別） */
  id: string;
  text: string;
  /** なぜこれを考えるか（ホバーで出す） */
  why: string;
  kind: 'section' | 'page';
  /** 子として置く親。null はセクション（親なし） */
  parent: string | null;
  x: number;
  y: number;
}

type Word = [text: string, why: string];

/** 授業の山の流れ（セクションの手がかり） */
const ARC: Word[] = [
  ['つかみ', '最初の数分で、身を乗り出させる'],
  ['問い', 'この授業で考えたい問いを1つ置く'],
  ['やってみる', '聞くだけでなく、手や頭を動かす時間'],
  ['種明かし', 'やってみたことの裏側を見せる'],
  ['ふりかえり', '何がわかったかを、自分の言葉にする'],
  ['持ち帰る問い', '終わったあとも考え続けられる問い'],
];

/** セクションの中に置くページの手がかり */
const SECTION_PAGES: Word[] = [
  ['最初に投げる問い', 'このセクションを、問いから始める'],
  ['ふだんの例', '生徒の毎日にある場面から入る'],
  ['やってみること', 'ここで手を動かすなら何をするか'],
  ['意外なところ', '「えっ」となるところはどこか'],
  ['ひとことでまとめる', 'このセクションを1行で言うと'],
  ['見せるもの', '写真・動画・実物で見せられるもの'],
];

/** ページを深める子の手がかり */
const DEEPEN: Word[] = [
  ['たとえば？', '具体的な例を1つ'],
  ['なぜ？', 'そう言える理由'],
  ['反対に言うと？', '逆から見るとどうなるか'],
  ['生徒が言いそうなこと', '聞いている側の声を先に想像する'],
  ['見せられるもの', '写真・動画・実物で見せられるもの'],
  ['くらべると？', '似たもの・前とあとをならべる'],
  ['数で言うと？', '数字にするとどのくらいか'],
  ['だから何？', 'それがわかると何がうれしいか'],
];

/** ページの次（兄弟）の手がかり */
const NEXT_PAGES: Word[] = [
  ['次に話すこと', 'この話のあとに続けること'],
  ['ここで問いかける', '一度止まって、生徒に聞く'],
  ['ここで手を動かす', '聞くだけの時間が続いたら'],
];

/** 使われていない言葉を、round だけずらして n 個選ぶ */
function pick(words: Word[], used: Set<string>, n: number, round: number): Word[] {
  const free = words.filter(([t]) => !used.has(t));
  if (!free.length) return [];
  const out: Word[] = [];
  for (let k = 0; k < Math.min(n, free.length); k++) out.push(free[(round * n + k) % free.length]);
  return out;
}

/** 選んだカード（位置は動かしている最中のもの）に出す手がかり */
export function hintsFor(board: Board, sel: BoardNode, round: number): Hint[] {
  const out: Hint[] = [];
  const kids = childrenOf(board, sel.id);
  const usedKids = new Set(kids.map((k) => k.text.trim()));
  const childAt = childPosition(board, sel);
  const asChildren = (words: Word[]) =>
    words.forEach(([text, why], k) =>
      out.push({ id: `hint:c${k}`, text, why, kind: 'page', parent: sel.id, x: childAt.x, y: childAt.y + k * (NODE_H + GAP_Y) }),
    );

  if (nodeKind(sel) === 'section') {
    asChildren(pick(SECTION_PAGES, usedKids, 2, round));
    // いちばん最後のセクションなら、次のセクションの手がかりも（下に置く）
    const sections = board.sections ?? [];
    if (sections[sections.length - 1] === sel.id) {
      const usedSecs = new Set(sections.map((id) => board.nodes.find((n) => n.id === id)?.text.trim() ?? ''));
      // 名前が山の流れにあればその次から、なければ何番目のセクションかで山の位置を見当つける
      const named = ARC.findIndex(([t]) => t === sel.text.trim());
      const start = Math.min(named >= 0 ? named + 1 : sections.length, ARC.length - 1);
      const order = [...ARC.slice(start), ...ARC.slice(0, start)];
      const [next] = pick(order, usedSecs, 1, round);
      if (next) {
        const bottom = Math.max(sel.y, ...descendantsOf(board, sel.id).map((id) => board.nodes.find((n) => n.id === id)?.y ?? sel.y));
        out.push({ id: 'hint:s', text: next[0], why: next[1], kind: 'section', parent: null, x: sel.x, y: bottom + NODE_H + GAP_Y + 40 });
      }
    }
  } else {
    asChildren(pick(DEEPEN, usedKids, 2, round));
    const parent = parentOf(board, sel.id);
    if (parent) {
      const sibs = new Set(childrenOf(board, parent.id).map((k) => k.text.trim()));
      const [next] = pick(NEXT_PAGES, sibs, 1, round);
      const at = childPosition(board, parent);
      if (next) out.push({ id: 'hint:n', text: next[0], why: next[1], kind: 'page', parent: parent.id, x: at.x, y: Math.max(at.y, sel.y + NODE_H + GAP_Y) });
    }
  }
  return out;
}
