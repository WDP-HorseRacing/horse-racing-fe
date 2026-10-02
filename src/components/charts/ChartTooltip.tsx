// Tooltip nhỏ dùng chung cho các biểu đồ SVG: đặt theo tọa độ trong khung biểu đồ, không chặn chuột.
import type { ReactNode } from 'react';

export interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

export function ChartTooltip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  );
}
