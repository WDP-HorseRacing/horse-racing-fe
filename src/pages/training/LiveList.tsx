// Các buổi đang diễn ra — mỗi buổi một luồng dữ liệu chung cho mọi ngựa; bấm để mở bảng theo dõi.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, ArrowUpRight, Radio, Timer } from 'lucide-react';
import { Avatar, Button, Card, EmptyState, ErrorBox, PageHeader, Pill, Skeleton, cn } from '../../components/ui';
import { IntensityMeter } from '../../components/ui/status';
import { useService } from '../../hooks/useService';
import { listLiveSessions, type LiveSessionRow } from '../../services/session.service';
import { links } from '../../lib/links';
import { formatTime } from '../../lib/format';
import { secondText, workoutText } from './components/session-helpers';

export default function LiveList() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useService(() => listLiveSessions(), []);

  useEffect(() => {
    const timer = window.setInterval(reload, 3000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const rows = data ?? [];
  const alarms = rows.reduce((sum, row) => sum + row.unackedRed, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đang diễn ra"
        description="Cảnh báo đỏ (vượt nhịp tim tối đa, nghi chấn thương) cần HT của khu hoặc bác sĩ xác nhận."
        actions={
          <Button variant="secondary" onClick={() => navigate(links.today)}>
            Buổi tập hôm nay
          </Button>
        }
      />

      {alarms > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-600 px-5 py-3.5 text-white">
          <AlertOctagon size={20} className="animate-pulse" />
          <p className="font-semibold">{alarms} cảnh báo đỏ đang chờ xác nhận</p>
        </div>
      )}

      {error && <ErrorBox message={error} />}
      {loading && !data && <Skeleton rows={3} />}

      {data && rows.length === 0 && (
        <EmptyState
          title="Hiện không có buổi nào đang diễn ra"
          hint="Khi Groom hoặc HT bấm Bắt đầu một buổi, buổi đó xuất hiện ở đây cùng số ngựa và cảnh báo."
          action={
            <Button variant="secondary" onClick={() => navigate(links.today)}>
              Xem buổi hôm nay
            </Button>
          }
        />
      )}

      {rows.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-12">
          {rows.map((row, index) => (
            <LiveCard
              key={row.id}
              row={row}
              className={index % 4 === 0 || index % 4 === 3 ? 'lg:col-span-7' : 'lg:col-span-5'}
              onOpen={() => navigate(links.session(row.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LiveCard({ row, className, onOpen }: { row: LiveSessionRow; className: string; onOpen: () => void }) {
  const alarm = row.unackedRed > 0;
  return (
    <button type="button" onClick={onOpen} className={cn('group text-left', className)}>
      <Card
        tone={alarm ? 'danger' : 'default'}
        className={cn('h-full transition-colors duration-200 group-hover:ring-gray-300', alarm && 'ring-2 ring-red-400')}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm text-gray-500 tabular-nums">
              <Radio size={14} className="animate-pulse text-emerald-600" /> {row.slotLabel}
              {row.zoneName ? ` · ${row.zoneName}` : ''}
            </p>
            <p className="mt-1 truncate text-xl font-bold tracking-tight text-gray-900">{row.className}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span>{workoutText(row)}</span>
              <IntensityMeter intensity={row.intensity} />
            </div>
          </div>
          <ArrowUpRight size={20} className="shrink-0 text-gray-400 transition group-hover:text-gray-700" />
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <Timer size={13} className="text-gray-400" /> Đã chạy
            </p>
            <p className="text-3xl font-bold tabular-nums text-gray-900">{secondText(row.second)}</p>
            <p className="text-xs text-gray-500 tabular-nums">
              từ {formatTime(row.startedAt)} · mô phỏng ×{row.simSpeed}
            </p>
          </div>
          <div className="flex -space-x-2">
            {row.horses.map((horse) => (
              <span
                key={horse.id}
                title={`${horse.name}${horse.stopped ? ', đã dừng' : ''}${horse.hasRed ? ', cảnh báo đỏ' : ''}`}
                className={cn(
                  'rounded-[14px] ring-2',
                  horse.hasRed ? 'ring-red-500' : 'ring-white',
                  horse.stopped && 'opacity-50 grayscale',
                )}
              >
                <Avatar src={horse.avatar} name={horse.name} size={40} />
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray-100 pt-3 text-sm text-gray-600 tabular-nums">
          <span>{row.horses.length} ngựa có mặt</span>
          {row.absentCount > 0 && <span className="text-amber-700">{row.absentCount} vắng</span>}
          {row.horses.some((horse) => horse.stopped) && (
            <span>{row.horses.filter((horse) => horse.stopped).length} đã dừng</span>
          )}
          {alarm && (
            <Pill tone="red" pulse>
              <AlertOctagon size={11} /> {row.unackedRed} cảnh báo đỏ chưa xác nhận
            </Pill>
          )}
        </div>
      </Card>
    </button>
  );
}
