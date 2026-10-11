// 名札の色。地の色を選ぶと、字の色は読みやすい方（白か墨）を自動で選ぶ。
export const LABEL_SWATCHES: { name: string; bg: string }[] = [
  { name: '墨', bg: '#141414' },
  { name: '白', bg: '#FFFFFF' },
  { name: '朱', bg: '#E8452C' },
  { name: '青', bg: '#2F6FEB' },
  { name: '緑', bg: '#0E9F6E' },
  { name: '黄', bg: '#FACC15' },
  { name: '紫', bg: '#8A4FD8' },
];

export const DEFAULT_LABEL_BG = '#141414';

/** 地の色に対して読みやすい字の色 */
export function labelText(bg: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg.trim());
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // 名札は大きな太字なので、白字とのコントラストが 3（大きな字の基準）に届けば白、届かなければ墨
  return 1.05 / (L + 0.05) >= 3 ? '#FFFFFF' : '#141414';
}
