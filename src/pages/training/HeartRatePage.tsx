// Nhịp tim tối đa từng ngựa (F2.11): bác sĩ đặt / sửa / xóa; CM và HT xem.
// Chưa đặt thì quy tắc R1 không chạy — không có giá trị dự phòng.
import { useMemo, useState } from 'react';
import { CalendarClock, HeartOff, HeartPulse, History, Info, Pencil, Trash2 } from 'lucide-react';
import {
  Avatar,
  Button,
  DataTable,
  ErrorBox,
  FilterSelect,
  Notice,
  PageHeader,
  Pill,
  SearchInput,
  Skeleton,
  Stat,
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
          <HealthPill status={row.healthStatus} />
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Ngưỡng hiện tại',
      render: (row) =>
        row.current !== undefined ? (
          <p className="text-lg font-bold tabular-nums text-gray-900">
            {row.current}
            <span className="ml-1 text-xs font-normal text-gray-400">nhịp/phút</span>
          </p>
        ) : (
          <Pill tone="amber">
            <HeartOff size={11} /> Chưa đặt — R1 không chạy
          </Pill>
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
            <p className="text-xs text-gray-400">
              {row.setByName} · {formatDate(row.setAt)}
            </p>
          </div>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        ),
    },
    {
      key: 'upcoming',
      header: 'Buổi 7 ngày tới',
      render: (row) =>
        row.upcoming7 > 0 ? (
          <span className={row.current === undefined ? 'font-semibold text-amber-700' : 'text-gray-700'}>
            {row.upcoming7} buổi
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          {row.canEdit && (
            <Button size="sm" variant={row.current === undefined ? 'primary' : 'soft'} onClick={() => setEditFor(row)}>
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
            <Button size="icon" variant="ghost" title="Xóa ngưỡng — R1 sẽ tắt với ngựa này" onClick={() => setClearFor(row)}>
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
        description="Ngưỡng do bác sĩ đặt cho từng ngựa, dùng cho quy tắc cảnh báo R1 trong buổi tập."
      />

      <Notice tone="info" icon={<Info size={16} />}>
        Ngựa chưa được đặt ngưỡng thì R1 không chạy — hệ thống không dùng giá trị mặc định thay thế và hiện nhắc ở màn hình
        theo dõi. Giá trị mặc định của câu lạc bộ chỉ là gợi ý trong form của bác sĩ.
      </Notice>

      {error && <ErrorBox message={error} />}
      {loading && !data && <Skeleton rows={5} />}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-12">
            <Stat
              className="lg:col-span-4"
              value={setCount}
              label="Ngựa đã có ngưỡng"
              tone="success"
              icon={<HeartPulse size={18} />}
              active={filter === 'SET'}
              onClick={() => setFilter(filter === 'SET' ? '' : 'SET')}
            />
            <Stat
              className="lg:col-span-3"
              value={unset.length}
              label="Chưa đặt — R1 không chạy"
              tone={unset.length > 0 ? 'warning' : 'success'}
              icon={<HeartOff size={18} />}
              active={filter === 'UNSET'}
              onClick={() => setFilter(filter === 'UNSET' ? '' : 'UNSET')}
            />
            <Stat
              className="lg:col-span-5"
              value={unsetSoon.length}
              label="Chưa đặt nhưng có buổi tập trong 7 ngày"
              tone={unsetSoon.length > 0 ? 'danger' : 'success'}
              hint={unsetSoon.length > 0 ? unsetSoon.map((row) => row.horseName).join(', ') : 'Không có ngựa nào cần đặt gấp'}
              icon={<CalendarClock size={18} />}
              active={filter === 'UNSET_SOON'}
              onClick={() => setFilter(filter === 'UNSET_SOON' ? '' : 'UNSET_SOON')}
            />
          </div>

          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên ngựa hoặc khu…" className="flex-1" />
            <FilterSelect value={filter} onChange={(value) => setFilter(value as Filter)} label="Lọc theo ngưỡng">
              <option value="">Tất cả ngựa</option>
              <option value="SET">Đã đặt ngưỡng</option>
              <option value="UNSET">Chưa đặt</option>
              <option value="UNSET_SOON">Chưa đặt, có buổi 7 ngày tới</option>
            </FilterSelect>
          </Toolbar>

          {!canEditAny && (
            <p className="text-xs font-light text-gray-400">Chỉ bác sĩ thú y đặt và sửa ngưỡng; bạn đang ở chế độ xem.</p>
          )}

          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(row) => row.horseId}
            onRowClick={(row) => setHistoryFor(row.horseId)}
            rowClassName={(row) => (row.current === undefined ? 'bg-amber-50/40' : '')}
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
