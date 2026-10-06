// Buổi chờ đánh giá — HT chấm từng ngựa có mặt; quá 48 giờ chưa chấm được tô hổ phách.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import {
  ChipFilter,
  DataTable,
  ErrorBox,
  Meter,
  PageHeader,
  Pill,
  SearchInput,
  Skeleton,
  Toolbar,
  type Column,
} from '../../components/ui';
import { IntensityMeter } from '../../components/ui/status';
import { useService } from '../../hooks/useService';
import { listAwaitingReview, type ReviewRow } from '../../services/session.service';
import { links } from '../../lib/links';
import { formatDate, formatDateTime } from '../../lib/format';
import { workoutLabel } from '../../lib/labels';

export default function ReviewList() {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => listAwaitingReview(), []);
  const [search, setSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter(
      (row) =>
        (!overdueOnly || row.overdue) &&
        (!term || row.className.toLowerCase().includes(term) || row.subjectName.toLowerCase().includes(term)),
    );
  }, [data, search, overdueOnly]);

  const total = data?.length ?? 0;
  const overdue = data?.filter((row) => row.overdue).length ?? 0;
  const pendingHorses = data?.reduce((sum, row) => sum + row.presentCount - row.scoredCount, 0) ?? 0;

  const columns: Column<ReviewRow>[] = [
    {
      key: 'class',
      header: 'Buổi',
      render: (row) => (
        <div>
          <p className="font-semibold text-gray-900">{row.className}</p>
          <p className="text-xs text-gray-500">
            {row.subjectName} · {workoutLabel[row.workoutType]}
            {row.zoneName ? ` · ${row.zoneName}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Ngày · slot',
      render: (row) => (
        <div className="tabular-nums">
          <p className="text-gray-800">{formatDate(row.date)}</p>
          <p className="text-xs text-gray-500">{row.slotLabel}</p>
        </div>
      ),
    },
    { key: 'intensity', header: 'Cường độ', render: (row) => <IntensityMeter intensity={row.intensity} /> },
    {
      key: 'progress',
      header: 'Đã chấm',
      className: 'min-w-40',
      render: (row) => (
        <div>
          <p className="text-sm font-semibold tabular-nums text-gray-800">
            {row.scoredCount}/{row.presentCount} ngựa
            {row.absentCount > 0 && <span className="ml-1 font-normal text-gray-500">· {row.absentCount} vắng</span>}
          </p>
          <Meter value={row.scoredCount} max={row.presentCount || 1} className="mt-1.5" />
        </div>
      ),
    },
    {
      key: 'ended',
      header: 'Kết thúc',
      render: (row) => (
        <div>
          <p className="text-sm text-gray-700">{formatDateTime(row.endedAt)}</p>
          {row.endReason && row.endReason !== 'NORMAL' && (
            <Pill tone={row.endReason === 'EMERGENCY_STOP' ? 'red' : 'amber'} className="mt-1">
              {row.endLabel}
            </Pill>
          )}
        </div>
      ),
    },
    {
      key: 'wait',
      header: 'Đã chờ',
      render: (row) =>
        row.overdue ? (
          <Pill tone="amber">
            <Clock size={11} /> {row.hoursSinceEnd} giờ, quá 48 giờ
          </Pill>
        ) : (
          <span className="text-sm tabular-nums text-gray-500">{row.hoursSinceEnd} giờ</span>
        ),
    },
    {
      key: 'action',
      header: '',
      className: 'text-right',
      render: (row) => (
        <span className="text-sm font-medium text-gray-600">{row.canReview ? 'Chấm điểm →' : 'Xem →'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chờ đánh giá"
        description="Chỉ số đã chốt, buổi chuyển sang Hoàn thành khi HT chấm đủ mọi ngựa có mặt."
      />

      {error && <ErrorBox message={error} />}
      {loading && !data && <Skeleton rows={4} />}

      {data && (
        <>
          <Toolbar>
            <ChipFilter<'all' | 'overdue'>
              value={overdueOnly ? 'overdue' : 'all'}
              onChange={(value) => setOverdueOnly(value === 'overdue')}
              options={[
                { value: 'all', label: 'Tất cả buổi', count: total },
                { value: 'overdue', label: 'Quá 48 giờ', count: overdue, dot: 'warn' },
              ]}
            />
            {pendingHorses > 0 && (
              <span className="px-1 text-sm text-gray-500 tabular-nums">
                <span className="font-medium text-gray-900">{pendingHorses}</span> ngựa chưa chấm
              </span>
            )}
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo lớp hoặc môn học…" className="min-w-[220px] flex-1" />
          </Toolbar>

          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(row) => row.id}
            onRowClick={(row) => navigate(links.session(row.id))}
            emptyTitle={total === 0 ? 'Không có buổi nào chờ đánh giá' : 'Không có buổi khớp bộ lọc'}
            emptyHint={total === 0 ? 'Mọi buổi đã kết thúc đều được chấm đủ.' : undefined}
          />
        </>
      )}
    </div>
  );
}
