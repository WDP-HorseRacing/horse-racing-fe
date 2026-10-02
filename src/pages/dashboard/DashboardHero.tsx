// Dải chào đầu trang Tổng quan: nền xanh rừng sọc cỏ, lời chào lớn, nút tắt và 4 số liệu đếm động.
// Số liệu bình thường để trắng; chỉ tô hổ phách / đỏ nhạt khi có việc cần chú ý (giống Stat của ui).
import React, { useRef, type ReactNode } from 'react';
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
  const valueTone = quiet ? 'text-gray-900' : tone === 'danger' ? 'text-red-600' : 'text-amber-600';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative flex min-w-0 flex-col justify-start gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-gray-200/80 shadow-sm transition disabled:cursor-default',
        onClick && 'hover:-translate-y-0.5 hover:ring-gray-300 hover:shadow-md',
      )}
    >
      <span className="flex items-center justify-between gap-2 text-gray-400">
        {icon}
        {!quiet && <span className={cn('h-2 w-2 rounded-full', tone === 'danger' ? 'bg-red-500' : 'bg-amber-500')} />}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-3xl font-bold leading-none tabular-nums', valueTone)}>
          <CountUp value={value} />
        </span>
        <span className="mt-1.5 block text-sm font-medium text-gray-500">{label}</span>
        {hint && <span className="mt-0.5 block truncate text-xs text-gray-400">{hint}</span>}
      </span>
    </button>
  );
}

export function DashboardHero({ eyebrow, title, actions, children }: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  const childrenArray = React.Children.toArray(children);
  return (
    <section data-reveal className="relative overflow-hidden rounded-3xl bg-gray-50 p-6 ring-1 ring-gray-200/80 shadow-sm sm:p-8">
      <div className="relative z-10 grid gap-6 lg:grid-cols-12 lg:items-end">
        <div className="min-w-0 lg:col-span-5">
          {eyebrow && <p className="text-sm font-medium text-gray-500">{eyebrow}</p>}
          <h1 className="mt-1.5 text-3xl font-bold leading-tight tracking-tight text-gray-900 sm:text-4xl">{title}</h1>
          {actions && <div className="hero-actions mt-5 flex flex-wrap gap-2">{actions}</div>}
        </div>
        {childrenArray.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.5fr_1fr_1fr] lg:col-span-7">
            {childrenArray.length === 4 ? (
              <>
                <div className="col-span-2 flex flex-col sm:col-span-1 sm:row-span-2 [&>*]:flex-1">
                  {childrenArray[0]}
                </div>
                <div className="col-span-1 sm:col-span-2">
                  {childrenArray[1]}
                </div>
                <div className="col-span-1">
                  {childrenArray[2]}
                </div>
                <div className="col-span-1">
                  {childrenArray[3]}
                </div>
              </>
            ) : (
              children
            )}
          </div>
        )}
      </div>
    </section>
  );
}
