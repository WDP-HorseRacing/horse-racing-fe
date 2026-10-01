// Thanh tiến trình mảnh trên cùng: chỉ hiện khi tải lâu hơn 120ms, chạy chậm dần tới 90%,
// xong thì chạy hết rồi mờ đi. Dữ liệu cũ vẫn hiện bên dưới trong lúc tải lại.
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { subscribeProgress } from '../lib/progress';
import { prefersReducedMotion } from '../lib/motion';

gsap.registerPlugin(useGSAP);

export function TopProgress() {
  const bar = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const { contextSafe } = useGSAP({ scope: root });

  useEffect(() => {
    let showTimer: number | undefined;
    let shownAt = 0;
    let visible = false;
    const reduced = prefersReducedMotion();

    const show = contextSafe(() => {
      visible = true;
      shownAt = performance.now();
      gsap.killTweensOf(bar.current);
      gsap.set(bar.current, { autoAlpha: 1, scaleX: 0.04 });
      if (reduced) gsap.set(bar.current, { scaleX: 0.6 });
      else gsap.to(bar.current, { scaleX: 0.9, duration: 8, ease: 'power3.out' });
    });
    const finish = contextSafe(() => {
      const wait = Math.max(0, 300 - (performance.now() - shownAt)) / 1000;
      gsap.killTweensOf(bar.current);
      gsap
        .timeline({ delay: wait, onComplete: () => void (visible = false) })
        .to(bar.current, { scaleX: 1, duration: reduced ? 0 : 0.25, ease: 'power2.out' })
        .to(bar.current, { autoAlpha: 0, duration: reduced ? 0 : 0.3 }, '+=0.05');
    });

    const unsubscribe = subscribeProgress((count) => {
      if (count > 0) {
        if (!visible && showTimer === undefined) {
          showTimer = window.setTimeout(() => {
            showTimer = undefined;
            show();
          }, 120);
        }
      } else {
        if (showTimer !== undefined) {
          window.clearTimeout(showTimer);
          showTimer = undefined;
        }
        if (visible) finish();
      }
    });
    return () => {
      unsubscribe();
      if (showTimer !== undefined) window.clearTimeout(showTimer);
    };
  }, [contextSafe]);

  return (
    <div ref={root} className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5" aria-hidden>
      <div ref={bar} className="invisible h-full origin-left bg-emerald-500 opacity-0 shadow-[0_0_10px_rgba(16,185,129,0.7)] will-change-transform" />
    </div>
  );
}
