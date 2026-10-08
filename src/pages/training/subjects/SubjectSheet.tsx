// Thêm hoặc sửa một môn học (Club Manager). Kiểm tra giống BE trước khi gửi:
// tên 1 đến 160 ký tự và không trùng, cự ly 0 đến 20.000 m, môn chạy thử cự ly lớn hơn 0, môn thường không có thời gian mục tiêu.
import { useState } from 'react';
import { Flag, Footprints } from 'lucide-react';
import { createSubject, updateSubject } from '../../../api/training';
import type { TrainingIntensity, TrainingSessionType, TrainingSubject, TrainingSubjectInput } from '../../../api/types';
import { Button, CharCount, ErrorBox, Field, Input, Segmented, Sheet, Textarea, cn, invalidClass, scrollToFirstError, useToast } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';
import { SURFACE_SUGGESTIONS } from '../../../lib/training-labels';
import { fieldFromMessage } from '../../../lib/errors';
import { Stepper } from '../components/Stepper';
import { IntensityBars } from '../components/bits';
import { RaceTimeInput } from '../components/RaceTimeInput';

interface Draft {
  name: string;
  description: string;
  sessionType: TrainingSessionType;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  surface: string;
  targetTimeMs?: number;
  targetRaw: string;
}

function initial(subject?: TrainingSubject): Draft {
  return {
    name: subject?.name ?? '',
    description: subject?.description ?? '',
    sessionType: subject?.sessionType ?? 'REGULAR',
    intensity: subject?.intensity ?? 'MODERATE',
    plannedDistanceM: subject?.plannedDistanceM ?? 1600,
    surface: subject?.surface ?? '',
    targetTimeMs: subject?.targetTimeMs ?? undefined,
    targetRaw: '',
  };
}

export default function SubjectSheet({
  subject,
  existingNames,
  onClose,
  onSaved,
}: {
  subject?: TrainingSubject;
  existingNames: string[];
  onClose: () => void;
  onSaved: (subject: TrainingSubject) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => initial(subject));
  const [touched, setTouched] = useState(false);
  const save = useAction();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const trial = draft.sessionType === 'TIME_TRIAL';

  const errors: Partial<Record<'name' | 'plannedDistanceM' | 'targetTimeMs' | 'surface', string>> = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'Nhập tên môn';
  else if (name.length > 160) errors.name = 'Tên tối đa 160 ký tự';
  else if (existingNames.some((item) => item.trim().toLowerCase() === name.toLowerCase())) errors.name = 'Tên môn đã có trong danh mục';
  if (!Number.isInteger(draft.plannedDistanceM) || draft.plannedDistanceM < 0 || draft.plannedDistanceM > 20000) errors.plannedDistanceM = 'Cự ly từ 0 đến 20.000 m';
  else if (trial && draft.plannedDistanceM === 0) errors.plannedDistanceM = 'Môn chạy thử phải có cự ly lớn hơn 0';
  if (trial && draft.targetRaw.trim() && !draft.targetTimeMs) errors.targetTimeMs = 'Nhập dạng phút:giây, ví dụ 1:15.40';
  if (draft.surface.trim().length > 80) errors.surface = 'Mặt sân tối đa 80 ký tự';

  // Lỗi BE (ví dụ tên trùng do người khác vừa tạo) gắn vào đúng ô.
  const serverField = save.field ?? fieldFromSubjectMessage(save.error);
  const fieldError = (key: keyof typeof errors) => (touched ? errors[key] : undefined) ?? (serverField === key ? save.error : undefined);

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) {
      window.setTimeout(() => scrollToFirstError(), 0);
      return;
    }
    const input: TrainingSubjectInput = {
      name,
      description: draft.description.trim() || (subject ? null : undefined),
      sessionType: draft.sessionType,
      intensity: draft.intensity,
      plannedDistanceM: draft.plannedDistanceM,
      surface: draft.surface.trim() || (subject ? null : undefined),
      targetTimeMs: trial ? (draft.targetTimeMs ?? (subject ? null : undefined)) : subject?.targetTimeMs ? null : undefined,
    };
    void save.run(
      () => (subject ? updateSubject(subject.id, input) : createSubject(input)),
      (saved) => {
        toast.push(subject ? `Đã lưu môn ${saved.name}` : `Đã thêm môn ${saved.name}`, 'success');
        onSaved(saved);
      },
    );
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={subject ? 'Sửa môn học' : 'Thêm môn học'}
      description="Môn là một bài tập cố định. Giáo án ghép các môn theo tuần."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={save.pending}>
            {save.pending ? 'Đang lưu…' : subject ? 'Lưu thay đổi' : 'Thêm môn'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {save.error && !serverField && <ErrorBox message={save.error} />}

        <Field label="Tên môn" required name="name" error={fieldError('name')} counter={<CharCount value={draft.name} max={160} />}>
          <Input value={draft.name} maxLength={160} autoFocus placeholder="Ví dụ: Phi nước đại 1.600 m" onChange={(event) => set('name', event.target.value)} className={fieldError('name') ? invalidClass : ''} />
        </Field>

        <Field label="Loại buổi">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'REGULAR', label: 'Buổi thường', hint: 'Bài tập luyện hằng ngày', icon: Footprints },
                { value: 'TIME_TRIAL', label: 'Chạy thử', hint: 'Bấm giờ, so với mục tiêu', icon: Flag },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => set('sessionType', option.value)}
                className={cn(
                  'flex items-start gap-3 rounded-xl p-3 text-left ring-1 transition',
                  draft.sessionType === option.value ? 'bg-emerald-50/70 ring-2 ring-emerald-500/60' : 'bg-white ring-gray-200 hover:ring-gray-300',
                )}
              >
                <option.icon size={18} className={draft.sessionType === option.value ? 'text-emerald-700' : 'text-gray-400'} />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{option.label}</span>
                  <span className="block text-xs text-gray-500">{option.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Cường độ" hint="Ngựa đang cần theo dõi không tập được buổi cường độ nặng.">
          <Segmented<TrainingIntensity>
            value={draft.intensity}
            onChange={(value) => set('intensity', value)}
            options={(['LIGHT', 'MODERATE', 'HEAVY'] as const).map((value) => ({ value, label: <IntensityBars intensity={value} className="text-inherit" /> }))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cự ly dự kiến" required name="plannedDistanceM" error={fieldError('plannedDistanceM')}>
            <Stepper value={draft.plannedDistanceM} onChange={(value) => set('plannedDistanceM', value)} min={0} max={20000} step={100} suffix="m" label="cự ly" />
          </Field>
          {trial && (
            <Field label="Thời gian mục tiêu" name="targetTimeMs" error={fieldError('targetTimeMs')} hint="Phút:giây.phần trăm giây">
              <RaceTimeInput
                value={draft.targetTimeMs}
                invalid={!!fieldError('targetTimeMs')}
                onChange={(ms, raw) => setDraft((current) => ({ ...current, targetTimeMs: ms, targetRaw: raw }))}
              />
            </Field>
          )}
        </div>

        <Field label="Mặt sân" name="surface" error={fieldError('surface')}>
          <Input value={draft.surface} maxLength={80} placeholder="Ví dụ: Cỏ" onChange={(event) => set('surface', event.target.value)} />
          <span className="mt-2 flex flex-wrap gap-1.5">
            {SURFACE_SUGGESTIONS.map((surface) => (
              <button
                key={surface}
                type="button"
                onClick={() => set('surface', surface)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs ring-1 transition',
                  draft.surface === surface ? 'bg-emerald-50 text-emerald-800 ring-emerald-500/50' : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-300',
                )}
              >
                {surface}
              </button>
            ))}
          </span>
        </Field>

        <Field label="Mô tả bài tập">
          <Textarea rows={3} value={draft.description} placeholder="Khởi động, số vòng, lưu ý cho Groom…" onChange={(event) => set('description', event.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

function fieldFromSubjectMessage(message: string | undefined) {
  if (!message) return undefined;
  if (message.includes('Tên môn')) return 'name';
  if (message.includes('cự ly')) return 'plannedDistanceM';
  if (message.includes('thời gian mục tiêu')) return 'targetTimeMs';
  return fieldFromMessage(message);
}
