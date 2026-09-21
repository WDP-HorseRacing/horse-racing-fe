import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock, TrendingUp } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getProgressBoard, getZoneSummary } from '../../services/training.service';
import { useStore } from '../../store/store';
import { Avatar, Card, DataTable, PageHeader, Pill, SectionTitle, Skeleton, type Column } from '../../components/ui';
import { HealthPill } from '../../components/ui/status';
import type { ProgressRow } from '../../services/training.service';

export default function ProgressBoard() {
  const navigate = useNavigate();
  const role = useStore((state) => state.currentUser?.role);
  const { data, loading } = useService(() => getProgressBoard(), []);
  const zones = useService(() => getZoneSummary(), []);

  const columns: Column<ProgressRow>[] = [
    {
      key: 'horse',
      header: 'Ngựa',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.horseAvatar} name={row.horseName} size={36} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">{row.horseName}</p>
            <p className="text-xs text-gray-400">{row.zoneName ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <HealthPill status={row.healthStatus as never} />
          {row.locked && (
            <Pill tone="red">
              <Lock size={11} /> Khóa
            </Pill>
          )}
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Giáo án',
      render: (row) => (
        <div className="min-w-0">
          {row.planName ? (
            <>
              <p className="truncate text-sm font-medium text-gray-700">{row.planName}</p>
              <p className="text-xs text-gray-400">{row.phaseLabel}</p>
            </>
          ) : (
            <Pill tone="gray">Chưa có giáo án</Pill>
          )}
          {row.planTag === 'ENDING_SOON' && (
            <span className="mt-1 inline-block">
              <Pill tone="amber">Sắp hết giáo án</Pill>
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'week',
      header: 'Tuần này',
      render: (row) => (
        <span className="text-sm text-gray-700 tabular-nums">
          {row.weekDone}/{row.weekPlanned} buổi
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Điểm 7 ngày',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-800 tabular-nums">
          {row.score7 !== null ? row.score7.toFixed(1) : '—'}
        </span>
      ),
    },
    {
      key: 'alerts',
      header: 'Cảnh báo 7 ngày',
      render: (row) =>
        row.alerts7 > 0 ? (
          <Pill tone="red">
            <AlertTriangle size={11} /> {row.alerts7}
          </Pill>
        ) : (
          <span className="text-sm text-gray-300">0</span>
        ),
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Tiến độ huấn luyện"
        description="Ngựa có cảnh báo, ngựa đang bị chặn tập và ngựa cần giáo án được xếp lên đầu."
      />

      {(role === 'CLUB_MANAGER' || role === 'HEAD_TRAINER') && (
        <Card>
          <SectionTitle icon={<TrendingUp size={16} className="text-emerald-600" />}>Tổng hợp theo khu</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            {zones.data?.map((zone) => (
              <div key={zone.zoneId} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-800">{zone.zoneName}</p>
                <div className="mt-2 flex gap-5 text-sm">
                  <span className="text-gray-500">
                    <span className="font-bold text-gray-900 tabular-nums">{zone.horseCount}</span> ngựa
                  </span>
                  <span className="text-gray-500">
                    <span className="font-bold text-gray-900 tabular-nums">{zone.sessionCount}</span> buổi
                  </span>
                  <span className={zone.alerts7 > 0 ? 'text-red-600' : 'text-gray-500'}>
                    <span className="font-bold tabular-nums">{zone.alerts7}</span> cảnh báo
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <DataTable
          rows={data ?? []}
          columns={columns}
          rowKey={(row) => row.horseId}
          onRowClick={(row) => navigate(`/horses/${row.horseId}?tab=training`)}
          pageSize={20}
          emptyTitle="Chưa có ngựa nào đang hoạt động"
        />
      )}
    </div>
  );
}
