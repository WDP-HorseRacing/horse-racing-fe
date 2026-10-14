// Kỳ báo cáo dùng chung: từ ngày, đến ngày ('YYYY-MM-DD' theo lịch CLB). Mặc định 30 ngày tính tới hôm nay, giống BE.
import { useState } from 'react';
import { now } from '../lib/clock';
import { addDateKey, clubDateKey } from '../lib/club-time';

export type PeriodPreset = '7d' | '30d' | 'month';

export function presetRange(preset: PeriodPreset): { from: string; to: string } {
  const today = clubDateKey(now());
  if (preset === 'month') return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: addDateKey(today, preset === '7d' ? -6 : -29), to: today };
}

export function usePeriod(initial: PeriodPreset = '30d') {
  const [range, setRange] = useState(() => presetRange(initial));
  const invalid = !range.from || !range.to || range.from > range.to;
  return {
    ...range,
    invalid,
    setFrom: (from: string) => setRange((value) => ({ ...value, from })),
    setTo: (to: string) => setRange((value) => ({ ...value, to })),
    applyPreset: (preset: PeriodPreset) => setRange(presetRange(preset)),
    /** Nút nhanh nào đang khớp kỳ hiện tại. */
    activePreset: (['7d', '30d', 'month'] as PeriodPreset[]).find((preset) => {
      const match = presetRange(preset);
      return match.from === range.from && match.to === range.to;
    }),
  };
}

export type Period = ReturnType<typeof usePeriod>;
