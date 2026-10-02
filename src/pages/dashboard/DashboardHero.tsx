// Dải chào đầu trang Tổng quan: nền bạc hà nhạt sọc cỏ (không dùng khối màu đậm), lời chào, nút tắt
// và hàng 4 số liệu (Stat trắng nằm trên dải). Chữ giữ màu tối để hòa với phần còn lại của trang.
import type { ReactNode } from 'react';

export function DashboardHero({ eyebrow, title, actions, children }: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <section data-reveal className="turf-soft relative overflow-hidden rounded-3xl p-5 ring-1 ring-emerald-900/6 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-sm font-medium text-emerald-800/70">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-[1.75rem]">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>}
    </section>
  );
}
