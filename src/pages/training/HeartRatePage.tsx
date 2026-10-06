// Nhịp tim tối đa từng ngựa (F2.11): bác sĩ đặt / sửa / xóa; CM và HT xem.
// Chưa đặt thì quy tắc R1 không chạy — không có giá trị dự phòng.
import { useMemo, useState } from 'react';
import { HeartPulse, History, Pencil, Trash2 } from 'lucide-react';
import {
  Avatar,
  Button,
  ChipFilter,
  DataTable,
  ErrorBox,
  PageHeader,
  SearchInput,
  Skeleton,
  Toolbar,
  useToast,
  type Column,
} from '../../components/ui';
import { HealthPill, LifecyclePill } from '../../components/ui/status';
import { useService } from '../../hooks/useService';
import { clearMaxHeartRate, listMaxHeartRates, type MaxHeartRateRow } from '../../services/session.service';
import { formatDate } from '../../lib/format';
import MaxHeartRateHistory from './components/MaxHeartRateHistory';
import MaxHeartRateModal from './components/MaxHeartRateModal';
import ReasonModal from './components/ReasonModal';

type Filter = '' | 'SET' | 'UNSET' | 'UNSET_SOON';

export default function HeartRatePage() {
  const toast = useToast();
  const { data, loading, error, reload } = useService(() => listMaxHeartRates(), []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('');
  const [editFor, setEditFor] = useState<MaxHeartRateRow | null>(null);
  const [clearFor, setClearFor] = useState<MaxHeartRateRow | null>(null);
  const [historyFor, setHistoryFor] = useState<string>();

  const all = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((row) => {
      if (term && !row.horseName.toLowerCase().includes(term) && !(row.zoneName ?? '').toLowerCase().includes(term)) return false;
      if (filter === 'SET') return row.current !== undefined;
      if (filter === 'UNSET') return row.current === undefined;
      if (filter === 'UNSET_SOON') return row.current === undefined && row.upcoming7 > 0;
      return true;
    });
  }, [all, search, filter]);

  const setCount = all.filter((row) => row.current !== undefined).length;
  const unset = all.filter((row) => row.current === undefined);
  const unsetSoon = unset.filter((row) => row.upcoming7 > 0);
  const canEditAny = all.some((row) => row.canEdit);

  const columns: Column<MaxHeartRateRow>[] = [
    {
      key: 'horse',
      header: 'Ngựa',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.avatar} name={row.horseName} size={36} />
          <div>
            <p className="font-semibold text-gray-900">{row.horseName}</p>
            <p className="text-xs text-gray-500">{row.zoneName ?? 'Chưa xếp khu'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.lifecycleStatus !== 'ACTIVE' && <LifecyclePill status={row.lifecycleStatus} />}
          {row.healthStatus !== 'ELIGIBLE' && <HealthPill status={row.healthStatus} />}
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Ngưỡng hiện tại',
      render: (row) =>
        row.current !== undefined ? (
          <p className="text-base font-semibold tabular-nums text-gray-900">
            {row.current}
            <span className="ml-1 text-xs font-normal text-gray-500">nhịp/phút</span>
          </p>
        ) : (
          <span className="text-sm text-amber-700">Chưa đặt, R1 không chạy</span>
        ),
    },
    {
      key: 'reason',
      header: 'Lý do · người đặt',
      className: 'max-w-xs',
      render: (row) =>
        row.current !== undefined ? (
          <div className="min-w-0">
            <p className="truncate text-sm text-gray-700" title={row.reason}>
              {row.reason}
            </p>
            <p className="text-xs text-gray-500">
              {row.setByName} · {formatDate(row.setAt)}
            </p>
          </div>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        ),
    },
    {
      key: 'upcoming',
      header: 'Buổi 7 ngày tới',
      render: (row) =>
        row.upcoming7 > 0 ? (
          <span className={row.current === undefined ? 'font-medium text-amber-700' : 'text-gray-700'}>
            {row.upcoming7} buổi
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          {row.canEdit && (
            <Button size="sm" variant={row.current === undefined ? 'secondary' : 'inline'} onClick={() => setEditFor(row)}>
              {row.current === undefined ? (
                <>
                  <HeartPulse size={13} /> Đặt ngưỡng
                </>
              ) : (
                <>
                  <Pencil size={13} /> Sửa
                </>
              )}
            </Button>
          )}
          {row.canEdit && row.current !== undefined && (
            <Button size="icon" variant="ghost" title="Xóa ngưỡng, R1 sẽ tắt với ngựa này" onClick={() => setClearFor(row)}>
              <Trash2 size={15} />
            </Button>
          )}
          <Button size="icon" variant="ghost" title="Lịch sử thay đổi" onClick={() => setHistoryFor(row.horseId)}>
            <History size={15} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhịp tim tối đa"
        description="Ngưỡng do bác sĩ đặt cho từng ngựa, chưa đặt thì quy tắc cảnh báo R1 không chạy, không có giá trị dự phòng."
      />

      {error && <ErrorBox message={error} />}
      {loading && !data && <Skeleton rows={5} />}

      {data && (
        <>
          <Toolbar>
            <ChipFilter<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: '', label: 'Tất cả', count: all.length },
                { value: 'SET', label: 'Đã đặt', count: setCount },
                { value: 'UNSET', label: 'Chưa đặt', count: unset.length, dot: 'warn' },
                { value: 'UNSET_SOON', label: 'Chưa đặt, có buổi 7 ngày tới', count: unsetSoon.length, dot: 'warn' },
              ]}
            />
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên ngựa hoặc khu…" className="min-w-[220px] flex-1" />
          </Toolbar>

          {!canEditAny && (
            <p className="text-xs text-gray-500">Chỉ bác sĩ thú y đặt và sửa ngưỡng. Bạn đang ở chế độ xem.</p>
          )}

          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(row) => row.horseId}
            onRowClick={(row) => setHistoryFor(row.horseId)}
            emptyTitle="Không có ngựa khớp bộ lọc"
          />
        </>
      )}

      <MaxHeartRateModal
        open={!!editFor}
        onClose={() => setEditFor(null)}
        horse={
          editFor
            ? { id: editFor.horseId, name: editFor.horseName, current: editFor.current, suggested: editFor.suggested }
            : undefined
        }
        onDone={reload}
      />

      <ReasonModal
        open={!!clearFor}
        onClose={() => setClearFor(null)}
        title={`Xóa ngưỡng của ${clearFor?.horseName ?? ''}`}
        message="Sau khi xóa, quy tắc R1 không chạy với ngựa này cho tới khi bác sĩ đặt ngưỡng mới. Buổi đang diễn ra không bị ảnh hưởng."
        confirmLabel="Xóa ngưỡng"
        onSubmit={async (reason) => {
          if (!clearFor) return undefined;
          const done = await clearMaxHeartRate(clearFor.horseId, reason);
          toast.push(`Đã xóa ngưỡng nhịp tim của ${clearFor.horseName}`, 'success');
          reload();
          return done;
        }}
      />

      <MaxHeartRateHistory horseId={historyFor} onClose={() => setHistoryFor(undefined)} />
    </div>
  );
}
