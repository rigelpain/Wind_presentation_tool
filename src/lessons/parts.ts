// 部品の見本（?lesson=parts）。部品を1つずつ確かめるための授業。授業の中身ではない。
import type { Lesson } from '../engine/types';

export const parts: Lesson = {
  id: 'parts',
  title: '部品の見本',
  durationMin: 30,
  roleLabels: { host: '進行', guest: '解説' },
  scenes: [
    { id: 'p-title', kind: 'title', title: '部品の見本', wipe: 'both', props: { title: '部品の**見本**' } },
    {
      id: 'p-chapter',
      kind: 'chapter',
      title: '章（進み具合・解放）',
      transition: 'black',
      props: { heading: '今日の4つ', chapters: ['プリント', '変化', '3秒で伝えろ', '大学で学ぶと'], current: 1 },
    },
    {
      id: 'p-reveal',
      kind: 'reveal',
      title: '予想 → 種明かし',
      opensLoop: { id: 'q1', text: 'なぜ見落とすのか？' },
      props: { heading: '予想してみて', question: 'この写真、どこが変わった？', answer: '**眼鏡**が消えた', media: { slot: 'team-1' } },
    },
    { id: 'p-timer', kind: 'timer', title: '残り時間', wipe: 'host', props: { heading: '制作時間', seconds: 240 } },
    {
      id: 'p-board-single',
      kind: 'board',
      title: '数のボード（1つ）',
      props: { heading: '角を折った人', cells: [{ label: '人数' }], layout: 'single', unit: '人' },
    },
    {
      id: 'p-board-teams',
      kind: 'board',
      title: 'スコアボード（6チーム）',
      props: {
        heading: '伝わった人数',
        cells: [1, 2, 3, 4, 5, 6].map((n) => ({ label: `チーム${n}` })),
        layout: 'grid',
        unit: '人',
        highlightTop: true,
        markLabel: '美しい賞',
      },
    },
    { id: 'p-flash', kind: 'flash', title: '3秒だけ映す', wipe: 'hidden', props: { heading: '3秒で伝えろ', seconds: 3 } },
    {
      id: 'p-compare-side',
      kind: 'compare',
      title: '2枚を並べる',
      wipe: 'both',
      props: { heading: '上位と下位', left: { slot: 'team-1' }, right: { slot: 'team-2' }, labels: ['いちばん伝わった', 'いちばん伝わらなかった'], steps: ['both', 'left', 'right'] },
    },
    {
      id: 'p-compare-snap',
      kind: 'compare',
      title: '前後の静止画',
      closesLoop: 'q1',
      props: { heading: '前と後', left: { snapshot: 'before', role: 'guest' }, right: { snapshot: 'after', role: 'guest' }, labels: ['前', '後'] },
    },
    {
      id: 'p-compare-toggle',
      kind: 'compare',
      title: '前後で切り替える',
      props: { mode: 'toggle', left: { slot: 'team-1', caption: '前' }, right: { slot: 'team-2', caption: '後' } },
    },
    {
      id: 'p-flicker',
      kind: 'compare',
      title: 'フリッカー',
      wipe: 'hidden',
      props: { mode: 'flicker', left: { slot: 'team-1' }, right: { slot: 'team-2' }, flickerMs: 800, gapMs: 250 },
    },
    { id: 'p-log', kind: 'effect-log', title: '種明かし', wipe: 'both', transition: 'black', props: {} },
  ],
};
