// 顔検出のモデル（BlazeFace short range, Google 公式の配布）を public/models/ に置く。
import { writeFile, mkdir } from 'node:fs/promises';
const url = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const out = 'public/models/blaze_face_short_range.tflite';
await mkdir('public/models', { recursive: true });
const res = await fetch(url);
if (!res.ok) throw new Error(`download failed: ${res.status}`);
await writeFile(out, Buffer.from(await res.arrayBuffer()));
console.log(`saved ${out}`);
