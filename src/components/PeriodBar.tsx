// Thanh chọn kỳ cho các trang báo cáo: hai ô ngày và ba nút nhanh. Từ ngày sau đến ngày thì báo ngay, không gọi API.
import type { ReactNode } from 'react';
import type { Period, PeriodPreset } from '../hooks/usePeriod';
import { cn } from './ui';
import { DatePicker } from './ui/DatePicker';

const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: 'month', label: 'Tháng này' },
];

export function PeriodBar({ period, children, className }: { period: Period; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-500">
          Từ
          <DatePicker value={period.from} max={period.to || undefined} onChange={period.setFrom} size="sm" className="w-36" clearable={false} invalid={period.invalid} />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-500">
          đến
          <DatePicker value={period.to} min={period.from || undefined} onChange={period.setTo} size="sm" className="w-36" clearable={false} invalid={period.invalid} />
        </label>
        <div className="flex rounded-xl bg-gray-100 p-0.5" role="group" aria-label="Chọn nhanh kỳ">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => period.applyPreset(preset.key)}
              aria-pressed={period.activePreset === preset.key}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition',
                period.activePreset === preset.key ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {children}
      </div>
      {period.invalid && <p className="text-sm text-red-600">Từ ngày phải trước hoặc bằng đến ngày.</p>}
    </div>
  );
}
