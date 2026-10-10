// 演出の名前と、なぜそれが注意を引くかの説明。
// 軸は「予測と結果のズレ（報酬予測誤差）」と「注意は動き・顔・大きさに引かれる」。
// 「ドーパミン＝快楽」のような俗説の言い方はしない。種明かしの言い回しは授業側で上書きしてよい。
import type { EffectKind } from './types';

export interface EffectInfo {
  /** 種明かしの一覧に出す短い名前 */
  label: string;
  /** なぜ使ったか（設計の理由） */
  why: string;
  /** 時間軸の印の色 */
  color: string;
}

export const EFFECTS: Record<EffectKind, EffectInfo> = {
  'wipe-move': { label: '話す人が変わったら、ワイプが動いた', why: '動きの始まりは、目が自動で追う', color: '#2F6FEB' },
  'face-zoom': { label: '解説の顔を大きくした', why: '顔は、ほかの物より先に注意を引く', color: '#8A4FD8' },
  blackout: { label: '画面が変わる前に、黒を挟んだ', why: '区切りを作ると、次を待つ構えができる', color: '#141414' },
  emphasis: { label: '大事な言葉だけ、大きくした', why: '大きさの違いは、探す前に飛び込む', color: '#E8452C' },
  countdown: { label: 'カウントダウンした', why: '「来る」と分かると、その瞬間に注意が集まる', color: '#D98A00' },
  reveal: { label: '予想させてから、明かした', why: '予想と答えのズレが、記憶に残る', color: '#0E9F6E' },
  flash: { label: '数秒だけ見せた', why: '時間が短いと、見る側が本気になる', color: '#C2410C' },
  'loop-open': { label: '「答えはあとで」と引いた', why: '終わっていない問いは、頭に残り続ける', color: '#0369A1' },
  'loop-close': { label: 'あとで答えを回収した', why: '待っていた答えは、ズレが大きく効く', color: '#0F766E' },
  unlock: { label: '進み具合を見せた', why: 'ゴールまでの距離が見えると、続けたくなる', color: '#6B7280' },
  'camera-hide': { label: 'カメラを隠した', why: '見えない間に、何かが変わるかもしれない', color: '#9F1239' },
};

export const EFFECT_ORDER: EffectKind[] = [
  'wipe-move',
  'face-zoom',
  'blackout',
  'emphasis',
  'countdown',
  'reveal',
  'flash',
  'loop-open',
  'loop-close',
  'unlock',
  'camera-hide',
];
