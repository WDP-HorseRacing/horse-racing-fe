// F3.2 — Lịch khám định kỳ (CM đặt chu kỳ chung) và F3.3 — ghi buổi khám định kỳ (VET).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Repeat, Stethoscope, TimerReset } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  getExamCycle,
  listPeriodicStatus,
  periodicStateLabel,
  setExamCycle,
  type PeriodicRowState,
} from '../../services/medical.service';
import {
  Button,
  Card,
  ChipFilter,
  DataTable,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Skeleton,
  Textarea,
  Toolbar,
  useToast,
} from '../../components/ui';
import { formatDate } from '../../lib/format';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { links } from '../../lib/links';
import ExaminationSheet from './components/ExaminationSheet';
import { HorseChip, PeriodicPill } from './components/parts';

function CycleModal({ current, onClose, onDone }: { current: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [days, setDays] = useState(String(current));
  const [reason, setReason] = useState('');
  const fieldError = (field: string) => (action.field === field ? action.error : undefined);
  const submit = () =>
    action.run(
      () => setExamCycle(Number(days), reason),
      () => {
        toast.push(`Đã đổi chu kỳ khám định kỳ thành ${days} ngày`, 'success');
        onDone();
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title="Đổi chu kỳ khám định kỳ"
      description="Tham số chung của câu lạc bộ, áp dụng cho mọi ngựa ACTIVE và RETIRED."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Lưu chu kỳ'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Chu kỳ (ngày)" required error={fieldError('days')} hint="Từ 7 đến 365 ngày. Hạn khám của mọi ngựa được tính lại ngay.">
          <Input type="number" min={7} max={365} value={days} onChange={(event) => setDays(event.target.value)} />
        </Field>
        <Field label="Lý do" required error={fieldError('reason')}>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Mùa mưa, tăng tần suất khám" />
        </Field>
        {action.error && !['days', 'reason'].includes(action.field ?? '') && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

export default function PeriodicExams() {
  const user = useStore((s) => s.currentUser);
  const cycle = useService(() => getExamCycle(), []);
  const list = useService(() => listPeriodicStatus(), []);
  const [state, setState] = useState<PeriodicRowState | ''>('');
  const [search, setSearch] = useState('');
  const [editingCycle, setEditingCycle] = useState(false);
  const [exam, setExam] = useState<{ horseId?: string } | null>(null);

  const all = useMemo(() => list.data ?? [], [list.data]);
  const counts = useMemo(() => {
    const result: Record<PeriodicRowState, number> = { OK: 0, DUE_SOON: 0, OVERDUE: 0, OVERDUE_ALERT: 0 };
    all.forEach((row) => {
      result[row.state] += 1;
    });
    return result;
  }, [all]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((row) => !state || row.state === state).filter((row) => !term || row.horse.name.toLowerCase().includes(term));
  }, [all, state, search]);

  if ((list.loading && !list.data) || (cycle.loading && !cycle.data)) return <Skeleton rows={6} />;
  if (list.error) return <ErrorBox message={list.error} />;

  const canExamine = can(user, 'exam.record');
  const toggle = (value: PeriodicRowState) => setState(state === value ? '' : value);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khám định kỳ"
        description="Khám theo chu kỳ chung; buổi định kỳ kết luận bình thường là bản ghi độc lập, không có chi phí."
        actions={
          canExamine && (
            <Button onClick={() => setExam({})}>
              <Stethoscope size={16} /> Ghi buổi khám định kỳ
            </Button>
          )
        }
      />

      <Card className="flex flex-wrap items-start gap-x-10 gap-y-4">
        <div className="shrink-0">
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Repeat size={15} className="text-gray-400" /> Chu kỳ khám chung
          </p>
          <p className="mt-1.5 text-3xl font-bold leading-none tracking-tight text-gray-900 tabular-nums">
            {cycle.data?.days}
            <span className="ml-1.5 text-base font-medium text-gray-500">ngày</span>
          </p>
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-gray-900">Hạn kế tiếp = buổi khám gần nhất (mọi loại) + chu kỳ</p>
          <ul className="mt-1.5 grid gap-x-8 gap-y-1 text-xs text-gray-500 md:grid-cols-2">
            <li>Buổi khám trong bệnh án cũng được tính là lần khám gần nhất.</li>
            <li>Ngựa chưa từng khám: tính từ ngày tạo hồ sơ.</li>
            <li>Quá hạn trên 7 ngày: bác sĩ và quản lý nhận cảnh báo, mỗi ngựa một lần cho tới khi được khám.</li>
            <li>Ngựa đã chuyển nhượng hoặc hồ sơ đã xóa không có lịch khám.</li>
          </ul>
        </div>
        {cycle.data?.canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setEditingCycle(true)}>
            <TimerReset size={14} /> Đổi chu kỳ
          </Button>
        )}
      </Card>

      <ChipFilter<PeriodicRowState | ''>
        value={state}
        onChange={(value) => (value === '' ? setState('') : toggle(value))}
        options={[
          { value: '', label: 'Tất cả', count: all.length },
          { value: 'OVERDUE_ALERT', label: periodicStateLabel.OVERDUE_ALERT, count: counts.OVERDUE_ALERT, dot: 'danger' },
          { value: 'OVERDUE', label: periodicStateLabel.OVERDUE, count: counts.OVERDUE, dot: 'warn' },
          { value: 'DUE_SOON', label: periodicStateLabel.DUE_SOON, count: counts.DUE_SOON, dot: 'warn', hollow: true },
          { value: 'OK', label: periodicStateLabel.OK, count: counts.OK },
        ]}
      />

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên ngựa…" className="min-w-60 flex-1" />
      </Toolbar>

      <DataTable
        rows={rows}
        rowKey={(row) => row.horse.id}
        pageSize={20}
        emptyTitle="Không có ngựa phù hợp"
        columns={[
          { key: 'horse', header: 'Ngựa', render: (row) => <HorseChip horse={row.horse} /> },
          {
            key: 'last',
            header: 'Buổi khám gần nhất',
            render: (row) =>
              row.neverExamined ? (
                <div className="text-xs">
                  <p className="font-medium text-gray-700">Chưa từng khám</p>
                  <p className="text-gray-500">Tính từ ngày tạo hồ sơ {formatDate(row.baseDate)}</p>
                </div>
              ) : (
                <div className="text-xs">
                  <p className="font-medium text-gray-700">{formatDate(row.lastExamAt)}</p>
                  <p className="text-gray-500">{row.lastExamKind === 'PERIODIC' ? 'Định kỳ' : 'Trong bệnh án'}</p>
                </div>
              ),
          },
          {
            key: 'due',
            header: 'Hạn kế tiếp',
            render: (row) => <span className="font-semibold tabular-nums text-gray-900">{formatDate(row.dueDate)}</span>,
          },
          {
            key: 'state',
            header: 'Tình trạng',
            render: (row) => <PeriodicPill state={row.state} label={row.stateLabel} overdueDays={row.overdueDays} alerted={row.alerted} />,
          },
          {
            key: 'case',
            header: 'Bệnh án mở',
            render: (row) =>
              row.openCase ? (
                <Link to={links.case(row.openCase.id)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                  <FolderOpen size={12} /> {row.openCase.title}
                </Link>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              ),
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (row) =>
              row.canExamine ? (
                <Button size="sm" variant="ghost" onClick={() => setExam({ horseId: row.horse.id })}>
                  <Stethoscope size={14} /> Ghi khám
                </Button>
              ) : null,
          },
        ]}
      />

      {editingCycle && cycle.data && (
        <CycleModal
          current={cycle.data.days}
          onClose={() => setEditingCycle(false)}
          onDone={() => {
            setEditingCycle(false);
            cycle.reload();
            list.reload();
          }}
        />
      )}
      {exam && (
        <ExaminationSheet
          horseId={exam.horseId}
          kind="PERIODIC"
          onClose={() => setExam(null)}
          onDone={() => {
            setExam(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
