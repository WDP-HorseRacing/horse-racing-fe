// F3.8 — Đặt và gỡ khóa huấn luyện (VET). CM, HT xem; OWNER xem ngựa của mình.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Info, Lock, Unlock } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { listTrainingLocks, type LockRow } from '../../services/medical.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Button,
  ChipFilter,
  DataTable,
  ErrorBox,
  PageHeader,
  Pill,
  SearchInput,
  Skeleton,
  Toolbar,
  type Column,
} from '../../components/ui';
import { formatDate } from '../../lib/format';
import { links } from '../../lib/links';
import { LiftLockModal, PlaceLockModal } from './components/modals';
import { HorseChip } from './components/parts';

function CaseLink({ row }: { row: LockRow }) {
  if (!row.caseId) return <span className="text-xs text-gray-400">—</span>;
  return (
    <Link to={links.case(row.caseId)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
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
          <p className="text-gray-500">{row.placedByName}</p>
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
            {row.pastExpected && <Pill tone="amber">Đã qua ngày dự kiến</Pill>}
          </div>
        ) : (
          <span className="text-xs text-gray-500">Chưa đặt</span>
        ),
    },
    { key: 'case', header: 'Bệnh án liên quan', render: (row) => <CaseLink row={row} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) =>
        row.canLift ? (
          <Button size="sm" variant="ghost" onClick={() => setLifting(row)}>
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
          {row.liftKindLabel && <p className="text-gray-500">{row.liftKindLabel}</p>}
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
        description="Lệnh riêng của bác sĩ: ngựa bị khóa không được tập, không được đua, bất kể sức khỏe."
        actions={
          canManage && (
            <Button onClick={() => setPlacing(true)}>
              <Lock size={16} /> Đặt khóa
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ChipFilter<'active' | 'history'>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: 'Đang hiệu lực', count: active.length, dot: 'danger' },
            { value: 'history', label: 'Lịch sử', count: history.length },
          ]}
        />
        {pastExpected > 0 && (
          <span className="text-sm font-medium text-amber-800">{pastExpected} khóa đã qua ngày dự kiến gỡ — chờ bác sĩ xác nhận</span>
        )}
      </div>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên ngựa hoặc lý do…" className="min-w-60 flex-1" />
      </Toolbar>

      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        columns={tab === 'active' ? activeColumns : historyColumns}
        pageSize={15}
        emptyTitle={tab === 'active' ? 'Không có khóa nào đang hiệu lực' : 'Chưa có khóa nào được gỡ'}
      />

      <p className="flex max-w-4xl items-start gap-2 text-xs text-gray-500">
        <Info size={14} className="mt-px shrink-0 text-gray-400" />
        <span>
          Khóa độc lập với trạng thái sức khỏe: đổi sức khỏe về Đủ điều kiện không tự gỡ khóa. Mỗi ngựa tối đa một khóa hiệu lực. Tới ngày dự kiến
          gỡ hệ thống không tự gỡ — chỉ gỡ khi bác sĩ xác nhận, khi đóng bệnh án chọn gỡ, hoặc khi ngựa được chuyển nhượng.
        </span>
      </p>

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
