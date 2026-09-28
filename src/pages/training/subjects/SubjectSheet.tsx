// Biểu mẫu thêm/sửa môn học trong panel trượt phải — kiểm tra tức thì theo checkSubject.
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button, cn, ErrorBox, Field, Input, Notice, Sheet, Textarea } from '../../../components/ui';
import { intensityDot } from '../../../components/ui/status';
import { checkDistance, checkSubject, checkWorkoutIntensity, isHeavy } from '../../../lib/rules';
import { intensityLabel, surfaceLabel, workoutLabel } from '../../../lib/labels';
import type { TrackSurface, TrainingIntensity, WorkoutType } from '../../../types/domain';
import type { SubjectInput, SubjectRow } from '../../../services/training.service';
import { volumeLabel } from '../setup-components/helpers';

const EMPTY: SubjectInput = {
  name: '',
  workoutType: 'CANTER',
  distanceM: 1600,
  repetitions: 1,
  intensity: 'MEDIUM',
  surface: 'TURF',
  description: '',
};

const WORKOUT_HINT: Record<WorkoutType, string> = {
  WALK: 'Nhẹ hoặc Trung bình',
  TROT: 'Nhẹ hoặc Trung bình',
  CANTER: 'Mọi cường độ',
  BREEZE: 'Mọi cường độ',
  TIME_TRIAL: 'Chỉ Nặng hoặc Tối đa, lặp 1 lần',
};

export function SubjectSheet({
  open,
  initial,
  pending,
  error,
  errorField,
  onSubmit,
  onClose,
}: {
  open: boolean;
  initial?: SubjectRow;
  pending: boolean;
  error?: string;
  errorField?: string;
  onSubmit: (input: SubjectInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SubjectInput>(EMPTY);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(
        initial
          ? {
              name: initial.name,
              workoutType: initial.workoutType,
              distanceM: initial.distanceM,
              repetitions: initial.repetitions,
              intensity: initial.intensity,
              surface: initial.surface,
              description: initial.description ?? '',
            }
          : EMPTY,
      );
    }
  }

  const setWorkout = (workoutType: WorkoutType) => {
    setForm((current) => {
      const next = { ...current, workoutType };
      if (workoutType === 'TIME_TRIAL') {
        next.repetitions = 1;
        if (!isHeavy(next.intensity)) next.intensity = 'HEAVY';
      } else if ((workoutType === 'WALK' || workoutType === 'TROT') && isHeavy(next.intensity)) {
        next.intensity = 'LIGHT';
      }
      return next;
    });
  };

  const trial = form.workoutType === 'TIME_TRIAL';
  const intensityCheck = checkWorkoutIntensity(form.workoutType, form.intensity);
  const distanceCheck = checkDistance(Number(form.distanceM), Number(form.repetitions));
  const overall = checkSubject({ ...form, distanceM: Number(form.distanceM), repetitions: Number(form.repetitions) });
  const nameMissing = !form.name.trim();
  const serverError = (field: string) => (errorField === field ? error : undefined);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? `Sửa môn "${initial.name}"` : 'Thêm môn học'}
      description="Môn học là nội dung dùng lại được, không gắn ngựa. Buổi học đã sinh giữ nguyên nội dung cũ khi sửa môn."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={() => onSubmit(form)} disabled={pending || nameMissing || !overall.allowed}>
            {pending ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Thêm môn học'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {initial && initial.usedBySessions > 0 && (
          <Notice tone="info">
            Môn này đã sinh {initial.usedBySessions} buổi học. Sửa ở đây chỉ áp dụng cho giáo án và lớp mở sau; các buổi đã sinh
            giữ nguyên nội dung đã chụp lại.
          </Notice>
        )}

        <Field label="Tên môn học" required error={serverError('name')}>
          <Input
            value={form.name}
            maxLength={80}
            placeholder="Ví dụ: Nước rút 400 m"
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>

        <Field label="Loại bài tập" required hint={`Cường độ cho phép: ${WORKOUT_HINT[form.workoutType]}`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(workoutLabel) as WorkoutType[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setWorkout(key)}
                className={cn(
                  'rounded-xl px-3 py-2.5 text-sm font-medium ring-1 transition',
                  form.workoutType === key
                    ? 'bg-emerald-600 text-white ring-emerald-600'
                    : 'bg-white text-gray-600 ring-gray-200 hover:ring-emerald-300',
                )}
              >
                {workoutLabel[key]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Cường độ mặc định" required error={!intensityCheck.allowed ? intensityCheck.reason : serverError('intensity')}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(intensityLabel) as TrainingIntensity[]).map((key) => {
              const allowed = checkWorkoutIntensity(form.workoutType, key).allowed;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!allowed}
                  title={allowed ? undefined : checkWorkoutIntensity(form.workoutType, key).reason}
                  onClick={() => setForm({ ...form, intensity: key })}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-35',
                    form.intensity === key
                      ? 'bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500'
                      : 'bg-white text-gray-600 ring-gray-200 hover:ring-emerald-300',
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', intensityDot[key])} />
                  {intensityLabel[key]}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Cự ly mỗi lần (m)"
            required
            hint="200–4000 m"
            error={!distanceCheck.allowed && /Cự ly/.test(distanceCheck.reason ?? '') ? distanceCheck.reason : serverError('distanceM')}
          >
            <Input
              type="number"
              min={200}
              max={4000}
              step={100}
              value={form.distanceM}
              onChange={(event) => setForm({ ...form, distanceM: Number(event.target.value) })}
            />
          </Field>
          <Field
            label={
              <span className="inline-flex items-center gap-1.5">
                Số lần lặp {trial && <Lock size={12} className="text-gray-400" />}
              </span>
            }
            required
            hint={trial ? 'Chạy thử luôn lặp đúng 1 lần' : '1–10 lần'}
            error={!distanceCheck.allowed && /lặp/.test(distanceCheck.reason ?? '') ? distanceCheck.reason : serverError('repetitions')}
          >
            <Input
              type="number"
              min={1}
              max={10}
              disabled={trial}
              value={form.repetitions}
              onChange={(event) => setForm({ ...form, repetitions: Number(event.target.value) })}
            />
          </Field>
        </div>

        <Field label="Mặt sân" required>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(surfaceLabel) as TrackSurface[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm({ ...form, surface: key })}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-medium ring-1 transition',
                  form.surface === key
                    ? 'bg-emerald-600 text-white ring-emerald-600'
                    : 'bg-white text-gray-600 ring-gray-200 hover:ring-emerald-300',
                )}
              >
                Sân {surfaceLabel[key].toLowerCase()}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Mô tả">
          <Textarea
            value={form.description ?? ''}
            placeholder="Cách thực hiện, thời gian hồi sức giữa các lần…"
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>

        <div className="flex items-center justify-between rounded-xl bg-emerald-50/60 px-4 py-3 text-sm">
          <span className="text-gray-500">Khối lượng mỗi buổi</span>
          <span className="font-semibold text-emerald-900 tabular-nums">
            {Number.isFinite(form.distanceM * form.repetitions) ? volumeLabel(form.distanceM * form.repetitions) : '—'}
          </span>
        </div>

        {error && !['name', 'distanceM', 'repetitions', 'intensity'].includes(errorField ?? '') && <ErrorBox message={error} />}
      </div>
    </Sheet>
  );
}
