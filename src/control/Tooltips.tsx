// コントロール画面の説明の吹き出し。title の付いたもの（アイコンだけのボタンなど）にマウスを乗せると、すぐに説明を出す。
// ブラウザの標準の吹き出しは出るのが遅く気づきにくいので、title を data-tip に移して自前で出す。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Tip {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

const DELAY_MS = 250;

export function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef(0);
  const current = useRef<HTMLElement | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  // 出したあとで幅を測り、画面の端からはみ出す分だけ内側へ寄せる
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !tip) return;
    const r = el.getBoundingClientRect();
    const over = r.right - (window.innerWidth - 8);
    const under = 8 - r.left;
    setShift(over > 0 ? -over : under > 0 ? under : 0);
  }, [tip]);

  useEffect(() => {
    const root = document.querySelector('.control');
    if (!root) return;

    const target = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[title], [data-tip]') as HTMLElement | null;
      return el && root.contains(el) ? el : null;
    };

    const show = (el: HTMLElement) => {
      // 標準の吹き出しと二重にならないよう、title を data-tip に移す
      const t = el.getAttribute('title');
      if (t) {
        el.dataset.tip = t;
        el.removeAttribute('title');
      }
      const text = el.dataset.tip;
      if (!text) return;
      const r = el.getBoundingClientRect();
      const below = r.bottom + 44 < window.innerHeight;
      setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
    };

    const onOver = (e: Event) => {
      const el = target(e);
      if (el === current.current) return;
      current.current = el;
      window.clearTimeout(timer.current);
      setTip(null);
      setShift(0);
      if (el) timer.current = window.setTimeout(() => show(el), DELAY_MS);
    };
    const hide = () => {
      window.clearTimeout(timer.current);
      current.current = null;
      setTip(null);
    };
    const onOut = (e: Event) => {
      const to = (e as MouseEvent).relatedTarget as Node | null;
      if (current.current && to && current.current.contains(to)) return;
      hide();
    };

    root.addEventListener('pointerover', onOver);
    root.addEventListener('pointerout', onOut);
    root.addEventListener('pointerdown', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('pointerout', onOut);
      root.removeEventListener('pointerdown', hide);
      window.removeEventListener('scroll', hide, true);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      ref={box}
      className={`c-tooltip ${tip.below ? 'is-below' : 'is-above'}`}
      role="tooltip"
      style={{ left: tip.x + shift, top: tip.y }}
    >
      {tip.text}
    </div>
  );
}
