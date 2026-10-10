// MediaPipe の wasm を public/ に写す。本番はネットなしでも動かすため、CDN から読まない。
import { cpSync, existsSync, mkdirSync } from 'node:fs';
const src = 'node_modules/@mediapipe/tasks-vision/wasm';
const dst = 'public/mediapipe/wasm';
if (existsSync(src)) {
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log(`copied ${src} -> ${dst}`);
}
