import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Check, Info } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import { useLeaveConfirm } from '../../../hooks/useLeaveConfirm';
import {
  CLASS_LIMITS,
  createClass,
  listClassZoneOptions,
  listProgramOptions,
  listSlots,
  previewClassSchedule,
  type ProgramOption,
} from '../../../services/training.service';
import {
  Button,
  Card,
  cn,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  NotFound,
  Notice,
  PageHeader,
  SectionTitle,
  Select,
  Skeleton,
  useToast,
} from '../../../components/ui';
import { IntensityMeter } from '../../../components/ui/status';
import { useStore } from '../../../store/store';
import { can } from '../../../auth/permissions';
import { now } from '../../../lib/clock';
import { addDays, formatDate, toDateKey } from '../../../lib/format';
import { links } from '../../../lib/links';
import { PhaseTimeline } from '../setup-components/PhaseTimeline';
import { IntensityLegend, SessionPlanGrid } from '../setup-components/SessionPlanGrid';
import { Stepper } from '../setup-components/Stepper';
import { weekdayLong } from '../setup-components/helpers';

export default function ClassForm() {
  const currentUser = useStore((state) => state.currentUser);
  const programs = useService(() => listProgramOptions(), []);
  const zones = useService(() => listClassZoneOptions(), []);
  const slots = useService(() => listSlots(), []);

  if (!can(currentUser, 'class.manage')) {
    return <NotFound message="Mở lớp là việc của huấn luyện viên trưởng phụ trách khu chuồng." />;
  }
  if (programs.loading || zones.loading || slots.loading) return <Skeleton rows={8} />;
  const loadError = programs.error ?? zones.error ?? slots.error;
  if (loadError) return <ErrorBox message={loadError} />;
  return <ClassFormBody programs={programs.data ?? []} zones={zones.data ?? []} slots={slots.data ?? []} />;
}

function ClassFormBody({
  programs,
  zones,
  slots,
}: {
  programs: ProgramOption[];
  zones: Awaited<ReturnType<typeof listClassZoneOptions>>;
  slots: Awaited<ReturnType<typeof listSlots>>;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const action = useAction();
  const today = toDateKey(now());
  const activeZones = zones.filter((zone) => zone.active);

  const [programId, setProgramId] = useState(() => {
    const requested = params.get('programId');
    return programs.some((program) => program.id === requested) ? (requested as string) : '';
  });
  const [name, setName] = useState('');
  const [zoneId, setZoneId] = useState(activeZones.length === 1 ? activeZones[0].id : '');
  const [slotId, setSlotId] = useState(slots[1]?.id ?? slots[0]?.id ?? '');
  const [startDate, setStartDate] = useState(toDateKey(addDays(now(), 1)));
  const [capacity, setCapacity] = useState<number>(CLASS_LIMITS.defaultCapacity);

  const [dirty, setDirty] = useState(false);
  const leaveConfirmModal = useLeaveConfirm(dirty);

  const setDirtyAnd = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (val: React.SetStateAction<T>) => {
    setter(val);
    setDirty(true);
  };

  const program = programs.find((item) => item.id === programId);
  const zone = zones.find((item) => item.id === zoneId);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  const preview = useService(
    () => (programId && validDate ? previewClassSchedule(programId, startDate) : Promise.resolve(undefined)),
    [programId, startDate],
  );
  const suggestion = useMemo(() => {
    if (!program) return '';
    const code = zone?.name.replace(/^Khu\s*/i, '') ?? '';
    return `${program.name.split(/\s+/).slice(0, 2).join(' ')} ${code}`.trim();
  }, [program, zone]);

  const fieldError = (field: string) => (action.field === field ? action.error : undefined);

  const submit = async () => {
    const id = await action.run(() =>
      createClass({ name: name.trim() || suggestion, programId, zoneId, slotId, startDate, capacity }),
    );
    if (id) {
      flushSync(() => {
        setDirty(false);
      });
      toast.push('Đã mở lớp và sinh toàn bộ buổi học', 'success');
      navigate(links.class(id, 'horses'));
    }
  };

  if (zones.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mở lớp" />
        <EmptyState
          title="Bạn chưa phụ trách khu chuồng nào"
          hint="Lớp chỉ mở được ở khu bạn phụ trách. Liên hệ quản lý câu lạc bộ để được giao khu."
        />
      </div>
    );
  }

  const pastDate = validDate && startDate < today;

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <Link to={links.classes} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-800">
            <ArrowLeft size={15} /> Danh sách lớp
          </Link>
        }
        title="Mở lớp huấn luyện"
        description="Chọn giáo án, khu và khung giờ cố định — hệ thống sinh toàn bộ buổi học ngay khi mở lớp."
        actions={
          <Button onClick={submit} disabled={action.pending || !programId || !zoneId || !slotId || !validDate || pastDate}>
            <CalendarCheck size={16} /> {action.pending ? 'Đang mở lớp…' : 'Mở lớp'}
          </Button>
        }
      />

      {action.error && !['name', 'zoneId', 'slotId', 'startDate', 'capacity'].includes(action.field ?? '') && (
        <ErrorBox message={action.error} />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-6 xl:col-span-5">
          <Card>
            <SectionTitle>Giáo án</SectionTitle>
            {programs.length === 0 ? (
              <EmptyState title="Chưa có giáo án" hint="Soạn giáo án trước rồi mới mở lớp." className="py-8" />
            ) : (
              <div role="radiogroup" className="max-h-[420px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {programs.map((option) => {
                  const selected = option.id === programId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setDirtyAnd(setProgramId)(option.id)}
                      className={cn(
                        'block w-full rounded-xl p-3.5 text-left ring-1 transition',
                        selected ? 'bg-white ring-2 ring-emerald-600' : 'bg-white ring-gray-200 hover:ring-gray-300',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">{option.name}</p>
                          <p className="text-xs text-gray-500 tabular-nums">
                            {option.summary.totalWeeks} tuần · {option.summary.totalSessions} buổi · {option.phases.length} giai đoạn
                          </p>
                        </div>
                        <span className="flex items-center gap-2">
                          {option.summary.maxIntensity && <IntensityMeter intensity={option.summary.maxIntensity} />}
                          <span
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded-full ring-1',
                              selected ? 'bg-emerald-700 text-white ring-emerald-700' : 'ring-gray-300',
                            )}
                          >
                            {selected && <Check size={12} strokeWidth={3} />}
                          </span>
                        </span>
                      </div>
                      <PhaseTimeline phases={option.summary.phases} size="sm" className="mt-3" />
                    </button>
                  );
                })}
              </div>
            )}
            {fieldError('programId') && <p className="mt-2 text-xs font-medium text-red-600">{fieldError('programId')}</p>}
          </Card>

          <Card>
            <SectionTitle>Thông tin lớp</SectionTitle>
            <div className="space-y-4">
              <Field label="Tên lớp" required error={fieldError('name')} hint={!name && suggestion ? `Để trống sẽ dùng "${suggestion}"` : undefined}>
                <Input value={name} maxLength={60} placeholder={suggestion || 'Ví dụ: Tăng tốc A2'} onChange={(event) => setDirtyAnd(setName)(event.target.value)} />
              </Field>
              <Field label="Khu chuồng" required error={fieldError('zoneId')} hint="Lớp chỉ nhận ngựa thuộc khu này; bạn chỉ chọn được khu mình phụ trách">
                <Select value={zoneId} onChange={(event) => setDirtyAnd(setZoneId)(event.target.value)}>
                  <option value="">Chọn khu…</option>
                  {zones.map((item) => (
                    <option key={item.id} value={item.id} disabled={!item.active}>
                      {item.name}
                      {item.disabledReason ? ` — ${item.disabledReason}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Khung giờ cố định" required error={fieldError('slotId')} hint="Mọi buổi của lớp dùng khung giờ này (60 phút)">
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setDirtyAnd(setSlotId)(slot.id)}
                      className={cn(
                        'rounded-lg py-2.5 text-sm font-medium tabular-nums ring-1 transition',
                        slot.id === slotId
                          ? 'bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600'
                          : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-300',
                      )}
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Ngày bắt đầu"
                  required
                  error={pastDate ? 'Ngày bắt đầu không được ở quá khứ' : fieldError('startDate')}
                  hint={validDate ? weekdayLong(startDate) : undefined}
                >
                  <Input type="date" min={today} value={startDate} onChange={(event) => setDirtyAnd(setStartDate)(event.target.value)} />
                </Field>
                <Field label="Sĩ số tối đa" required error={fieldError('capacity')} hint={`${CLASS_LIMITS.minCapacity}–${CLASS_LIMITS.maxCapacity} ngựa, đủ thì chặn đăng ký`}>
                  <Stepper
                    label="sĩ số tối đa"
                    value={capacity}
                    min={CLASS_LIMITS.minCapacity}
                    max={CLASS_LIMITS.maxCapacity}
                    suffix="ngựa"
                    onChange={setDirtyAnd(setCapacity)}
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-6 xl:col-span-7">
          <Card>
            <SectionTitle action={<IntensityLegend />}>Lịch xem trước</SectionTitle>
            {!program ? (
              <EmptyState title="Chọn giáo án để xem trước lịch" hint="Các buổi sẽ được rải đều trong tuần, môn nặng nhận ngày cách xa nhau." className="py-10" />
            ) : preview.loading && !preview.data ? (
              <Skeleton rows={4} />
            ) : preview.error ? (
              <ErrorBox message={preview.error} />
            ) : preview.data ? (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Figure label="Bắt đầu" value={formatDate(preview.data.startDate)} />
                  <Figure label="Kết thúc (tự tính)" value={formatDate(preview.data.endDate)} strong />
                  <Figure label="Thời lượng" value={`${preview.data.totalWeeks} tuần`} />
                  <Figure label="Số buổi sẽ sinh" value={`${preview.data.sessions.length} buổi`} />
                </div>
                <SessionPlanGrid
                  sessions={preview.data.sessions}
                  startDate={preview.data.startDate}
                  endDate={preview.data.endDate}
                  today={today}
                  maxHeight="max-h-[520px]"
                />
              </>
            ) : null}
          </Card>
          <Notice tone="info" icon={<Info size={16} />}>
            Mở lớp sinh toàn bộ buổi học với nội dung chụp lại từ môn học lúc này. Sau đó sửa giáo án hay môn học cũng không làm đổi các
            buổi đã sinh. Buổi thêm và hủy buổi điều chỉnh ở trang chi tiết lớp.
          </Notice>
        </aside>
      </div>
      {leaveConfirmModal}
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={cn('font-semibold tabular-nums', strong ? 'text-emerald-800' : 'text-gray-900')}>{value}</p>
    </div>
  );
}
