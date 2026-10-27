// Thêm hoặc sửa một môn học (Club Manager). Kiểm tra giống BE trước khi gửi:
// tên 1 đến 160 ký tự và không trùng, cự ly 0 đến 20.000 m, thời lượng 15 đến 480 phút, môn chạy thử cự ly lớn hơn 0,
// môn thường không có thời gian mục tiêu. Thời lượng là độ dài một buổi: lịch lớp tự tính giờ kết thúc theo số này.
// Lỗi của từng ô hiện khi rời ô hoặc bấm lưu; lỗi BE (tên trùng do người khác vừa tạo) mất khi sửa ô đó.
import { useMemo, useRef, useState } from 'react';
import { Flag, Footprints } from 'lucide-react';
import { createSubject, updateSubject } from '../../../api/training';
import type { TrainingIntensity, TrainingSessionType, TrainingSubject, TrainingSubjectInput } from '../../../api/types';
import { Button, CancelButton, CharCount, ErrorBox, Field, Input, Segmented, Sheet, Textarea, cn, invalidClass, useToast } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { SURFACE_SUGGESTIONS } from '../../../lib/training-labels';
import { fieldFromMessage } from '../../../lib/errors';
import { Stepper } from '../components/Stepper';
import { IntensityBars } from '../components/bits';
import { RaceTimeInput } from '../components/RaceTimeInput';

/** Giới hạn của BE (mô tả BE không giới hạn, FE đặt 2000). */
const NAME_MAX = 160;
const SURFACE_MAX = 80;
const DESCRIPTION_MAX = 2000;

const SUBJECT_FIELDS = ['name', 'plannedDistanceM', 'durationMinutes', 'targetTimeMs', 'surface', 'description'] as const;
type SubjectField = (typeof SUBJECT_FIELDS)[number];

interface Draft {
  name: string;
  description: string;
  sessionType: TrainingSessionType;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  durationMinutes: number;
  surface: string;
  targetTimeMs?: number;
  /** Câu lỗi khi ô thời gian mục tiêu gõ sai (vd 1:75). */
  targetIssue?: string;
}

function initial(subject?: TrainingSubject): Draft {
  return {
    name: subject?.name ?? '',
    description: subject?.description ?? '',
    sessionType: subject?.sessionType ?? 'REGULAR',
    intensity: subject?.intensity ?? 'LIGHT',
    plannedDistanceM: subject?.plannedDistanceM ?? 1600,
    durationMinutes: subject?.durationMinutes ?? 60,
    surface: subject?.surface ?? '',
    targetTimeMs: subject?.targetTimeMs ?? undefined,
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
  const [opened] = useState(() => JSON.stringify(draft));
  const save = useAction();
  const bodyRef = useRef<HTMLDivElement>(null);
  const trial = draft.sessionType === 'TIME_TRIAL';

  const name = draft.name.trim();
  const errors = useMemo(() => {
    const result: Partial<Record<SubjectField, string>> = {};
    if (!name) result.name = 'Nhập tên môn';
    else if (name.length > NAME_MAX) result.name = `Tên tối đa ${NAME_MAX} ký tự`;
    else if (existingNames.some((item) => item.trim().toLowerCase() === name.toLowerCase())) result.name = 'Tên môn đã có trong danh mục';
    if (!Number.isInteger(draft.plannedDistanceM) || draft.plannedDistanceM < 0 || draft.plannedDistanceM > 20000) result.plannedDistanceM = 'Cự ly từ 0 đến 20.000 m';
    else if (trial && draft.plannedDistanceM === 0) result.plannedDistanceM = 'Môn chạy thử phải có cự ly lớn hơn 0';
    if (!Number.isInteger(draft.durationMinutes) || draft.durationMinutes < 15 || draft.durationMinutes > 480) result.durationMinutes = 'Thời lượng từ 15 đến 480 phút';
    if (trial && draft.targetIssue) result.targetTimeMs = draft.targetIssue;
    if (draft.surface.trim().length > SURFACE_MAX) result.surface = `Mặt sân tối đa ${SURFACE_MAX} ký tự`;
    if (draft.description.trim().length > DESCRIPTION_MAX) result.description = `Mô tả tối đa ${DESCRIPTION_MAX} ký tự`;
    return result;
  }, [name, existingNames, draft, trial]);

  // Lỗi BE (ví dụ tên trùng do người khác vừa tạo) gắn vào đúng ô.
  const serverField = save.field ?? fieldFromSubjectMessage(save.error);
  // Chỉ giữ lỗi của các ô có trên form; lỗi khác hiện ở khung lỗi chung.
  const serverErrors = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of SUBJECT_FIELDS) {
      const message = save.fieldErrors[key] ?? (serverField === key ? save.error : undefined);
      if (message) result[key] = message;
    }
    return result;
  }, [save.fieldErrors, serverField, save.error]);
  const f = useFormErrors(errors, { fieldErrors: serverErrors });
  const fieldShown = Object.keys(serverErrors).length > 0;

  /** Sửa một ô: bỏ lỗi BE đang gắn vào ô đó. */
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (serverErrors[key]) save.clearError();
  };

  const submit = () => {
    if (!f.attempt(bodyRef.current ?? undefined)) return;
    const input: TrainingSubjectInput = {
      name,
      description: draft.description.trim() || (subject ? null : undefined),
      sessionType: draft.sessionType,
      intensity: draft.intensity,
      plannedDistanceM: draft.plannedDistanceM,
      durationMinutes: draft.durationMinutes,
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
      dirty={JSON.stringify(draft) !== opened}
      busy={save.pending}
      onSave={submit}
      saveLabel={subject ? 'Lưu' : 'Thêm'}
      footer={
        <>
          <CancelButton />
          <Button onClick={submit} disabled={save.pending}>
            {save.pending ? 'Đang lưu…' : subject ? 'Lưu' : 'Thêm'}
          </Button>
        </>
      }
    >
      <div ref={bodyRef} className="space-y-5">
        {save.error && !fieldShown && <ErrorBox message={save.error} />}

        <Field label="Tên môn" required name="name" error={f.show('name')} onBlur={f.blur('name')} counter={<CharCount value={draft.name} max={NAME_MAX} />}>
          <Input value={draft.name} maxLength={NAME_MAX} autoFocus placeholder="Ví dụ: Phi nước đại 1.600 m" onChange={(event) => set('name', event.target.value)} className={f.show('name') ? invalidClass : ''} />
        </Field>

        <Field label="Loại buổi">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'REGULAR', label: 'Buổi thường', hint: 'Bài tập luyện hằng ngày', icon: Footprints },
                { value: 'TIME_TRIAL', label: 'Chạy thử', hint: 'Ghi thời gian, so với mục tiêu', icon: Flag },
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

        <Field label="Cường độ" hint="Ngựa cần theo dõi chỉ tập buổi Nhẹ.">
          <Segmented<TrainingIntensity>
            value={draft.intensity}
            onChange={(value) => set('intensity', value)}
            options={(['LIGHT', 'HEAVY'] as const).map((value) => ({ value, label: <IntensityBars intensity={value} className="text-inherit" /> }))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cự ly dự kiến" required name="plannedDistanceM" error={f.show('plannedDistanceM')} onBlur={f.blur('plannedDistanceM')}>
            <Stepper value={draft.plannedDistanceM} onChange={(value) => set('plannedDistanceM', value)} min={0} max={20000} step={100} suffix="m" label="cự ly" />
          </Field>
          <Field label="Thời lượng một buổi" required name="durationMinutes" error={f.show('durationMinutes')} onBlur={f.blur('durationMinutes')}>
            <Stepper value={draft.durationMinutes} onChange={(value) => set('durationMinutes', value)} min={15} max={480} step={15} suffix="phút" label="thời lượng" />
          </Field>
          {trial && (
            <Field label="Thời gian mục tiêu" name="targetTimeMs" error={f.show('targetTimeMs')} onBlur={f.blur('targetTimeMs')} hint="Ví dụ 1 phút 15,4 giây">
              <RaceTimeInput
                value={draft.targetTimeMs}
                invalid={!!f.show('targetTimeMs')}
                onChange={(ms, issue) => {
                  setDraft((current) => ({ ...current, targetTimeMs: ms, targetIssue: issue }));
                  if (serverErrors.targetTimeMs) save.clearError();
                }}
              />
            </Field>
          )}
        </div>

        <Field label="Mặt sân" name="surface" error={f.show('surface')} onBlur={f.blur('surface')}>
          <Input value={draft.surface} maxLength={SURFACE_MAX} placeholder="Ví dụ: Cỏ" onChange={(event) => set('surface', event.target.value)} className={f.show('surface') ? invalidClass : ''} />
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

        <Field label="Mô tả bài tập" name="description" error={f.show('description')} onBlur={f.blur('description')} counter={<CharCount value={draft.description} max={DESCRIPTION_MAX} />}>
          <Textarea
            rows={3}
            maxLength={DESCRIPTION_MAX}
            value={draft.description}
            placeholder="Khởi động, số vòng, lưu ý cho Groom…"
            onChange={(event) => set('description', event.target.value)}
            className={f.show('description') ? invalidClass : ''}
          />
        </Field>
      </div>
    </Sheet>
  );
}

function fieldFromSubjectMessage(message: string | undefined) {
  if (!message) return undefined;
  if (message.includes('Tên môn')) return 'name';
  if (message.includes('cự ly')) return 'plannedDistanceM';
  if (message.includes('Thời lượng') || message.includes('thời lượng')) return 'durationMinutes';
  if (message.includes('thời gian mục tiêu')) return 'targetTimeMs';
  return fieldFromMessage(message);
}
