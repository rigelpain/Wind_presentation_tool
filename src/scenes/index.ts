// 場面の部品を登録する。新しい部品はここに1行足す。
import { registerKind } from '../engine/registry';
import { MediaScene, TextScene, TitleScene } from './basic';
import { BoardScene } from './BoardScene';
import { ChapterScene } from './ChapterScene';
import { CompareScene } from './CompareScene';
import { EffectLogScene } from './EffectLogScene';
import { FlashScene } from './FlashScene';
import { RevealScene } from './RevealScene';
import { TimerScene } from './TimerScene';

export function registerScenes() {
  registerKind('title', TitleScene);
  registerKind('text', TextScene);
  registerKind('media', MediaScene);
  registerKind('effect-log', EffectLogScene);
  registerKind('timer', TimerScene);
  registerKind('board', BoardScene);
  registerKind('flash', FlashScene);
  registerKind('compare', CompareScene);
  registerKind('reveal', RevealScene);
  registerKind('chapter', ChapterScene);
}
