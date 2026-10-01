// Khung chờ theo đúng hình trang: người dùng thấy bố cục sắp hiện thay vì vài thanh xám chung chung.
// Bọc ngoài là `.skeleton-delay`: chỉ hiện sau ~150ms nên API trả nhanh thì không bị nháy.
import type { ReactNode } from 'react';
import { cn } from './ui';

export function Bone({ className = '' }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

function Frame({ children, className = '', label = 'Đang tải' }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn('skeleton-delay', className)} role="status" aria-live="polite" aria-label={label}>
      {children}
    </div>
  );
}

function CardBones({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200/70', className)}>
      <Bone className="h-4 w-32" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Bone className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3 w-2/3" />
            <Bone className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HeaderBones() {
  return (
    <div className="space-y-2">
      <Bone className="h-8 w-56" />
      <Bone className="h-3.5 w-96 max-w-full" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <Frame className="space-y-5">
      <HeaderBones />
      <div className="grid gap-4 lg:grid-cols-12">
        <Bone className="h-64 rounded-2xl lg:col-span-8" />
        <Bone className="h-64 rounded-2xl lg:col-span-4" />
      </div>
      <Bone className="h-40 rounded-2xl" />
    </Frame>
  );
}

function ZoneBones({ cells = 9 }: { cells?: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/70 sm:p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="space-y-1.5">
          <Bone className="h-5 w-24" />
          <Bone className="h-3 w-36" />
        </div>
        <Bone className="h-6 w-10" />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: cells }, (_, index) => (
          <Bone key={index} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function StableMapSkeleton() {
  return (
    <Frame className="space-y-5" label="Đang tải sơ đồ chuồng">
      <HeaderBones />
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4 xl:col-span-3">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 ring-1 ring-gray-200/70">
            {Array.from({ length: 4 }, (_, index) => (
              <Bone key={index} className="h-14 rounded-xl" />
            ))}
          </div>
          <CardBones rows={3} />
          <CardBones rows={2} />
        </div>
        <div className="space-y-4 lg:col-span-8 xl:col-span-9">
          <Bone className="h-3.5 w-80 max-w-full" />
          <div className="grid gap-4 xl:grid-cols-2">
            <ZoneBones />
            <ZoneBones />
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function HorseDetailSkeleton() {
  return (
    <Frame className="space-y-5" label="Đang tải hồ sơ ngựa">
      <Bone className="h-4 w-32" />
      <div className="grid gap-5 rounded-3xl bg-white p-3 ring-1 ring-gray-200/70 sm:p-4 lg:grid-cols-12">
        <Bone className="aspect-[4/3] rounded-2xl lg:col-span-5" />
        <div className="space-y-4 py-2 lg:col-span-7 lg:pr-3">
          <div className="flex gap-2">
            <Bone className="h-6 w-24 rounded-full" />
            <Bone className="h-6 w-20 rounded-full" />
          </div>
          <Bone className="h-12 w-2/3" />
          <Bone className="h-4 w-1/2" />
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Bone key={index} className={cn('h-16 rounded-xl', index === 1 && 'sm:col-span-2')} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Bone className="h-10 w-28 rounded-xl" />
        <Bone className="h-10 w-24 rounded-xl" />
        <Bone className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Bone className="h-56 rounded-2xl lg:col-span-2" />
        <Bone className="h-56 rounded-2xl" />
      </div>
    </Frame>
  );
}

export function HorseRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Frame className="divide-y divide-gray-100" label="Đang tải danh sách ngựa">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3">
          <Bone className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3.5 w-40" />
            <Bone className="h-2.5 w-24" />
          </div>
          <Bone className="hidden h-3 w-24 sm:block" />
          <Bone className="hidden h-3 w-20 md:block" />
          <Bone className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </Frame>
  );
}

export function HorseCardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <Frame className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4" label="Đang tải danh sách ngựa">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200/70">
          <Bone className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-3.5">
            <Bone className="h-4 w-2/3" />
            <Bone className="h-3 w-1/2" />
            <Bone className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </Frame>
  );
}

export function MedicalBoardSkeleton() {
  return (
    <Frame className="space-y-5" label="Đang tải bảng điều khiển y tế">
      <HeaderBones />
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Bone key={index} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <CardBones rows={4} />
          <CardBones rows={2} />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <CardBones rows={4} />
        </div>
      </div>
      <div className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-gray-200/70 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Bone key={index} className="h-48 rounded-xl" />
        ))}
      </div>
    </Frame>
  );
}

export function DashboardSkeleton() {
  return (
    <Frame className="space-y-5" label="Đang tải tổng quan">
      <Bone className="h-44 rounded-3xl" />
      <div className="grid gap-4 lg:grid-cols-12">
        <Bone className="h-80 rounded-2xl lg:col-span-7" />
        <Bone className="h-80 rounded-2xl lg:col-span-5" />
        <Bone className="h-56 rounded-2xl lg:col-span-5" />
        <Bone className="h-56 rounded-2xl lg:col-span-7" />
      </div>
    </Frame>
  );
}

/** Màn chờ khi khởi động phiên (đang kiểm tra đăng nhập). */
export function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas p-8" role="status" aria-label="Đang khởi động">
      <div className="relative h-14 w-14">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-emerald-500/20" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-[0_18px_36px_-16px_rgba(6,78,59,0.7)]">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 22c-.2-7 .9-12.8 3.2-16.7l.4-3 2 2.1c3.9 1.6 7.6 5.4 10.2 9.6.8 1.4.3 3.5-1.3 4.1-1.4.5-3.1.2-4.5-.6-1.4-.8-2.9-1.2-4-.7-.5 1.6 0 3.5 1 5.2" />
          </svg>
        </span>
      </div>
      <p className="text-sm text-gray-500">Đang mở HorseRacing…</p>
    </div>
  );
}
