// Khung chung của các trang biểu mẫu y tế (ghi buổi khám, đóng bệnh án, tạo lịch chăm sóc):
// cột trái là các khối nhập liệu, cột phải dính theo khi cuộn gồm bối cảnh và nút lưu.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Avatar, cn } from '../../../components/ui';
import { HealthPill, LockPill } from '../../../components/ui/status';
import type { HealthStatus } from '../../../api/types';

/** Link quay lại phía trên tiêu đề trang. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900">
      <ArrowLeft size={15} /> {children}
    </Link>
  );
}

/** Một khối nhập liệu: tiêu đề + nội dung. */
export function FormSection({
  icon,
  title,
  aside,
  children,
  className = '',
}: {
  icon?: ReactNode;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80 sm:p-6', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[0.95rem] font-semibold text-gray-900">
          {icon && <span className="text-gray-400">{icon}</span>}
          {title}
        </h3>
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Thẻ lưu ở cột phải: bóng đổ ánh xanh cỏ để tách khỏi các thẻ thông tin. */
export function SaveCard({ children }: { children: ReactNode }) {
  return <div className="space-y-4 rounded-2xl bg-white p-5 shadow-[0_18px_40px_-24px_rgba(6,78,59,0.4)] ring-1 ring-emerald-900/10">{children}</div>;
}

/** Thẻ ngựa ở cột phải: tên (bấm sang hồ sơ y tế), chỗ ở, sức khỏe, khóa. */
export function HorseCard({
  name,
  to,
  place,
  health,
  locked,
  children,
}: {
  name: string;
  to?: string;
  place?: string;
  health?: HealthStatus;
  locked?: boolean;
  children?: ReactNode;
}) {
  const title = <span className="block truncate text-base font-bold text-gray-900">{name}</span>;
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200/80">
      <div className="flex items-center gap-3">
        <Avatar name={name} size={44} className="rounded-xl" />
        <div className="min-w-0">
          {to ? (
            <Link to={to} className="hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
          <p className="truncate text-xs text-gray-500">{place || 'Chưa xếp chỗ'}</p>
        </div>
      </div>
      {(health || locked) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {health && <HealthPill status={health} />}
          {locked && <LockPill />}
        </div>
      )}
      {children && <div className="mt-4 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  );
}

/** Dòng "điều sẽ xảy ra khi lưu" trong thẻ lưu. */
export function Outcome({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warning' }) {
  return (
    <li className="flex gap-2 text-sm text-gray-700">
      <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', tone === 'warning' ? 'bg-amber-500' : 'bg-emerald-600')} />
      <span className="min-w-0">{children}</span>
    </li>
  );
}
