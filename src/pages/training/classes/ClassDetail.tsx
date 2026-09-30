import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Ban, CalendarPlus, Flag, Pencil } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import {
  cancelClass,
  cancelSession,
  CLASS_LIMITS,
  endClassEarly,
  getClass,
  updateClass,
  withdrawHorse,
  type ClassSessionRow,
  type EnrollmentRow,
} from '../../../services/training.service';
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  Meter,
  Modal,
  NotFound,
  Notice,
  PageHeader,
  Skeleton,
  Tabs,
  useToast,
} from '../../../components/ui';
import { ClassPill, IntensityMeter } from '../../../components/ui/status';
import { now } from '../../../lib/clock';
import { formatDate, formatDateShort, formatDateTime, toDateKey } from '../../../lib/format';
import { links } from '../../../lib/links';
import { ReasonDialog } from '../setup-components/ReasonDialog';
import { Stepper } from '../setup-components/Stepper';
import { weekdayLong, weekdayShort } from '../setup-components/helpers';
import { AddSessionModal } from './AddSessionModal';
import { ClassHorsesTab } from './ClassHorsesTab';
import { ClassResultsTab } from './ClassResultsTab';
import { ClassSessionsTab } from './ClassSessionsTab';
import { EnrollSheet } from './EnrollSheet';

type TabKey = 'horses' | 'sessions' | 'results';

export default function ClassDetail() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { data, loading, error, reload } = useService(() => getClass(id), [id]);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState<EnrollmentRow | null>(null);
  const [cancellingSession, setCancellingSession] = useState<ClassSessionRow | null>(null);
  const [classAction, setClassAction] = useState<'end' | 'cancel' | null>(null);
  const action = useAction();

  const tabParam = params.get('tab');
  const tab: TabKey = tabParam === 'sessions' || tabParam === 'results' ? tabParam : 'horses';
  const today = toDateKey(now());

  if (loading && !data) return <Skeleton rows={8} />;
  if (error || !data) return <NotFound message={error} />;

  const upcoming = data.sessions.filter((row) => row.status === 'SCHEDULED' && row.date >= today).length;
  const allScheduled = data.sessions.filter((row) => row.status === 'SCHEDULED').length;

  const openDialog = (fn: () => void) => {
    action.clearError();
    fn();
  };

  const runWithdraw = async (reason: string) => {
    if (!withdrawing) return;
    const done = await action.run(() => withdrawHorse(withdrawing.id, reason));
    if (done) {
      toast.push(`Đã rút ${withdrawing.horseName} khỏi lớp`, 'success');
      setWithdrawing(null);
      reload();
    }
  };

  const runCancelSession = async (reason: string) => {
    if (!cancellingSession) return;
    const done = await action.run(() => cancelSession(cancellingSession.id, reason));
    if (done) {
      toast.push(`Đã hủy buổi ${formatDateShort(cancellingSession.date)} cho cả lớp`, 'success');
      setCancellingSession(null);
      reload();
    }
  };

  const runClassAction = async (reason: string) => {
    const result = await action.run(() => (classAction === 'end' ? endClassEarly(data.id, reason) : cancelClass(data.id, reason)));
    if (result) {
      toast.push(
        `${classAction === 'end' ? 'Đã kết thúc sớm lớp' : 'Đã hủy lớp'} — ${result.cancelledSessions} buổi chưa diễn ra đã bị hủy`,
        'success',
      );
      setClassAction(null);
      reload();
    }
  };

  const tabs = [
    { key: 'horses', label: 'Ngựa trong lớp', badge: data.enrollments.active.length },
    { key: 'sessions', label: 'Buổi học', badge: data.sessionsTotal },
    ...(data.results ? [{ key: 'results', label: 'Kết quả' }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <Link to={links.classes} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-800">
            <ArrowLeft size={15} /> Danh sách lớp
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {data.name} <ClassPill status={data.status} />
          </span>
        }
        description={
          <>
            Mở từ giáo án{' '}
            {data.programDeleted || !data.canViewProgram ? (
              <span className="font-medium text-gray-700">
                {data.programName}
                {data.programDeleted ? ' (đã xóa)' : ''}
              </span>
            ) : (
              <Link to={links.program(data.programId)} className="font-medium text-emerald-700 hover:underline">
                {data.programName}
              </Link>
            )}{' '}
            · {data.zoneName} · HT {data.trainerName}
          </>
        }
        actions={
          <>
            {data.canEdit && (
              <Button variant="ghost" onClick={() => openDialog(() => setEditOpen(true))}>
                <Pencil size={15} /> Sửa lớp
              </Button>
            )}
            {data.canCancelClass && (
              <Button variant="ghost" onClick={() => openDialog(() => setClassAction('cancel'))}>
                <Ban size={15} /> Hủy lớp
              </Button>
            )}
            {data.canEndEarly && (
              <Button variant="secondary" onClick={() => openDialog(() => setClassAction('end'))}>
                <Flag size={15} /> Kết thúc sớm
              </Button>
            )}
            {data.canAddSession && (
              <Button variant="secondary" onClick={() => setAddOpen(true)}>
                <CalendarPlus size={16} /> Thêm buổi
              </Button>
            )}
          </>
        }
      />

      {data.cancelledAt && (
        <Notice tone="info">
          Lớp đã bị hủy lúc {formatDateTime(data.cancelledAt)} bởi {data.cancelledByName}. Lý do: {data.cancelReason}
        </Notice>
      )}
      {data.endedEarlyAt && (
        <Notice tone="warning">
          Lớp kết thúc sớm lúc {formatDateTime(data.endedEarlyAt)} bởi {data.endedEarlyByName}. {data.endNote}
        </Notice>
      )}

      <Card className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1.3fr_0.9fr]">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Khung giờ cố định</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">{data.slotLabel}</p>
          <p className="mt-1 text-xs text-gray-500 tabular-nums">
            {weekdayShort(data.startDate)} {formatDate(data.startDate)} → {weekdayShort(data.endDate)} {formatDate(data.endDate)} ·{' '}
            {data.totalWeeks} tuần
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Sĩ số</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">
            {data.enrolled}
            <span className="font-normal text-gray-400">/{data.capacity}</span>
          </p>
          <Meter value={data.enrolled} max={data.capacity} className="mt-1.5" />
          <p className="mt-1.5 text-xs text-gray-500">
            {data.enrolled >= data.capacity ? 'Đủ sĩ số — đăng ký mới bị chặn' : `Còn ${data.capacity - data.enrolled} chỗ`}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Tiến độ buổi học</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">
            {data.sessionsDone}
            <span className="font-normal text-gray-400">/{data.sessionsTotal} buổi</span>
          </p>
          <Meter value={data.sessionsDone} max={data.sessionsTotal} className="mt-1.5" />
          {data.nextSession && (data.status === 'ACTIVE' || data.status === 'SCHEDULED') ? (
            <Link to={links.session(data.nextSession.id)} className="mt-1.5 flex items-center gap-2 text-xs text-gray-600 hover:text-emerald-700">
              <IntensityMeter intensity={data.nextSession.intensity} showLabel={false} />
              <span className="truncate">
                Kế tiếp {data.nextSession.date === today ? 'hôm nay' : `${weekdayLong(data.nextSession.date)} ${formatDateShort(data.nextSession.date)}`}
                {' · '}
                {data.nextSession.subjectName}
              </span>
            </Link>
          ) : (
            <p className="mt-1.5 text-xs text-gray-500">
              {data.sessionsCancelled > 0 ? `${data.sessionsCancelled} buổi đã hủy` : 'Không còn buổi sắp tới'}
            </p>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Cường độ cao nhất còn lại</p>
          <div className="mt-1.5">{data.maxIntensity ? <IntensityMeter intensity={data.maxIntensity} /> : <span className="text-sm text-gray-500">—</span>}</div>
        </div>
      </Card>

      <Tabs
        tabs={tabs}
        active={tab}
        onChange={(key) => {
          const next = new URLSearchParams(params);
          next.set('tab', key);
          setParams(next, { replace: true });
        }}
      />

      {tab === 'horses' && (
        <ClassHorsesTab
          detail={data}
          onEnroll={() => setEnrollOpen(true)}
          onWithdraw={(row) => openDialog(() => setWithdrawing(row))}
        />
      )}
      {tab === 'sessions' && (
        <ClassSessionsTab
          detail={data}
          today={today}
          onAdd={() => setAddOpen(true)}
          onCancel={(row) => openDialog(() => setCancellingSession(row))}
        />
      )}
      {tab === 'results' && <ClassResultsTab results={data.results} ownerFiltered={data.ownerFiltered} />}

      {data.canEnroll && <EnrollSheet classId={data.id} open={enrollOpen} onClose={() => setEnrollOpen(false)} onChanged={reload} />}
      {data.canAddSession && <AddSessionModal detail={data} open={addOpen} onClose={() => setAddOpen(false)} onDone={reload} />}
      {data.canEdit && (
        <EditClassModal
          open={editOpen}
          name={data.name}
          capacity={data.capacity}
          enrolled={data.enrolled}
          onClose={() => setEditOpen(false)}
          onSave={async (input) => {
            const done = await action.run(() => updateClass(data.id, input));
            if (done) {
              toast.push('Đã lưu thông tin lớp', 'success');
              setEditOpen(false);
              reload();
            }
          }}
          pending={action.pending}
          error={action.error}
        />
      )}

      <ReasonDialog
        open={withdrawing !== null}
        title={`Rút ${withdrawing?.horseName ?? 'ngựa'} khỏi lớp`}
        message={
          <>
            Rút <span className="font-semibold text-gray-900">{withdrawing?.horseName}</span> khỏi lớp {data.name}.
          </>
        }
        consequences={[
          'Đăng ký được đóng, ghi ngày rút và lý do',
          'Các buổi chưa diễn ra của lớp biến mất khỏi lịch của ngựa này',
          'Không buổi học nào bị hủy; kết quả các buổi đã học giữ nguyên',
          'Chủ ngựa và Groom phụ trách nhận thông báo',
        ]}
        label="Lý do rút"
        placeholder="Ví dụ: chuyển sang lớp phục hồi"
        confirmLabel="Rút khỏi lớp"
        pending={action.pending}
        error={action.error}
        onConfirm={runWithdraw}
        onClose={() => setWithdrawing(null)}
      />

      <ReasonDialog
        open={cancellingSession !== null}
        title="Hủy buổi học cho cả lớp"
        message={
          cancellingSession && (
            <>
              Hủy buổi <span className="font-semibold text-gray-900">{cancellingSession.subjectName}</span> ngày{' '}
              {weekdayLong(cancellingSession.date).toLowerCase()} {formatDate(cancellingSession.date)} lúc {cancellingSession.slotLabel}.
            </>
          )
        }
        consequences={[
          `Buổi bị hủy cho CẢ LỚP — ${cancellingSession?.horseCount ?? 0} ngựa đều không tập buổi này`,
          'Muốn cho riêng một con nghỉ thì không hủy buổi — đánh dấu vắng con đó ở trang buổi học',
          'Groom của các ngựa trong buổi nhận thông báo',
        ]}
        label="Lý do hủy buổi"
        placeholder="Ví dụ: mưa lớn, sân cỏ ngập nước"
        confirmLabel="Hủy buổi"
        pending={action.pending}
        error={action.error}
        onConfirm={runCancelSession}
        onClose={() => setCancellingSession(null)}
      />

      <ReasonDialog
        open={classAction !== null}
        title={classAction === 'end' ? `Kết thúc sớm lớp ${data.name}` : `Hủy lớp ${data.name}`}
        message={
          classAction === 'end'
            ? 'Lớp chuyển sang Đã kết thúc từ hôm nay.'
            : 'Lớp chuyển sang Đã hủy. Người hủy, thời điểm và lý do được lưu lại.'
        }
        consequences={[
          `Các buổi chưa diễn ra sẽ bị hủy (${classAction === 'end' ? upcoming : allScheduled} buổi)`,
          'Lịch sử các buổi đã học giữ nguyên',
          'Đăng ký của ngựa giữ nguyên để tra cứu lịch sử',
          'Groom và chủ của các ngựa đang học nhận thông báo',
        ]}
        label={classAction === 'end' ? 'Lý do kết thúc sớm' : 'Lý do hủy lớp'}
        confirmLabel={classAction === 'end' ? 'Kết thúc sớm' : 'Hủy lớp'}
        pending={action.pending}
        error={action.error}
        onConfirm={runClassAction}
        onClose={() => setClassAction(null)}
      />
    </div>
  );
}

function EditClassModal({
  open,
  name,
  capacity,
  enrolled,
  pending,
  error,
  onSave,
  onClose,
}: {
  open: boolean;
  name: string;
  capacity: number;
  enrolled: number;
  pending: boolean;
  error?: string;
  onSave: (input: { name: string; capacity: number }) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ name, capacity });
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setForm({ name, capacity });
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sửa lớp"
      description="Chỉ sửa được tên và sĩ số. Giáo án, khu, khung giờ và ngày cố định sau khi mở lớp."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={() => onSave(form)} disabled={pending || !form.name.trim()}>
            {pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tên lớp" required>
          <Input value={form.name} maxLength={60} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="Sĩ số tối đa" hint={`Không nhỏ hơn ${enrolled} ngựa đang học, tối đa ${CLASS_LIMITS.maxCapacity}`}>
          <Stepper
            label="sĩ số tối đa"
            value={form.capacity}
            min={Math.max(CLASS_LIMITS.minCapacity, enrolled)}
            max={CLASS_LIMITS.maxCapacity}
            suffix="ngựa"
            onChange={(value) => setForm({ ...form, capacity: value })}
          />
        </Field>
        {error && <ErrorBox message={error} />}
      </div>
    </Modal>
  );
}
