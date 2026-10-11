// 表示画面の形。幅は 1920 のまま、形に合わせて高さを変える（字の大きさや配置は変えずに、縦の余白が増える）。
import type { Aspect } from './types';

export const STAGE_W = 1920;

export function stageHeight(aspect: Aspect | undefined): number {
  if (aspect === '4:3') return 1440;
  if (aspect === '16:10') return 1200;
  return 1080;
}

export function stageRatio(aspect: Aspect | undefined): number {
  return STAGE_W / stageHeight(aspect);
}

export const ASPECTS: { value: Aspect; label: string; title: string }[] = [
  { value: '16:9', label: '16:9', title: '16:9（多くのプロジェクター、Zoom の標準）' },
  { value: '16:10', label: '16:10', title: '16:10（Mac の画面）' },
  { value: '4:3', label: '4:3', title: '4:3（古いプロジェクター）' },
];
