// 場面の部品を登録する。新しい部品はここに1行足す。
import { registerKind } from '../engine/registry';
import { MediaScene, TextScene, TitleScene } from './basic';
import { EffectLogScene } from './EffectLogScene';

export function registerScenes() {
  registerKind('title', TitleScene);
  registerKind('text', TextScene);
  registerKind('media', MediaScene);
  registerKind('effect-log', EffectLogScene);
}
