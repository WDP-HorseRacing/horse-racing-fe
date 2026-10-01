// Dải chào đầu trang Tổng quan: nền xanh rừng sọc cỏ, lời chào lớn, nút tắt và 4 số liệu đếm động.
// Số liệu bình thường để trắng; chỉ tô hổ phách / đỏ nhạt khi có việc cần chú ý (giống Stat của ui).
import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { cn } from '../../components/ui';
import { prefersReducedMotion } from '../../lib/motion';

gsap.registerPlugin(useGSAP);

type Tone = 'default' | 'success' | 'warning' | 'danger';

/** Số đếm từ 0 lên khi vào trang (chỉ với số; chuỗi như tiền thì hiện thẳng). */
function CountUp({ value }: { value: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      if (typeof value !== 'number' || !ref.current || prefersReducedMotion() || value === 0) return;
      const counter = { n: 0 };
      gsap.to(counter, {
        n: value,
        duration: 1.1,
        ease: 'power3.out',
        delay: 0.15,
        onUpdate: () => {
          if (ref.current) ref.current.textContent = String(Math.round(counter.n));
        },
      });
    },
    { dependencies: [value] },
  );
  return <span ref={ref}>{value}</span>;
}

export function HeroStat({
  value,
  label,
  icon,
  tone = 'default',
  onClick,
  hint,
}: {
  value: ReactNode;
  label: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  onClick?: () => void;
  hint?: ReactNode;
}) {
  const quiet = value === 0 || value === '0' || tone === 'default' || tone === 'success';
  const valueTone = quiet ? 'text-white' : tone === 'danger' ? 'text-red-300' : 'text-amber-300';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative flex min-w-0 flex-col justify-between gap-3 rounded-2xl bg-white/[0.07] p-4 text-left ring-1 ring-white/12 backdrop-blur-sm transition disabled:cursor-default',
        onClick && 'hover:-translate-y-0.5 hover:bg-white/[0.12] hover:ring-white/25',
      )}
    >
      <span className="flex items-center justify-between gap-2 text-emerald-100/60">
        {icon}
        {!quiet && <span className={cn('h-2 w-2 rounded-full', tone === 'danger' ? 'bg-red-400' : 'bg-amber-400')} />}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-3xl font-bold leading-none tabular-nums', valueTone)}>
          <CountUp value={value} />
        </span>
        <span className="mt-1.5 block text-sm text-emerald-50/85">{label}</span>
        {hint && <span className="mt-0.5 block truncate text-xs text-emerald-100/55">{hint}</span>}
      </span>
    </button>
  );
}

export function DashboardHero({ eyebrow, title, actions, children }: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <section data-reveal className="turf-dark relative overflow-hidden rounded-3xl p-6 text-white shadow-[0_30px_60px_-40px_rgba(6,78,59,0.9)] sm:p-8">
      <div className="relative grid gap-6 lg:grid-cols-12 lg:items-end">
        <div className="min-w-0 lg:col-span-5">
          {eyebrow && <p className="text-sm text-emerald-200/75">{eyebrow}</p>}
          <h1 className="mt-1.5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{title}</h1>
          {actions && <div className="hero-actions mt-5 flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-7">{children}</div>}
      </div>
    </section>
  );
}
