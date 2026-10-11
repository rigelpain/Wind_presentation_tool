// 授業の「場面」と、窓のあいだで共有する状態の型。

/** ワイプの見せ方。場面ごとに指定でき、ホットキーでも切り替える。 */
export type WipeMode =
  | 'both' // 2人とも同じ大きさ
  | 'explain' // 解説モード: 解説（guest）を大きく、進行（host）を小さく
  | 'host' // 進行だけ
  | 'guest' // 解説だけ
  | 'hidden'; // カメラを隠す（全画面で見せる）

export type Role = 'host' | 'guest';

/**
 * 場面の切り替わり方。
 * - cut: すぐ切り替える
 * - black: 黒を挟む（「画面が変わる前に黒が入る」演出として記録する）
 * - fade: 前の場面と重ねて切り替える
 * - slide: 次の場面が右から入る（「画面を動かして切り替えた」として記録する）
 */
export type Transition = 'cut' | 'black' | 'fade' | 'slide';

/**
 * 1つの場面。kind で部品（React の部品）を選び、props で中身を渡す。
 * 文面や順番はこのデータで差し替える（製品版で先生が作れるように）。
 */
export interface Scene {
  id: string;
  kind: string;
  /** 発表者用の画面に出す名前 */
  title: string;
  /** 台本のメモ（発表者用の画面だけに出る） */
  notes?: string;
  /** この場面に入ったときのワイプ。省くと直前のまま */
  wipe?: WipeMode;
  transition?: Transition;
  /** 進み具合の表示で使う章の名前 */
  chapter?: string;
  /** 目安の秒数（発表者用の画面で使う） */
  plannedSec?: number;
  /** この場面で「答えはあとで」の問いを開く */
  opensLoop?: { id: string; text: string };
  /** この場面で問いを回収する（opensLoop の id） */
  closesLoop?: string;
  /** この場面に入ったときの音楽。曲の id で流し始め、'stop' で止める。省くとそのまま */
  music?: string;
  props?: Record<string, unknown>;
}

export interface Lesson {
  id: string;
  title: string;
  /** 授業の長さ（分）。発表者用の画面の残り時間に使う */
  durationMin: number;
  /** ワイプの役割名。実名は出さない */
  roleLabels: Record<Role, string>;
  scenes: Scene[];
}

/** 注意を引く演出の種類。種明かしの一覧に回数つきで並ぶ。 */
export type EffectKind =
  | 'wipe-move' // 話す人が変わってワイプが動いた
  | 'face-zoom' // 顔を大きくした（解説モード）
  | 'blackout' // 画面が変わる前に黒を挟んだ
  | 'emphasis' // 大事な言葉だけ大きくした
  | 'countdown' // カウントダウン
  | 'reveal' // 予想させてから明かした
  | 'flash' // 数秒だけ見せた
  | 'loop-open' // 「答えはあとで」と引いた
  | 'loop-close' // あとで回収した
  | 'unlock' // 進み具合を見せた・次を解放した
  | 'camera-hide' // カメラを隠した
  | 'scene-move'; // 画面を動かして切り替えた

export interface EffectEvent {
  kind: EffectKind;
  at: number; // epoch ms
  sceneId: string;
}

export interface OpenLoop {
  id: string;
  text: string;
  openedAt: number;
}

/** 場面ごとの上書き（コントロール画面で変える）。省いた項目は授業のデータのまま */
export interface SceneOverride {
  transition?: Transition;
  wipe?: WipeMode;
  /** 曲の id で流し始め、'stop' で止める、'' で授業のデータのまま */
  music?: string;
}

export interface CaptionSettings {
  /** 字幕を出す（コントロール画面の窓で音声を聞き取る） */
  enabled: boolean;
  /** 字の大きさ（px、1920×1080 の座標） */
  size: number;
  position: 'bottom' | 'top';
  /** 出す行の数 */
  lines: 1 | 2;
  /** 話が止まってから消えるまで（秒） */
  holdSec: number;
}

/** コントロール画面で変える設定。授業のデータ（Lesson）には書き戻さず、状態に持つ */
export interface ShowSettings {
  /** 場面の並び（scene id）。null なら授業のデータの順 */
  order: string[] | null;
  /** 飛ばす場面の id */
  skipped: string[];
  overrides: Record<string, SceneOverride>;
  /** 場面に transition がないときの切り替わり方 */
  defaultTransition: Transition;
  /** 切り替えの長さ（ms）。黒・重ね・横すべりに使う */
  transitionMs: number;
  /** 授業の長さ（分）。null なら授業のデータのまま */
  durationMin: number | null;
  /** 表示画面に小さく出す時計 */
  stageClock: 'none' | 'remaining' | 'elapsed' | 'time';
  /** ワイプの大きさ（1 が標準。0.6〜1.6） */
  wipeScale: number;
  /** 顔の切り出しの寄り（1 が標準。大きいほど顔に寄る。0.6〜1.8） */
  wipeZoom: number;
  /**
   * ワイプの名札（自由に書く。左の人＝host、右の人＝guest）。空なら授業のデータの名前。
   * このPCの状態にだけ置き、授業のデータやリポジトリには書かない
   */
  roleLabels: Partial<Record<Role, string>>;
  /** 話し声の字幕 */
  captions: CaptionSettings;
  /** 名札の地の色（#RRGGBB）。字の色は自動 */
  labelColors: Partial<Record<Role, string>>;
  /** 名札の字の大きさ（1 が 32px。0.75〜2.5） */
  labelScale: number;
}

export interface MusicState {
  trackId: string | null;
  playing: boolean;
  /** 再生を始めた（再開した）時刻。位置は offsetSec + (今 - startedAt) */
  startedAt: number;
  offsetSec: number;
  /** 0〜1 */
  volume: number;
  loop: boolean;
  /** 流し始め・止めるときに音量を変える時間（ms） */
  fadeMs: number;
  /** 音を出す窓。画面共有で音を送るなら共有している方 */
  output: 'display' | 'control';
}

export interface ShowState {
  lessonId: string;
  sceneIndex: number;
  step: number;
  /** いまの step に入った時刻（タイマーや提示の起点） */
  stepAt: number;
  /** もう一度見せる等、同じ step のままやり直すための番号 */
  replay: number;
  /** 授業の開始時刻。null なら未開始 */
  startedAt: number | null;
  wipe: {
    mode: WipeMode;
    /** カメラを隠した時刻（hidden のあいだだけ） */
    hiddenSince: number | null;
    /** 左右の割り当てを入れ替えた */
    swapped: boolean;
    mirror: boolean;
    showLabels: boolean;
  };
  /** 全面の黒（リモコンの「画面を消す」ボタン） */
  blackout: boolean;
  effects: EffectEvent[];
  openLoops: OpenLoop[];
  /** 数のボードの値。scene id → セルの値 */
  boards: Record<string, BoardState>;
  /** 部品ごとの自由な値（scene id → 値）。リロードしても残る */
  sceneData: Record<string, unknown>;
  settings: ShowSettings;
  music: MusicState;
  /** 状態の版。窓のあいだの同期で新しい方を採る */
  rev: number;
}

export interface BoardState {
  values: (number | null)[];
  /** 印（美しい賞など）。セルの番号 */
  marks: number[];
  /** 入力中のセル */
  cursor: number;
  /** 入力中の数字（Enter で確定） */
  draft: string;
}

export type Action =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goto'; index: number }
  | { type: 'replay' }
  | { type: 'start' }
  | { type: 'reset' }
  | { type: 'wipe'; mode: WipeMode }
  | { type: 'toggle-explain' }
  | { type: 'toggle-hidden' }
  | { type: 'swap' }
  | { type: 'mirror' }
  | { type: 'labels' }
  | { type: 'blackout' }
  | { type: 'effect'; kind: EffectKind }
  | { type: 'board-key'; key: string }
  | { type: 'board-cursor'; index: number }
  | { type: 'scene-data'; sceneId: string; value: unknown }
  /** 設定を変える。並び・飛ばす場面が変わっても、いまの場面はそのまま */
  | { type: 'settings'; patch: Partial<ShowSettings> }
  /** 場面ごとの上書きを変える。値に undefined を入れるとその項目を授業のデータに戻す */
  | { type: 'scene-override'; sceneId: string; patch: SceneOverride }
  /** 曲を流す。trackId を省くと、いまの曲を止めたところから */
  | { type: 'music-play'; trackId?: string }
  | { type: 'music-pause' }
  | { type: 'music-stop' }
  | { type: 'music-seek'; sec: number }
  | { type: 'music-set'; patch: Partial<Pick<MusicState, 'volume' | 'loop' | 'fadeMs' | 'output'>> };
