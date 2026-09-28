// F3.8 — Đặt và gỡ khóa huấn luyện (VET). CM, HT xem; OWNER xem ngựa của mình.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarX, FolderOpen, Info, Lock, Unlock } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { listTrainingLocks, type LockRow } from '../../services/medical.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Button,
  Card,
  DataTable,
  ErrorBox,
  PageHeader,
  Pill,
  SearchInput,
  Segmented,
  Skeleton,
  Stat,
  Toolbar,
  type Column,
} from '../../components/ui';
import { formatDate } from '../../lib/format';
import { links } from '../../lib/links';
import { LiftLockModal, PlaceLockModal } from './components/modals';
import { HorseChip } from './components/parts';

function CaseLink({ row }: { row: LockRow }) {
  if (!row.caseId) return <span className="text-xs text-gray-300">—</span>;
  return (
    <Link to={links.case(row.caseId)} className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:underline">
      <FolderOpen size={12} /> {row.caseTitle}
    </Link>
  );
}

export default function TrainingLocks() {
  const user = useStore((state) => state.currentUser);
  const list = useService(() => listTrainingLocks(), []);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [search, setSearch] = useState('');
  const [placing, setPlacing] = useState(false);
  const [lifting, setLifting] = useState<LockRow | null>(null);

  const all = useMemo(() => list.data ?? [], [list.data]);
  const active = all.filter((row) => row.active);
  const history = all.filter((row) => !row.active);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (tab === 'active' ? all.filter((row) => row.active) : all.filter((row) => !row.active)).filter(
      (row) => !term || `${row.horse.name} ${row.reason}`.toLowerCase().includes(term),
    );
  }, [all, tab, search]);

  if (list.loading && !list.data) return <Skeleton rows={6} />;
  if (list.error) return <ErrorBox message={list.error} />;

  const canManage = can(user, 'lock.manage');
  const pastExpected = active.filter((row) => row.pastExpected).length;

  const common: Column<LockRow>[] = [
    { key: 'horse', header: 'Ngựa', render: (row) => <HorseChip horse={row.horse} /> },
    {
      key: 'reason',
      header: 'Lý do khóa',
      className: 'min-w-[220px] max-w-sm',
      render: (row) => <p className="text-sm text-gray-800">{row.reason}</p>,
    },
    {
      key: 'placed',
      header: 'Đặt khóa',
      render: (row) => (
        <div className="text-xs">
          <p className="font-medium text-gray-700">{formatDate(row.placedAt)}</p>
          <p className="text-gray-400">{row.placedByName}</p>
        </div>
      ),
    },
  ];

  const activeColumns: Column<LockRow>[] = [
    ...common,
    {
      key: 'expected',
      header: 'Dự kiến gỡ',
      render: (row) =>
        row.expectedLiftDate ? (
          <div className="space-y-1 text-xs">
            <p className="font-medium text-gray-700">{formatDate(row.expectedLiftDate)}</p>
            {row.pastExpected && <Pill tone="amber">Đã qua ngày dự kiến — chờ bác sĩ xác nhận</Pill>}
          </div>
        ) : (
          <span className="text-xs text-gray-400">Chưa đặt</span>
        ),
    },
    { key: 'case', header: 'Bệnh án liên quan', render: (row) => <CaseLink row={row} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) =>
        row.canLift ? (
          <Button size="sm" variant="secondary" onClick={() => setLifting(row)}>
            <Unlock size={14} /> Gỡ khóa
          </Button>
        ) : null,
    },
  ];

  const historyColumns: Column<LockRow>[] = [
    ...common,
    {
      key: 'lifted',
      header: 'Gỡ khóa',
      render: (row) => (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-gray-700">
            {formatDate(row.liftedAt)} · {row.liftedByName}
          </p>
          {row.liftKindLabel && <Pill tone={row.liftKind === 'TRANSFER' ? 'gray' : row.liftKind === 'CASE_CLOSED' ? 'green' : 'blue'}>{row.liftKindLabel}</Pill>}
        </div>
      ),
    },
    {
      key: 'liftReason',
      header: 'Lý do gỡ',
      className: 'max-w-xs',
      render: (row) => <p className="text-xs text-gray-600">{row.liftReason ?? '—'}</p>,
    },
    { key: 'case', header: 'Bệnh án liên quan', render: (row) => <CaseLink row={row} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khóa huấn luyện"
        description="Lệnh riêng của bác sĩ: ngựa bị khóa không được tập và không được đua, bất kể trạng thái sức khỏe."
        actions={
          canManage && (
            <Button variant="danger" onClick={() => setPlacing(true)}>
              <Lock size={16} /> Đặt khóa
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <Stat
          className="lg:col-span-3"
          tone={active.length ? 'danger' : 'default'}
          icon={<Lock size={20} />}
          value={active.length}
          label="Đang hiệu lực"
          active={tab === 'active'}
          onClick={() => setTab('active')}
        />
        <Stat
          className="lg:col-span-3"
          tone={pastExpected ? 'warning' : 'default'}
          icon={<CalendarX size={20} />}
          value={pastExpected}
          label="Đã qua ngày dự kiến gỡ"
          hint="Chờ bác sĩ xác nhận gỡ"
        />
        <Card variant="outline" className="sm:col-span-2 lg:col-span-6">
          <p className="flex items-start gap-2 text-sm text-gray-600">
            <Info size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>
              Khóa độc lập với trạng thái sức khỏe: đổi sức khỏe về Đủ điều kiện không tự gỡ khóa. Mỗi ngựa tối đa một khóa hiệu lực. Tới ngày
              dự kiến gỡ hệ thống <span className="font-semibold">không tự gỡ</span> — chỉ gỡ khi bác sĩ xác nhận, khi đóng bệnh án chọn gỡ, hoặc khi
              ngựa được chuyển nhượng.
            </span>
          </p>
        </Card>
      </div>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên ngựa hoặc lý do…" className="min-w-60 flex-1" />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: 'Đang hiệu lực', badge: active.length },
            { value: 'history', label: 'Lịch sử', badge: history.length },
          ]}
        />
      </Toolbar>

      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        columns={tab === 'active' ? activeColumns : historyColumns}
        pageSize={15}
        emptyTitle={tab === 'active' ? 'Không có khóa nào đang hiệu lực' : 'Chưa có khóa nào được gỡ'}
      />

      {placing && (
        <PlaceLockModal
          onClose={() => setPlacing(false)}
          onDone={() => {
            setPlacing(false);
            list.reload();
          }}
        />
      )}
      {lifting && (
        <LiftLockModal
          lock={{ id: lifting.id, horseName: lifting.horse.name, reason: lifting.reason, placedAt: lifting.placedAt }}
          onClose={() => setLifting(null)}
          onDone={() => {
            setLifting(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
