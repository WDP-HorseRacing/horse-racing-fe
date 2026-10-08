// Bộ hoạt ảnh GSAP của Flow 2. Chuyển động để kể trạng thái: thẻ đổi cột vì lượt đổi trạng thái,
// tim đập vì có nhịp tim thật, thẻ rung vì vượt ngưỡng nguy hiểm. Người dùng bật giảm chuyển động thì chỉ đổi màu.
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { Flip, gsap, useGSAP } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { cn } from '../../../components/ui';
import type { MetricAlertLevel, MetricPoint, ThresholdLimits } from '../../../api/types';

/* ===== Flip: phần tử đổi chỗ thì trượt sang chỗ mới ===== */

/**
 * Mỗi lần render chụp vị trí các phần tử `[data-flip-id]` trong `scope`. Khi `key` đổi (ví dụ trạng thái các lượt),
 * phần tử trượt từ chỗ cũ sang chỗ mới, phần tử mới hiện dần. Cuộn trang thì chụp lại để không trượt sai.
 */
export function useFlip(scope: RefObject<HTMLElement | null>, key: string, options: { duration?: number; enter?: boolean } = {}) {
  const snapshot = useRef<Flip.FlipState | null>(null);
  const lastKey = useRef(key);
  const duration = options.duration ?? 0.5;

  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>('[data-flip-id]');
    if (snapshot.current && lastKey.current !== key && !prefersReducedMotion()) {
      Flip.from(snapshot.current, {
        targets,
        duration,
        ease: 'power2.inOut',
        nested: true,
        prune: true,
        onEnter: options.enter === false ? undefined : (elements) => gsap.fromTo(elements, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out' }),
      });
    }
    lastKey.current = key;
    snapshot.current = Flip.getState(targets);
  });

  useEffect(() => {
    const scroller = document.getElementById('main-scroll');
    if (!scroller) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (scope.current) snapshot.current = Flip.getState(scope.current.querySelectorAll('[data-flip-id]'));
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', onScroll);
    };
  }, [scope]);
}

/* ===== Tim đập đúng nhịp ===== */

export function HeartbeatIcon({ bpm, level = 'NORMAL', size = 22, className = '' }: { bpm?: number; level?: MetricAlertLevel; size?: number; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      if (!ref.current || prefersReducedMotion()) return;
      timeline.current = gsap
        .timeline({ repeat: -1, paused: true })
        .to(ref.current, { scale: 1.22, duration: 1, ease: 'heartbeat', transformOrigin: '50% 55%' });
    },
    { scope: ref },
  );

  useEffect(() => {
    const tl = timeline.current;
    if (!tl) return;
    if (!bpm || bpm <= 0) {
      tl.pause(0);
      return;
    }
    // Một vòng timeline là 1 giây: nhịp bpm/60 vòng mỗi giây. Kẹp để không giật khi số đo lạ.
    tl.timeScale(Math.min(4, Math.max(0.5, bpm / 60)));
    if (tl.paused()) tl.play();
  }, [bpm]);

  const color = level === 'CRITICAL' ? 'text-red-600' : level === 'WARNING' ? 'text-amber-500' : 'text-emerald-600';
  return (
    <svg ref={ref} viewBox="0 0 24 24" width={size} height={size} className={cn('shrink-0', color, className)} aria-hidden>
      <path
        fill="currentColor"
        d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2 0 3.6 1.1 5.4 3.2 1.8-2.1 3.4-3.2 5.4-3.2 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z"
      />
    </svg>
  );
}

/* ===== Số chạy mượt tới giá trị mới ===== */

export function LiveNumber({ value, digits = 0, className = '' }: { value: number | null | undefined; digits?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const proxy = useRef({ n: value ?? 0 });
  const format = (n: number) => n.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (value === null || value === undefined) {
      node.textContent = '—';
      return;
    }
    // Tab ẩn thì trình duyệt dừng khung hình, tween không chạy: ghi thẳng số mới.
    if (prefersReducedMotion() || document.hidden) {
      proxy.current.n = value;
      node.textContent = format(value);
      return;
    }
    const tween = gsap.to(proxy.current, {
      n: value,
      duration: 0.45,
      ease: 'power2.out',
      onUpdate: () => {
        node.textContent = format(proxy.current.n);
      },
      onInterrupt: () => {
        node.textContent = format(value);
      },
    });
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, digits]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {value === null || value === undefined ? '—' : format(value)}
    </span>
  );
}

/* ===== Đường nhịp tim 60 giây gần nhất, có vùng ngưỡng ===== */

export function LiveTrace({
  points,
  limits,
  windowSeconds = 60,
  height = 64,
  className = '',
}: {
  points: MetricPoint[];
  limits: ThresholdLimits;
  windowSeconds?: number;
  height?: number;
  className?: string;
}) {
  const width = 240;
  const latest = points[points.length - 1];
  const end = latest ? new Date(latest.recordedAt).getTime() : Date.now();
  const start = end - windowSeconds * 1000;
  const recent = points.filter((point) => new Date(point.recordedAt).getTime() >= start);
  const top = Math.max(limits.heartRateCriticalBpm + 20, ...recent.map((point) => point.heartRateBpm + 10));
  const bottom = 50;
  const y = (bpm: number) => height - ((Math.min(top, Math.max(bottom, bpm)) - bottom) / (top - bottom)) * height;
  const x = (time: number) => ((time - start) / (windowSeconds * 1000)) * width;
  const path = recent
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(new Date(point.recordedAt).getTime()).toFixed(1)},${y(point.heartRateBpm).toFixed(1)}`)
    .join(' ');
  const warnY = y(limits.heartRateWarningBpm);
  const critY = y(limits.heartRateCriticalBpm);
  const tip = recent[recent.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn('block w-full', className)} style={{ height }} aria-hidden>
      <rect x={0} y={0} width={width} height={critY} className="fill-red-50" />
      <rect x={0} y={critY} width={width} height={Math.max(0, warnY - critY)} className="fill-amber-50" />
      <line x1={0} x2={width} y1={warnY} y2={warnY} className="stroke-amber-300" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <line x1={0} x2={width} y1={critY} y2={critY} className="stroke-red-300" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      {path && <path d={path} fill="none" className="stroke-emerald-700" strokeWidth={1.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      {tip && (
        <circle
          cx={x(new Date(tip.recordedAt).getTime())}
          cy={y(tip.heartRateBpm)}
          r={3}
          className={tip.alertLevel === 'CRITICAL' ? 'fill-red-600' : tip.alertLevel === 'WARNING' ? 'fill-amber-500' : 'fill-emerald-700'}
        />
      )}
    </svg>
  );
}

/* ===== Thẻ phản ứng khi vượt ngưỡng ===== */

/**
 * WARNING: viền hổ phách phập phồng hai lần. CRITICAL: thẻ rung ngang ba nhịp, viền đỏ phập phồng lặp tới khi `acknowledged`.
 * Giảm chuyển động: không rung, không phập phồng (màu thẻ vẫn đổi theo class).
 */
export function useAlertPulse(ref: RefObject<HTMLElement | null>, level: MetricAlertLevel, acknowledged: boolean) {
  const loop = useRef<gsap.core.Tween | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    loop.current?.kill();
    loop.current = null;
    if (level === 'WARNING') {
      gsap.fromTo(
        node,
        { boxShadow: '0 0 0 0 rgba(245,158,11,0.55)' },
        { boxShadow: '0 0 0 10px rgba(245,158,11,0)', duration: 0.8, repeat: 1, ease: 'power2.out', clearProps: 'boxShadow' },
      );
    }
    if (level === 'CRITICAL') {
      gsap.fromTo(node, { x: 0 }, { keyframes: { x: [0, -7, 7, -5, 5, -2, 0] }, duration: 0.55, ease: 'power1.inOut', clearProps: 'x' });
      if (!acknowledged) {
        loop.current = gsap.fromTo(
          node,
          { boxShadow: '0 0 0 0 rgba(220,38,38,0.6)' },
          { boxShadow: '0 0 0 14px rgba(220,38,38,0)', duration: 1, repeat: -1, ease: 'power2.out' },
        );
      }
    }
    return () => {
      loop.current?.kill();
      if (node) gsap.set(node, { clearProps: 'boxShadow' });
    };
  }, [ref, level, acknowledged]);
}

/* ===== Vẽ nét SVG từ trái sang ===== */

/** Vẽ dần mọi `[data-draw]` trong scope mỗi khi `key` đổi (đường biểu đồ, dấu tích). */
export function useDrawIn(scope: RefObject<HTMLElement | SVGElement | null>, key: unknown, duration = 1.1) {
  useGSAP(
    () => {
      if (!scope.current || prefersReducedMotion()) return;
      const paths = scope.current.querySelectorAll('[data-draw]');
      if (paths.length === 0) return;
      gsap.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration, ease: 'power2.inOut', stagger: 0.12 });
      const dots = scope.current.querySelectorAll('[data-pop]');
      if (dots.length) gsap.fromTo(dots, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.35, ease: 'back.out(2.4)', stagger: 0.04, delay: duration * 0.6 });
    },
    { scope, dependencies: [key], revertOnUpdate: true },
  );
}

/* ===== Thanh tiến độ chạy từ 0 ===== */

export function ProgressFill({ ratio, tone = 'green', className = '', delay = 0 }: { ratio: number; tone?: 'green' | 'amber' | 'gray'; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const clamped = Math.min(1, Math.max(0, ratio));
  useGSAP(
    () => {
      if (!ref.current || prefersReducedMotion()) return;
      gsap.fromTo(ref.current, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power3.out', delay, transformOrigin: 'left center' });
    },
    { scope: ref, dependencies: [clamped] },
  );
  const fill = { green: 'bg-emerald-600', amber: 'bg-amber-500', gray: 'bg-gray-400' }[tone];
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-gray-200/70', className)}>
      <div ref={ref} className={cn('h-full origin-left rounded-full', fill)} style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

/* ===== Điểm đánh giá hình móng ngựa ===== */

export function ScoreHorseshoe({ score, size = 132 }: { score: number; size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  // Cung 270 độ mở ở dưới như chiếc móng ngựa.
  const radius = 44;
  const arc = useMemo(() => {
    const point = (deg: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return `${(60 + radius * Math.cos(rad)).toFixed(2)},${(60 + radius * Math.sin(rad)).toFixed(2)}`;
    };
    return `M${point(-135)} A${radius},${radius} 0 1 1 ${point(135)}`;
  }, []);
  const ratio = Math.min(1, Math.max(0, score / 10));

  useGSAP(
    () => {
      if (!ref.current) return;
      const value = ref.current.querySelector('[data-score-arc]');
      if (!value) return;
      if (prefersReducedMotion()) {
        gsap.set(value, { drawSVG: `0% ${ratio * 100}%` });
        return;
      }
      gsap.fromTo(value, { drawSVG: '0% 0%' }, { drawSVG: `0% ${ratio * 100}%`, duration: 0.9, ease: 'power3.out' });
    },
    { scope: ref, dependencies: [ratio] },
  );

  return (
    <svg ref={ref} viewBox="0 0 120 120" width={size} height={size} aria-label={`Điểm ${score} trên 10`}>
      <path d={arc} fill="none" className="stroke-gray-200" strokeWidth={12} strokeLinecap="round" />
      <path data-score-arc d={arc} fill="none" className="stroke-emerald-600" strokeWidth={12} strokeLinecap="round" />
      {/* Đinh móng ngựa */}
      {[-110, -60, 0, 60, 110].map((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        return <circle key={deg} cx={60 + radius * Math.cos(rad)} cy={60 + radius * Math.sin(rad)} r={1.6} className="fill-white" />;
      })}
      <text x={60} y={66} textAnchor="middle" className="fill-gray-900 font-mono text-[26px] font-bold">
        {score}
      </text>
      <text x={60} y={84} textAnchor="middle" className="fill-gray-400 text-[10px]">
        trên 10
      </text>
    </svg>
  );
}
