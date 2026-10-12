// 編集画面で作れるスライドの種類と、その入力欄。種類ごとの画面を作らず、この表から入力欄を組み立てる。
import {
  Bookmark,
  Columns2,
  Eye,
  Hash,
  Heading1,
  Image,
  Text,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Scene } from '../engine/types';

export type FieldType =
  | 'text' // 1行
  | 'textarea' // 何行か（改行はそのまま）
  | 'lines' // 1行に1つ（配列になる）
  | 'image' // 画像1枚（素材の枠の名前を入れる）
  | 'images' // 画像を何枚か（説明つき）
  | 'select'
  | 'toggle'
  | 'seconds'; // 秒（分:秒で入れる）

export interface Field {
  /** props の中の場所。'left.slot' のように点でつなぐと入れ子 */
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** 入力欄の下に小さく出す一言 */
  hint?: string;
  /** lines: 1行を { [linesAs]: 行 } の形で入れる（数のボードの項目など） */
  linesAs?: string;
  /** select: 値を数にする */
  numeric?: boolean;
}

export interface SlideKind {
  kind: string;
  label: string;
  icon: LucideIcon;
  /** 新しく足すときの中身 */
  make: () => Omit<Scene, 'id'>;
  fields: Field[];
  /** 一覧に出す一言（中身から） */
  summary: (props: Record<string, unknown>) => string;
}

const EMPHASIS_HINT = '**言葉** で大きく、色を変えて強調';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export const SLIDE_KINDS: SlideKind[] = [
  {
    kind: 'eyecatch',
    label: 'アイキャッチ',
    icon: Bookmark,
    make: () => ({ kind: 'eyecatch', title: 'セクション', transition: 'black', props: { title: 'セクションの題' } }),
    fields: [
      { key: 'title', label: '題', type: 'textarea', hint: EMPHASIS_HINT },
      { key: 'kicker', label: '番号の代わりの一言', type: 'text', placeholder: '空なら Section 1 のように番号', hint: '構成のセクションの順に、番号が自動で入る' },
      { key: 'subtitle', label: '副題', type: 'textarea' },
    ],
    summary: (p) => str(p.title),
  },
  {
    kind: 'title',
    label: '題',
    icon: Heading1,
    make: () => ({ kind: 'title', title: '題', props: { title: '題を書く', subtitle: '' } }),
    fields: [
      { key: 'kicker', label: '小見出し', type: 'text', placeholder: '例: 認知科学 × 情報デザイン' },
      { key: 'title', label: '題', type: 'textarea', hint: EMPHASIS_HINT },
      { key: 'subtitle', label: '副題', type: 'textarea' },
    ],
    summary: (p) => str(p.title),
  },
  {
    kind: 'text',
    label: '文字',
    icon: Text,
    make: () => ({ kind: 'text', title: '文字', props: { heading: '見出し', lines: ['1つ目の行', '2つ目の行'], build: true, align: 'left', size: 'l' } }),
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'lines', label: '本文', type: 'lines', hint: `1行に1つ。${EMPHASIS_HINT}` },
      { key: 'build', label: '1行ずつ出す', type: 'toggle', hint: '→ を押すたびに1行ずつ' },
      { key: 'align', label: '寄せ', type: 'select', options: [{ value: 'left', label: '左' }, { value: 'center', label: '中央' }] },
      {
        key: 'size',
        label: '字の大きさ',
        type: 'select',
        options: [
          { value: 'm', label: '中' },
          { value: 'l', label: '大' },
          { value: 'xl', label: '特大' },
        ],
      },
    ],
    summary: (p) => str(p.heading) || (Array.isArray(p.lines) ? String(p.lines[0] ?? '') : ''),
  },
  {
    kind: 'media',
    label: '画像・動画',
    icon: Image,
    make: () => ({ kind: 'media', title: '画像', props: { items: [{ caption: '' }] } }),
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'items', label: '画像', type: 'images', hint: '何枚か入れると → で1枚ずつ' },
    ],
    summary: (p) => str(p.heading) || `${Array.isArray(p.items) ? p.items.length : 0}枚`,
  },
  {
    kind: 'compare',
    label: '2枚を並べる',
    icon: Columns2,
    make: () => ({ kind: 'compare', title: '2枚を並べる', props: { heading: '', left: {}, right: {}, labels: ['前', '後'], mode: 'side' } }),
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'left.slot', label: '左の画像', type: 'image' },
      { key: 'right.slot', label: '右の画像', type: 'image' },
      { key: 'labels.0', label: '左の札', type: 'text' },
      { key: 'labels.1', label: '右の札', type: 'text' },
      {
        key: 'mode',
        label: '見せ方',
        type: 'select',
        options: [
          { value: 'side', label: '並べる' },
          { value: 'toggle', label: '→ で切り替える' },
          { value: 'flicker', label: 'フリッカー（交互に点滅）' },
        ],
      },
    ],
    summary: (p) => str(p.heading),
  },
  {
    kind: 'reveal',
    label: '予想→答え',
    icon: Eye,
    make: () => ({ kind: 'reveal', title: '予想→答え', props: { heading: '予想してみて', question: '問いを書く', answer: '答えを書く' } }),
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'question', label: '問い', type: 'textarea', hint: EMPHASIS_HINT },
      { key: 'answer', label: '答え', type: 'textarea', hint: '→ で明かす' },
      { key: 'media.slot', label: 'ぼかす画像', type: 'image', hint: 'なくてもよい。→ でぼかしが取れる' },
    ],
    summary: (p) => str(p.question),
  },
  {
    kind: 'timer',
    label: '残り時間',
    icon: Timer,
    make: () => ({ kind: 'timer', title: '残り時間', wipe: 'host', props: { heading: '制作時間', seconds: 240, endText: '時間です' } }),
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'seconds', label: '時間', type: 'seconds', hint: '→ で数え始める' },
      { key: 'endText', label: '終わりの言葉', type: 'text' },
    ],
    summary: (p) => str(p.heading),
  },
  {
    kind: 'board',
    label: '数のボード',
    icon: Hash,
    make: () => ({ kind: 'board', title: '数のボード', props: { heading: '人数', cells: [{ label: '人数' }], unit: '人' } }),
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'cells', label: '項目', type: 'lines', linesAs: 'label', hint: '1行に1つ（例: チーム1 〜 チーム6）。数字キーで入れる' },
      { key: 'unit', label: '単位', type: 'text', placeholder: '人' },
      { key: 'highlightTop', label: 'いちばん多いのを → で目立たせる', type: 'toggle' },
    ],
    summary: (p) => str(p.heading),
  },
  {
    kind: 'flash',
    label: '3秒だけ映す',
    icon: Zap,
    make: () => ({ kind: 'flash', title: '3秒だけ映す', wipe: 'hidden', props: { heading: '3秒で伝えろ', seconds: 3 } }),
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'seconds', label: '映す秒数', type: 'select', numeric: true, options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}秒` })) },
    ],
    summary: (p) => str(p.heading),
  },
];

export function kindOf(kind: string): SlideKind | undefined {
  return SLIDE_KINDS.find((k) => k.kind === kind);
}

/** 'left.slot' のような場所の値を読む */
export function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

/** 'left.slot' のような場所に値を書いた写しを返す（配列の番号にも対応） */
export function setPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [head, ...rest] = path.split('.');
  const cur = obj[head];
  if (rest.length === 0) return { ...obj, [head]: value };
  const child = (Array.isArray(cur) ? Object.assign([], cur) : { ...((cur as Record<string, unknown>) ?? {}) }) as Record<string, unknown>;
  const next = setPath(child, rest.join('.'), value);
  return { ...obj, [head]: Array.isArray(cur) || /^\d+$/.test(rest[0]) ? Object.assign([], next) : next };
}
