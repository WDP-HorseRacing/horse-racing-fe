// Sửa hoặc thêm một buổi tập: dùng ở bản xem trước khi tạo lớp và ở lịch buổi của lớp (buổi nháp).
// Đổi môn thì điền lại cường độ, cự ly, mặt sân, thời gian mục tiêu theo môn mới (vẫn sửa tay được sau đó).
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { TrainingIntensity, TrainingSubject } from '../../../api/types';
import { Button, ErrorBox, Field, Input, Segmented, Select, Sheet, Textarea, invalidClass } from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { addMinutes, clubDateKey, clubInstant, clubTime, minutesBetween, parseClockTime } from '../../../lib/club-time';
import { SURFACE_SUGGESTIONS } from '../../../lib/training-labels';
import { IntensityBars } from './bits';
import { RaceTimeInput } from './RaceTimeInput';
import { Stepper } from './Stepper';

/** Một buổi đang soạn (chưa lưu hoặc buổi nháp). Giờ theo lịch CLB. */
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
export function sessionErrors(draft: SessionDraft, subject: TrainingSubject | undefined, range?: { from: string; to: string }) {
  const errors: Partial<Record<'name' | 'subjectId' | 'time' | 'date' | 'plannedDistanceM' | 'targetTimeMs', string>> = {};
  if (!subject) errors.subjectId = 'Chọn môn học';
  if (!draft.name.trim()) errors.name = 'Nhập tên buổi';
  else if (draft.name.trim().length > 160) errors.name = 'Tên tối đa 160 ký tự';
  if (new Date(draft.scheduledEndAt) <= new Date(draft.scheduledStartAt)) errors.time = 'Giờ kết thúc phải sau giờ bắt đầu';
  if (range) {
    const start = clubDateKey(draft.scheduledStartAt);
    const end = clubDateKey(draft.scheduledEndAt);
    if (start < range.from || end > range.to) errors.date = 'Buổi phải nằm trong thời gian của lớp';
  }
  if (draft.plannedDistanceM < 0 || draft.plannedDistanceM > 20000) errors.plannedDistanceM = 'Cự ly từ 0 đến 20.000 m';
  else if (subject?.sessionType === 'TIME_TRIAL' && draft.plannedDistanceM <= 0) errors.plannedDistanceM = 'Buổi chạy thử phải có cự ly lớn hơn 0';
  return errors;
}

export function SessionEditSheet({
  title,
  description,
  initial,
  subjects,
  range,
  pending,
  error,
  submitLabel = 'Lưu buổi',
  onSubmit,
  onRemove,
  onClose,
}: {
  title: string;
  description?: string;
  initial: SessionDraft;
  subjects: TrainingSubject[];
  range?: { from: string; to: string };
  pending?: boolean;
  error?: string;
  submitLabel?: string;
  onSubmit: (draft: SessionDraft) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [date, setDate] = useState(clubDateKey(initial.scheduledStartAt));
  const [time, setTime] = useState(clubTime(initial.scheduledStartAt));
  const [duration, setDuration] = useState(Math.max(15, minutesBetween(initial.scheduledStartAt, initial.scheduledEndAt)));
  const [touched, setTouched] = useState(false);
  const subject = subjects.find((item) => item.id === draft.subjectId);
  const trial = subject?.sessionType === 'TIME_TRIAL';
  const parsedTime = parseClockTime(time);

  const startAt = date && parsedTime ? clubInstant(date, parsedTime) : draft.scheduledStartAt;
  const current: SessionDraft = { ...draft, scheduledStartAt: startAt, scheduledEndAt: addMinutes(startAt, duration) };
  const errors = sessionErrors(current, subject, range);
  if (!parsedTime) errors.time = 'Giờ dạng HH:mm, ví dụ 06:30';
  const show = (key: keyof typeof errors) => (touched ? errors[key] : undefined);

  const pickSubject = (id: string) => {
    const next = subjects.find((item) => item.id === id);
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
  };

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    onSubmit({ ...current, targetTimeMs: trial ? current.targetTimeMs : undefined });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          {onRemove && (
            <Button variant="inlineDanger" className="mr-auto" onClick={onRemove}>
              <Trash2 size={14} /> Bỏ buổi
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Đang lưu…' : submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <ErrorBox message={error} />}
        <Field label="Môn học" required error={show('subjectId')} hint="Đổi môn thì cường độ, cự ly, mặt sân lấy lại theo môn mới.">
          <Select value={draft.subjectId} onChange={(event) => pickSubject(event.target.value)}>
            {!subject && <option value="">Chọn môn</option>}
            {subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sessionType === 'TIME_TRIAL' ? `${item.name} (chạy thử)` : item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tên buổi" required error={show('name')}>
          <Input value={draft.name} maxLength={160} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} className={show('name') ? invalidClass : ''} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ngày" required error={show('date')} className="sm:col-span-3">
            <DatePicker value={date} onChange={setDate} min={range?.from} max={range?.to} clearable={false} invalid={!!show('date')} />
          </Field>
          <Field label="Giờ bắt đầu" required error={show('time')}>
            <Input value={time} inputMode="numeric" placeholder="06:30" onChange={(event) => setTime(event.target.value)} onBlur={() => parsedTime && setTime(parsedTime)} className={`font-mono ${show('time') ? invalidClass : ''}`} />
          </Field>
          <Field label="Thời lượng" className="sm:col-span-2" hint={parsedTime ? `Kết thúc lúc ${clubTime(addMinutes(startAt, duration))}` : undefined}>
            <Stepper value={duration} onChange={setDuration} min={15} max={480} step={15} suffix="phút" label="thời lượng" />
          </Field>
        </div>

        <Field label="Cường độ" hint="Buổi Nặng: ngựa đang cần theo dõi sẽ không được tập.">
          <Segmented<TrainingIntensity>
            value={draft.intensity}
            onChange={(value) => setDraft((current) => ({ ...current, intensity: value }))}
            options={(['LIGHT', 'MODERATE', 'HEAVY'] as const).map((value) => ({ value, label: <IntensityBars intensity={value} className="text-inherit" /> }))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cự ly dự kiến" error={show('plannedDistanceM')}>
            <Stepper value={draft.plannedDistanceM} onChange={(value) => setDraft((current) => ({ ...current, plannedDistanceM: value }))} min={0} max={20000} step={100} suffix="m" label="cự ly" />
          </Field>
          {trial && (
            <Field label="Thời gian mục tiêu" hint="Phút:giây.phần trăm giây">
              <RaceTimeInput value={draft.targetTimeMs} onChange={(ms) => setDraft((current) => ({ ...current, targetTimeMs: ms }))} />
            </Field>
          )}
        </div>

        <Field label="Mặt sân">
          <Input value={draft.surface} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, surface: event.target.value }))} />
          <span className="mt-2 flex flex-wrap gap-1.5">
            {SURFACE_SUGGESTIONS.map((surface) => (
              <button
                key={surface}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, surface }))}
                className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300"
              >
                {surface}
              </button>
            ))}
          </span>
        </Field>
        <Field label="Địa điểm">
          <Input value={draft.location} placeholder="Ví dụ: Đường đua số 2" onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} />
        </Field>
        <Field label="Ghi chú cho Groom">
          <Textarea rows={2} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
        </Field>
      </div>
    </Sheet>
  );
}
