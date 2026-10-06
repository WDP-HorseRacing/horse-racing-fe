// Các thẻ biểu đồ của trang Tổng quan. Mỗi thẻ một câu hỏi: đàn có khỏe không, chuồng còn chỗ không,
// chi phí y tế đi về đâu, khám định kỳ có đúng hạn không, yêu cầu khám tăng hay giảm.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { BarnListItem, CheckupItem, ExamRequest, HealthStatus, Stall } from '../../api/types';
import { Card, cn } from '../../components/ui';
import { DonutChart } from '../../components/charts/DonutChart';
import { StackedBars } from '../../components/charts/StackedBars';
import { ColumnChart } from '../../components/charts/ColumnChart';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { formatMoney } from '../../lib/format';
import { OCCUPANCY_SERIES, checkupSegments, compactMoney, healthSegments, occupancyRate, occupancyRows, weeklyRequests } from './charts';

function ChartCard({ title, sub, to, toLabel = 'Xem chi tiết', children, className = '' }: { title: string; sub?: ReactNode; to?: string; toLabel?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[0.95rem] font-semibold text-gray-900">{title}</h3>
          {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
        </div>
        {to && (
          <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
            {toLabel} <ArrowRight size={14} />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

export function HerdHealthCard({
  counts,
  title = 'Sức khỏe đàn',
  sub = 'Bấm một trạng thái để xem ngựa trên Bảng điều khiển y tế',
  onSelect,
  className,
}: {
  counts: Record<HealthStatus, number>;
  title?: string;
  sub?: string;
  onSelect?: (status: HealthStatus) => void;
  className?: string;
}) {
  return (
    <ChartCard title={title} sub={onSelect ? sub : undefined} className={className}>
      <DonutChart segments={healthSegments(counts)} centerLabel="ngựa" onSelect={onSelect ? (key) => onSelect(key as HealthStatus) : undefined} />
    </ChartCard>
  );
}

export function OccupancyCard({ barns, stalls, title = 'Tình trạng ô chuồng', to, onOpen, className }: { barns: BarnListItem[]; stalls: Stall[]; title?: string; to?: string; onOpen?: (barnId: string) => void; className?: string }) {
  const ids = new Set(barns.map((barn) => barn.id));
  const own = stalls.filter((stall) => ids.has(stall.barnId));
  const { rate, occupied, usable } = occupancyRate(own);
  const rows = occupancyRows(barns, own, onOpen);
  return (
    <ChartCard title={title} sub={`${occupied}/${usable} ô dùng được đang có ngựa`} to={to} toLabel="Sơ đồ chuồng" className={className}>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có khu chuồng nào.</p>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col items-center gap-1.5">
            <ProgressRing value={occupied} max={usable} size={96} stroke={9}>
              <span className="text-lg">{rate}%</span>
            </ProgressRing>
            <span className="text-xs text-gray-500">lấp đầy</span>
          </div>
          <StackedBars series={OCCUPANCY_SERIES} rows={rows} total={Math.max(...rows.map((row) => Object.values(row.values).reduce((a, b) => a + b, 0)), 1)} className="min-w-56 flex-1" />
        </div>
      )}
    </ChartCard>
  );
}

export function CostTrendCard({ months, className }: { months: { key: string; label: string; total: number; count: number }[]; className?: string }) {
  const total = months.reduce((sum, item) => sum + item.total, 0);
  const cases = months.reduce((sum, item) => sum + item.count, 0);
  return (
    <ChartCard title="Chi phí y tế 6 tháng" sub={`${formatMoney(total)} · ${cases} bệnh án đã đóng`} to="/medical/costs" toLabel="Báo cáo chi phí" className={className}>
      <ColumnChart
        caption="Chi phí y tế theo tháng"
        columns={months.map((item) => ({ key: item.key, label: item.label, value: item.total, detail: `${item.count} bệnh án đã đóng` }))}
        format={(value) => formatMoney(value)}
        formatTick={compactMoney}
      />
    </ChartCard>
  );
}

export function CheckupCard({ items, className }: { items: CheckupItem[]; className?: string }) {
  return (
    <ChartCard title="Khám định kỳ" sub="Chu kỳ 30 ngày cho mỗi ngựa" to="/medical/periodic" toLabel="Lịch khám" className={className}>
      {items.length === 0 ? <p className="text-sm text-gray-500">Chưa có dữ liệu khám định kỳ.</p> : <DonutChart segments={checkupSegments(items)} size={140} thickness={16} centerLabel="ngựa" />}
    </ChartCard>
  );
}

export function RequestTrendCard({ requests, className }: { requests: ExamRequest[]; className?: string }) {
  const columns = weeklyRequests(requests, 8);
  const last = columns[columns.length - 1]?.value ?? 0;
  const prev = columns[columns.length - 2]?.value ?? 0;
  const delta = last - prev;
  return (
    <ChartCard
      title="Yêu cầu khám 8 tuần gần nhất"
      sub={`Tuần này ${last} yêu cầu${prev || last ? ` · ${delta === 0 ? 'bằng' : delta > 0 ? `nhiều hơn ${delta}` : `ít hơn ${-delta}`} so với tuần trước` : ''}`}
      to="/medical/requests"
      toLabel="Yêu cầu khám"
      className={className}
    >
      <ColumnChart caption="Số yêu cầu khám theo tuần" columns={columns} height={170} />
    </ChartCard>
  );
}
