// Sửa hoặc thêm một buổi tập trên lịch tuần của lớp. Môn chỉ chọn trong giai đoạn chứa ngày của buổi (BE chặn 409 nếu sai).
// Đổi môn thì điền lại cường độ, cự ly, mặt sân, thời gian mục tiêu và thời lượng theo môn mới (vẫn sửa tay được sau đó).
// Tuần mẫu khi mở lớp (`days`): chọn thứ thay cho ngày, không kiểm giờ đã qua. `conflict` gắn lỗi luật xếp lịch (trùng giờ,
// nghỉ 3 giờ, giới hạn ngày) vào ô giờ.
// Không xếp buổi ở quá khứ: giờ bắt đầu phải sau thời điểm hiện tại (BE kiểm lại, lỗi theo ô hiện đúng chỗ).
// Lỗi của từng ô hiện khi rời ô hoặc bấm lưu; thời gian mục tiêu gõ sai thì chặn lưu chứ không lặng lẽ xóa mục tiêu cũ.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import type { TrainingIntensity, TrainingSubject } from '../../../api/types';
import { Button, CancelButton, CharCount, ErrorBox, Field, Input, Segmented, Select, Sheet, Textarea, invalidClass } from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { addMinutes, clubDateKey, clubInstant, clubTime, clubToday, isoWeekdayOf, minutesBetween, parseClockTime } from '../../../lib/club-time';
import { now } from '../../../lib/clock';
import { SURFACE_SUGGESTIONS, weekdayShort } from '../../../lib/training-labels';
import { IntensityBars } from './bits';
import { RaceTimeInput } from './RaceTimeInput';
import { Stepper } from './Stepper';

/** Giới hạn độ dài của BE (ghi chú BE không giới hạn, FE đặt mức hợp lý). */
const NAME_MAX = 160;
const LOCATION_MAX = 160;
const SURFACE_MAX = 80;
const NOTES_MAX = 1000;

/** Một buổi đang soạn. Giờ theo lịch CLB. */
export interface SessionDraft {
  subjectId: string;
  name: string;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  surface: string;
  location: string;
  notes: string;
  targetTimeMs?: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
}

type SessionField = 'name' | 'subjectId' | 'time' | 'date' | 'plannedDistanceM' | 'targetTimeMs' | 'surface' | 'location' | 'notes';

export function draftFromSubject(subject: TrainingSubject, startAt: string, endAt: string): SessionDraft {
  return {
    subjectId: subject.id,
    name: subject.name,
    intensity: subject.intensity,
    plannedDistanceM: subject.plannedDistanceM,
    surface: subject.surface ?? '',
    location: '',
    notes: '',
    targetTimeMs: subject.sessionType === 'TIME_TRIAL' ? (subject.targetTimeMs ?? undefined) : undefined,
    scheduledStartAt: startAt,
    scheduledEndAt: endAt,
  };
}

/** Lỗi của một buổi theo luật BE. `range` là khoảng ngày của lớp (lịch CLB). */
export function sessionErrors(draft: SessionDraft, subject: TrainingSubject | undefined, range?: { from: string; to: string }, options: { allowPast?: boolean } = {}) {
  const errors: Partial<Record<SessionField, string>> = {};
  if (!subject) errors.subjectId = 'Chọn môn học';
  if (!draft.name.trim()) errors.name = 'Nhập tên buổi';
  else if (draft.name.trim().length > NAME_MAX) errors.name = `Tên tối đa ${NAME_MAX} ký tự`;
  if (!options.allowPast && new Date(draft.scheduledStartAt) <= now()) errors.time = 'Giờ bắt đầu phải sau thời điểm hiện tại';
  else if (new Date(draft.scheduledEndAt) <= new Date(draft.scheduledStartAt)) errors.time = 'Giờ kết thúc phải sau giờ bắt đầu';
  if (range) {
    const start = clubDateKey(draft.scheduledStartAt);
    const end = clubDateKey(draft.scheduledEndAt);
    if (start < range.from || end > range.to) errors.date = 'Buổi phải nằm trong thời gian của lớp';
  }
  if (draft.plannedDistanceM < 0 || draft.plannedDistanceM > 20000) errors.plannedDistanceM = 'Cự ly từ 0 đến 20.000 m';
  else if (subject?.sessionType === 'TIME_TRIAL' && draft.plannedDistanceM <= 0) errors.plannedDistanceM = 'Buổi chạy thử phải có cự ly lớn hơn 0';
  if (draft.surface.trim().length > SURFACE_MAX) errors.surface = `Mặt sân tối đa ${SURFACE_MAX} ký tự`;
  if (draft.location.trim().length > LOCATION_MAX) errors.location = `Địa điểm tối đa ${LOCATION_MAX} ký tự`;
  if (draft.notes.trim().length > NOTES_MAX) errors.notes = `Ghi chú tối đa ${NOTES_MAX} ký tự`;
  return errors;
}

function safeInstant(dateKey: string, time: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return undefined;
  try {
    return clubInstant(dateKey, time);
  } catch {
    return undefined;
  }
}

export function SessionEditSheet({
  title,
  description,
  initial,
  subjects: allSubjects,
  subjectsFor,
  days,
  conflict,
  range,
  pending,
  error,
  field,
  fieldErrors = {},
  submitLabel = 'Lưu',
  removeLabel = 'Bỏ buổi',
  extraActions,
  onSubmit,
  onRemove,
  onClearError,
  onClose,
}: {
  title: string;
  description?: string;
  initial: SessionDraft;
  subjects: TrainingSubject[];
  /** Môn dùng được cho một ngày (môn của giai đoạn chứa ngày đó). Không truyền thì dùng `subjects`. */
  subjectsFor?: (dateKey: string) => TrainingSubject[];
  /** Tuần mẫu: 7 ngày của tuần để chọn thứ thay cho ô ngày. */
  days?: string[];
  /** Lỗi luật xếp lịch của buổi đang soạn (trùng giờ, nghỉ 3 giờ, giới hạn ngày), gắn vào ô giờ. */
  conflict?: (draft: SessionDraft) => string | undefined;
  range?: { from: string; to: string };
  pending?: boolean;
  error?: string;
  /** Ô mà lỗi chung của BE thuộc về (AppError.field). */
  field?: string;
  /** Lỗi theo ô của BE (`scheduledStartAt`, `sessions.N.scheduledStartAt`...). */
  fieldErrors?: Record<string, string>;
  submitLabel?: string;
  removeLabel?: string;
  /** Nút phụ ở chân sheet (vd mở sân tập). */
  extraActions?: ReactNode;
  onSubmit: (draft: SessionDraft) => void;
  onRemove?: () => void;
  /** Xóa lỗi BE khi người dùng sửa ô đang báo lỗi. */
  onClearError?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [date, setDate] = useState(clubDateKey(initial.scheduledStartAt));
  const [time, setTime] = useState(clubTime(initial.scheduledStartAt));
  const [duration, setDuration] = useState(Math.max(15, minutesBetween(initial.scheduledStartAt, initial.scheduledEndAt)));
  // Câu lỗi của ô thời gian mục tiêu khi gõ sai (vd 1:75), để chặn lưu thay vì gửi rỗng.
  const [targetIssue, setTargetIssue] = useState<string>();
  const bodyRef = useRef<HTMLDivElement>(null);
  const subjects = subjectsFor ? subjectsFor(date) : allSubjects;
  const subject = subjects.find((item) => item.id === draft.subjectId);
  const trial = subject?.sessionType === 'TIME_TRIAL';
  const parsedTime = parseClockTime(time);

  // Ngày gõ tay sai dạng thì giữ giờ cũ thay vì vỡ trang.
  const startAt = (date && parsedTime && safeInstant(date, parsedTime)) || draft.scheduledStartAt;
  const current: SessionDraft = { ...draft, scheduledStartAt: startAt, scheduledEndAt: addMinutes(startAt, duration) };
  const errors = sessionErrors(current, subject, range, { allowPast: !!days });
  if (!parsedTime) errors.time = 'Giờ dạng HH:mm, ví dụ 06:30';
  if (!subject && subjects.length === 0) errors.subjectId = 'Ngày này không thuộc giai đoạn nào của lớp';
  else if (!subject && draft.subjectId) errors.subjectId = 'Môn này không có trong giai đoạn của ngày đã chọn';
  if (trial && targetIssue) errors.targetTimeMs = targetIssue;
  if (!errors.time && !errors.date && parsedTime) {
    const clash = conflict?.(current);
    if (clash) errors.time = clash;
  }

  // Lỗi BE theo ô, kể cả ô lồng của thêm nhiều buổi ("sessions.0.scheduledStartAt").
  const server = useMemo(() => {
    const find = (name: string) =>
      Object.entries(fieldErrors).find(([key]) => key === name || key.endsWith(`.${name}`))?.[1] ?? (field && (field === name || field.endsWith(`.${name}`)) ? error : undefined);
    const result: Partial<Record<SessionField, string>> = {
      time: find('scheduledStartAt') ?? find('scheduledEndAt'),
      subjectId: find('subjectId'),
      name: find('name'),
      plannedDistanceM: find('plannedDistanceM'),
      targetTimeMs: find('targetTimeMs'),
      surface: find('surface'),
      location: find('location'),
      notes: find('notes'),
    };
    return Object.fromEntries(Object.entries(result).filter(([, value]) => value)) as Record<string, string>;
  }, [fieldErrors, field, error]);
  const f = useFormErrors(errors, { fieldErrors: server });
  const fieldShown = Object.keys(server).length > 0;
  const minDate = range?.from && range.from > clubToday() ? range.from : clubToday();
  // So với lúc mở để hỏi trước khi đóng nếu bấm ra ngoài khi đang sửa dở.
  const [opened] = useState(() => JSON.stringify([draft, date, time, duration]));
  const dirty = JSON.stringify([draft, date, time, duration]) !== opened;

  /** Sửa một ô: bỏ lỗi BE đang gắn vào ô đó. */
  const cleared = (...keys: SessionField[]) => {
    if (keys.some((key) => server[key])) onClearError?.();
  };
  const setField = <K extends keyof SessionDraft>(key: K, value: SessionDraft[K], serverKey: SessionField) => {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
    cleared(serverKey);
  };

  const pickSubject = (id: string, list = subjects) => {
    const next = list.find((item) => item.id === id);
    if (!next) return;
    setDraft((value) => ({
      ...value,
      subjectId: next.id,
      name: value.name === subject?.name || !value.name.trim() ? next.name : value.name,
      intensity: next.intensity,
      plannedDistanceM: next.plannedDistanceM,
      surface: next.surface ?? value.surface,
      targetTimeMs: next.sessionType === 'TIME_TRIAL' ? (next.targetTimeMs ?? undefined) : undefined,
    }));
    // Môn mới nạp mục tiêu của nó (hoặc không phải chạy thử): ô mục tiêu nạp lại, bỏ lỗi gõ dở.
    if (next.sessionType !== 'TIME_TRIAL' || next.targetTimeMs) setTargetIssue(undefined);
    setDuration(next.durationMinutes);
    cleared('subjectId', 'name', 'plannedDistanceM', 'targetTimeMs', 'surface');
  };

  // Đổi ngày sang giai đoạn khác mà môn đang chọn không có trong đó: chọn môn đầu của giai đoạn mới.
  const pickDate = (value: string) => {
    setDate(value);
    cleared('time', 'subjectId');
    if (!subjectsFor) return;
    const list = subjectsFor(value);
    if (list.length && !list.some((item) => item.id === draft.subjectId)) pickSubject(list[0].id, list);
  };

  const submit = () => {
    if (!f.attempt(bodyRef.current ?? undefined)) return;
    onSubmit({ ...current, targetTimeMs: trial ? current.targetTimeMs : undefined });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      description={description}
      dirty={dirty}
      busy={pending}
      onSave={submit}
      saveLabel={submitLabel}
      footer={
        <>
          {onRemove && (
            <Button variant="inlineDanger" className="mr-auto" disabled={pending} onClick={onRemove}>
              <Trash2 size={14} /> {removeLabel}
            </Button>
          )}
          {extraActions}
          <CancelButton />
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Đang lưu…' : submitLabel}
          </Button>
        </>
      }
    >
      <div ref={bodyRef} className="space-y-5">
        {error && !fieldShown && <ErrorBox message={error} />}
        <Field label="Môn học" required name="subjectId" error={f.show('subjectId')} onBlur={f.blur('subjectId')} hint="Chỉ có môn của giai đoạn chứa ngày này.">
          <Select value={draft.subjectId} onChange={(event) => pickSubject(event.target.value)}>
            {!subject && <option value="">Chọn môn</option>}
            {subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sessionType === 'TIME_TRIAL' ? `${item.name} (chạy thử, ${item.durationMinutes} phút)` : `${item.name} (${item.durationMinutes} phút)`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tên buổi" required name="name" error={f.show('name')} onBlur={f.blur('name')}>
          <Input value={draft.name} maxLength={NAME_MAX} onChange={(event) => setField('name', event.target.value, 'name')} className={f.show('name') ? invalidClass : ''} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          {days ? (
            <Field label="Thứ" required className="sm:col-span-3">
              <Segmented<string> value={date} onChange={pickDate} options={days.map((day) => ({ value: day, label: weekdayShort[isoWeekdayOf(day)] }))} />
            </Field>
          ) : (
            <Field label="Ngày" required name="date" error={f.show('date')} onBlur={f.blur('date')} className="sm:col-span-3">
              <DatePicker value={date} onChange={pickDate} min={minDate} max={range?.to} clearable={false} invalid={!!f.show('date')} />
            </Field>
          )}
          <Field label="Giờ bắt đầu" required name="time" error={f.show('time')} onBlur={f.blur('time')}>
            <Input
              value={time}
              inputMode="numeric"
              maxLength={5}
              placeholder="06:30"
              onChange={(event) => {
                setTime(event.target.value);
                cleared('time');
              }}
              onBlur={() => parsedTime && setTime(parsedTime)}
              className={`tabular-nums ${f.show('time') ? invalidClass : ''}`}
            />
          </Field>
          <Field label="Thời lượng" className="sm:col-span-2" hint={parsedTime ? `Kết thúc lúc ${clubTime(addMinutes(startAt, duration))}` : undefined}>
            <Stepper
              value={duration}
              onChange={(value) => {
                setDuration(value);
                cleared('time');
              }}
              min={15}
              max={480}
              step={15}
              suffix="phút"
              label="thời lượng"
            />
          </Field>
        </div>

        <Field label="Cường độ" hint="Ngựa cần theo dõi chỉ tập buổi Nhẹ. Mỗi ngày tối đa 2 buổi, 1 buổi Nặng.">
          <Segmented<TrainingIntensity>
            value={draft.intensity}
            onChange={(value) => setDraft((currentDraft) => ({ ...currentDraft, intensity: value }))}
            options={(['LIGHT', 'HEAVY'] as const).map((value) => ({ value, label: <IntensityBars intensity={value} className="text-inherit" /> }))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cự ly dự kiến" name="plannedDistanceM" error={f.show('plannedDistanceM')} onBlur={f.blur('plannedDistanceM')}>
            <Stepper value={draft.plannedDistanceM} onChange={(value) => setField('plannedDistanceM', value, 'plannedDistanceM')} min={0} max={20000} step={100} suffix="m" label="cự ly" />
          </Field>
          {trial && (
            <Field label="Thời gian mục tiêu" name="targetTimeMs" error={f.show('targetTimeMs')} onBlur={f.blur('targetTimeMs')} hint="Ví dụ 1 phút 15,4 giây. Bỏ trống nếu không đặt mục tiêu.">
              <RaceTimeInput
                value={draft.targetTimeMs}
                invalid={!!f.show('targetTimeMs')}
                onChange={(ms, issue) => {
                  setTargetIssue(issue);
                  setField('targetTimeMs', ms, 'targetTimeMs');
                }}
              />
            </Field>
          )}
        </div>

        <Field label="Mặt sân" name="surface" error={f.show('surface')} onBlur={f.blur('surface')}>
          <Input value={draft.surface} maxLength={SURFACE_MAX} onChange={(event) => setField('surface', event.target.value, 'surface')} className={f.show('surface') ? invalidClass : ''} />
          <span className="mt-2 flex flex-wrap gap-1.5">
            {SURFACE_SUGGESTIONS.map((surface) => (
              <button
                key={surface}
                type="button"
                onClick={() => setField('surface', surface, 'surface')}
                className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300"
              >
                {surface}
              </button>
            ))}
          </span>
        </Field>
        <Field label="Địa điểm" name="location" error={f.show('location')} onBlur={f.blur('location')}>
          <Input
            value={draft.location}
            maxLength={LOCATION_MAX}
            placeholder="Ví dụ: Đường đua số 2"
            onChange={(event) => setField('location', event.target.value, 'location')}
            className={f.show('location') ? invalidClass : ''}
          />
        </Field>
        <Field label="Ghi chú cho Groom" name="notes" error={f.show('notes')} onBlur={f.blur('notes')} counter={<CharCount value={draft.notes} max={NOTES_MAX} />}>
          <Textarea rows={2} maxLength={NOTES_MAX} value={draft.notes} onChange={(event) => setField('notes', event.target.value, 'notes')} className={f.show('notes') ? invalidClass : ''} />
        </Field>
      </div>
    </Sheet>
  );
}
