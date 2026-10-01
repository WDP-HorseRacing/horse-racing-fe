// F3.11 — Trang tạo lịch chăm sóc (VET): tiêm phòng, tẩy giun, kiểm tra móng.
// Cột trái: ngựa, loại, ngày đến hạn, người thực hiện, ghi chú. Cột phải: lịch đang có của ngựa để tránh tạo trùng.
// Tham số URL: horseId (cố định ngựa), back (trang quay về).
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarPlus, NotebookPen, Syringe, UserRound } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { getHorse } from '../../api/horses';
import { createCareSchedule, listCareSchedules } from '../../api/medical';
import type { CareTaskType } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { useCrumbs } from '../../components/Breadcrumb';
import { Button, CharCount, ErrorBox, Field, NotFound, PageHeader, Select, Skeleton, Textarea, cn, invalidClass, scrollToFirstError, useToast } from '../../components/ui';
import { careTypeLabel } from '../../lib/api-labels';
import { formatDateTime } from '../../lib/format';
import { links, safeInternalPath } from '../../lib/links';
import { now } from '../../lib/clock';
import { CareLine } from './components/care';
import { CARE_TYPES } from './components/care-rules';
import { horsePlace, useMedicalHorses } from './components/horses';
import { usePeople } from './components/people';
import { localToIso, toLocalInput, todayKey } from './components/utils';
import { BackLink, FormSection, HorseCard, Outcome, SaveCard } from './components/form-page';
import { DateTimePicker } from '../../components/ui/DatePicker';

const CARE_HINT: Record<CareTaskType, string> = {
  VACCINATION: 'Mũi tiêm phòng định kỳ hoặc nhắc lại',
  DEWORMING: 'Cho uống / tiêm thuốc tẩy giun',
  FARRIER: 'Kiểm tra, sửa hoặc đóng móng',
};

function defaultDue() {
  const date = now();
  date.setDate(date.getDate() + 7);
  date.setHours(8, 0, 0, 0);
  return toLocalInput(date);
}

export default function CareNew() {
  const [params] = useSearchParams();
  const fixedHorseId = params.get('horseId') ?? undefined;
  const back = safeInternalPath(params.get('back'));
  const navigate = useNavigate();
  const toast = useToast();
  const action = useAction();
  const user = useStore((state) => state.currentUser);
  const formRef = useRef<HTMLDivElement>(null);
  const options = useMedicalHorses('all', !fixedHorseId);

  const [horseId, setHorseId] = useState(fixedHorseId ?? '');
  const [type, setType] = useState<CareTaskType>('VACCINATION');
  const [dueAt, setDueAt] = useState(defaultDue);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [attempted, setAttempted] = useState(false);

  const context = useService(async () => {
    if (!horseId) return null;
    const [horse, schedules] = await Promise.all([getHorse(horseId), listCareSchedules(horseId)]);
    return { horse, schedules };
  }, [horseId]);
  const horse = context.data?.horse;
  const groom = horse?.groom ?? null;
  const people = usePeople(groom ? [groom] : []);

  useCrumbs(horse ? [{ label: horse.name, to: links.horseMedical(horse.id) }, { label: 'Tạo lịch chăm sóc' }] : [{ label: 'Tạo lịch' }], fixedHorseId ? [{ label: 'Y tế', to: links.medicalBoard }] : undefined);

  if (!can(user, 'care.manage')) return <NotFound message="Chỉ bác sĩ thú y tạo được lịch chăm sóc." />;

  // Mặc định giao cho Groom của ngựa (nếu có); người dùng đổi được.
  const assignee = assignedTo ?? groom?.id ?? '';
  const assignees: { id: string; label: string }[] = [];
  if (groom) assignees.push({ id: groom.id, label: `${groom.fullName} (Groom của ngựa)` });
  if (user && user.id !== groom?.id) assignees.push({ id: user.id, label: `Tôi (${user.name})` });

  const dueIso = localToIso(dueAt);
  const errors: Record<string, string> = {};
  if (!horseId) errors.horse = 'Chọn ngựa';
  if (!dueIso) errors.dueAt = 'Chọn ngày đến hạn';
  else if (dueAt.slice(0, 10) < todayKey()) errors.dueAt = 'Ngày đến hạn đã qua';
  const show = (key: string) => (attempted ? errors[key] : undefined);

  const upcoming = (context.data?.schedules ?? []).filter((row) => row.status === 'SCHEDULED');
  const sameType = upcoming.filter((row) => row.type === type);
  const cancelTo = back ?? (fixedHorseId ? links.horseMedical(fixedHorseId) : links.careSchedules);

  const submit = () => {
    setAttempted(true);
    if (Object.keys(errors).length > 0 || !horse) {
      scrollToFirstError(formRef.current ?? document);
      return;
    }
    action.run(
      () =>
        createCareSchedule(horse.id, {
          type,
          dueAt: dueIso!,
          ...(assignee ? { assignedTo: assignee } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      () => {
        toast.push(`Đã tạo lịch ${careTypeLabel[type].toLowerCase()} cho ${horse.name}`, 'success');
        navigate(back ?? (fixedHorseId ? links.horseMedical(horse.id) : links.careSchedules), { replace: true });
      },
    );
  };

  return (
    <div className="space-y-5" ref={formRef}>
      <PageHeader back={<BackLink to={cancelTo}>Quay lại</BackLink>} title="Tạo lịch chăm sóc" description="Hệ thống nhắc bác sĩ và người thực hiện lúc 7 giờ sáng ngày đến hạn." />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <FormSection icon={<Syringe size={16} />} title="Việc cần làm">
            {!fixedHorseId && (
              <Field label="Ngựa" required name="horse" error={show('horse')}>
                {options.loading && !options.data ? (
                  <Skeleton rows={1} />
                ) : (
                  <Select
                    value={horseId}
                    onChange={(event) => {
                      setHorseId(event.target.value);
                      setAssignedTo(null);
                    }}
                    className={cn(show('horse') && invalidClass)}
                  >
                    <option value="">Chọn ngựa…</option>
                    {options.data?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {horsePlace(item) ? ` · ${horsePlace(item)}` : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <div>
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                Loại<span className="ml-0.5 text-red-500">*</span>
              </span>
              <div className="grid gap-2 sm:grid-cols-3">
                {CARE_TYPES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    aria-pressed={type === value}
                    className={cn('rounded-xl bg-white px-4 py-3 text-left transition', type === value ? 'ring-2 ring-emerald-700' : 'ring-1 ring-gray-200 hover:ring-gray-300')}
                  >
                    <span className="block text-sm font-semibold text-gray-900">{careTypeLabel[value]}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{CARE_HINT[value]}</span>
                  </button>
                ))}
              </div>
            </div>
            <Field label="Ngày đến hạn" required name="dueAt" error={show('dueAt')} className="sm:max-w-xs">
              <DateTimePicker value={dueAt} min={`${todayKey()}T00:00`} onChange={setDueAt} invalid={!!show('dueAt')} />
            </Field>
          </FormSection>

          <FormSection icon={<UserRound size={16} />} title="Người thực hiện">
            {horseId && context.loading && !context.data ? (
              <Skeleton rows={1} />
            ) : (
              <Field className="sm:max-w-md">
                <Select value={assignee} onChange={(event) => setAssignedTo(event.target.value)} disabled={!horse}>
                  <option value="">Chưa giao</option>
                  {assignees.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {horse && !groom && <p className="text-sm text-gray-500">Ngựa chưa có Groom phụ trách.</p>}
          </FormSection>

          <FormSection icon={<NotebookPen size={16} />} title="Ghi chú">
            <Field counter={<CharCount value={notes} max={2000} />}>
              <Textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ví dụ: Vắc-xin cúm ngựa, mũi nhắc lại" />
            </Field>
          </FormSection>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
          {horse ? (
            <HorseCard name={horse.name} to={links.horseMedical(horse.id)} place={[horse.location.barn?.name, horse.location.stall?.code].filter(Boolean).join(' · ')} health={horse.healthStatus}>
              <p className="mb-2 text-xs font-medium text-gray-500">Lịch đang chờ của ngựa</p>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-400">Chưa có lịch nào.</p>
              ) : (
                <ul className="space-y-2.5">
                  {upcoming.map((row) => (
                    <li key={row.id}>
                      <CareLine schedule={row} people={people} />
                    </li>
                  ))}
                </ul>
              )}
            </HorseCard>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-5 text-sm text-gray-500">Chọn ngựa để xem các lịch đang có.</div>
          )}

          <SaveCard>
            <ul className="space-y-1.5">
              <Outcome>
                {careTypeLabel[type]}
                {horse ? ` cho ${horse.name}` : ''}
                {dueIso ? `, đến hạn ${formatDateTime(dueIso)}` : ''}
              </Outcome>
              <Outcome>{assignee ? `Giao cho ${assignees.find((item) => item.id === assignee)?.label ?? people.name(assignee)}` : 'Chưa giao người thực hiện'}</Outcome>
              {sameType.length > 0 && (
                <Outcome tone="warning">
                  Ngựa đã có {sameType.length} lịch {careTypeLabel[type].toLowerCase()} đang chờ (gần nhất {formatDateTime(sameType[0].dueAt)})
                </Outcome>
              )}
            </ul>
            {attempted && Object.keys(errors).length > 0 && <p className="text-sm text-red-600">Còn {Object.keys(errors).length} ô cần sửa ở bên trái.</p>}
            {action.error && <ErrorBox message={action.error} />}
            <div className="space-y-2 border-t border-gray-100 pt-4">
              <Button className="h-11 w-full" onClick={submit} disabled={action.pending}>
                <CalendarPlus size={16} /> {action.pending ? 'Đang lưu…' : 'Tạo lịch'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate(cancelTo)} disabled={action.pending}>
                Hủy
              </Button>
            </div>
          </SaveCard>
        </aside>
      </div>
    </div>
  );
}
