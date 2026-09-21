// Lưới tuần mẫu: cột là thứ trong tuần, hàng là khung giờ tập.
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Field, Input, Modal, Select } from './ui';
import { dayOfWeekLabel, intensityLabel, surfaceLabel, workoutLabel } from '../lib/labels';
import { checkDistance, checkWorkoutIntensity } from '../lib/rules';
import type { TrackSurface, TrainingIntensity, TrainingSlot, WorkoutType } from '../types/domain';
import type { WorkoutTemplateInput } from '../services/training.service';

const intensityTone: Record<TrainingIntensity, string> = {
  LIGHT: 'border-emerald-100 bg-emerald-50/70 text-emerald-800',
  MODERATE: 'border-sky-100 bg-sky-50/70 text-sky-800',
  HEAVY: 'border-amber-100 bg-amber-50/70 text-amber-800',
  MAXIMUM: 'border-red-100 bg-red-50/70 text-red-800',
};

export function WeekGrid({
  value,
  slots,
  onChange,
  readOnly,
}: {
  value: WorkoutTemplateInput[];
  slots: TrainingSlot[];
  onChange?: (next: WorkoutTemplateInput[]) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState<{ index: number | null; draft: WorkoutTemplateInput } | null>(null);
  const [error, setError] = useState<string>();

  const cellOf = (day: number, slotId: string) =>
    value.findIndex((item) => item.dayOfWeek === day && item.slotId === slotId);

  const openNew = (day: number, slotId: string) => {
    if (readOnly) return;
    setError(undefined);
    setEditing({
      index: null,
      draft: {
        dayOfWeek: day,
        slotId,
        workoutType: 'CANTER',
        distanceM: 1600,
        repetitions: 1,
        intensity: 'MODERATE',
        surface: 'DIRT',
      },
    });
  };

  const save = () => {
    if (!editing) return;
    const draft = editing.draft;
    const distance = checkDistance(draft.distanceM, draft.repetitions);
    if (!distance.allowed) return setError(distance.reason);
    const intensity = checkWorkoutIntensity(draft.workoutType, draft.intensity);
    if (!intensity.allowed) return setError(intensity.reason);
    if (draft.workoutType === 'TIME_TRIAL' && draft.repetitions !== 1) {
      return setError('Bài chạy thử luôn lặp 1 lần');
    }

    const next = [...value];
    if (editing.index === null) next.push(draft);
    else next[editing.index] = draft;
    onChange?.(next);
    setEditing(null);
  };

  const weeklyVolume = value.reduce((sum, item) => sum + item.distanceM * item.repetitions, 0);
  const restDays = 7 - new Set(value.map((item) => item.dayOfWeek)).size;

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-28 border-b border-gray-100 px-3 py-2.5 text-left text-xs font-semibold text-gray-400">
                Khung giờ
              </th>
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <th key={day} className="border-b border-l border-gray-100 px-2 py-2.5 text-center text-xs font-semibold text-gray-400">
                  {dayOfWeekLabel[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.id}>
                <td className="border-b border-gray-50 px-3 py-2 font-mono text-xs text-gray-400">
                  {slot.startTime}–{slot.endTime}
                </td>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const index = cellOf(day, slot.id);
                  const workout = index >= 0 ? value[index] : undefined;
                  return (
                    <td key={day} className="border-b border-l border-gray-50 p-1 align-top">
                      {workout ? (
                        <button
                          onClick={() => {
                            if (readOnly) return;
                            setError(undefined);
                            setEditing({ index, draft: { ...workout } });
                          }}
                          className={`w-full rounded-lg border p-2 text-left transition ${intensityTone[workout.intensity]} ${
                            readOnly ? 'cursor-default' : 'hover:brightness-95'
                          }`}
                        >
                          <p className="text-xs font-semibold">{workoutLabel[workout.workoutType]}</p>
                          <p className="text-[11px] opacity-80">
                            {workout.distanceM} m × {workout.repetitions}
                          </p>
                          <p className="text-[11px] opacity-70">
                            {intensityLabel[workout.intensity]} · {surfaceLabel[workout.surface]}
                          </p>
                        </button>
                      ) : readOnly ? (
                        <div className="h-full min-h-[46px]" />
                      ) : (
                        <button
                          onClick={() => openNew(day, slot.id)}
                          className="flex h-full min-h-[46px] w-full items-center justify-center rounded-lg text-gray-200 transition hover:bg-emerald-50 hover:text-emerald-500"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <span className="font-medium text-gray-600">
          Tổng khối lượng tuần: <span className="tabular-nums">{weeklyVolume.toLocaleString('vi-VN')} m</span>
        </span>
        <span className="text-gray-400">
          {restDays > 0 ? `${restDays} ngày nghỉ` : 'Tuần mẫu không có ngày nghỉ nào'}
        </span>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.index === null ? 'Thêm bài tập vào tuần mẫu' : 'Sửa bài tập'}
        footer={
          <>
            {editing?.index !== null && editing !== null && (
              <Button
                variant="ghost"
                onClick={() => {
                  onChange?.(value.filter((_, position) => position !== editing.index));
                  setEditing(null);
                }}
              >
                <Trash2 size={14} /> Xóa bài tập
              </Button>
            )}
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Quay lại
            </Button>
            <Button onClick={save}>Lưu</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Thứ">
                <Select
                  value={editing.draft.dayOfWeek}
                  onChange={(event) =>
                    setEditing({ ...editing, draft: { ...editing.draft, dayOfWeek: Number(event.target.value) } })
                  }
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <option key={day} value={day}>
                      {dayOfWeekLabel[day]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Khung giờ">
                <Select
                  value={editing.draft.slotId}
                  onChange={(event) => setEditing({ ...editing, draft: { ...editing.draft, slotId: event.target.value } })}
                >
                  {slots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.startTime}–{slot.endTime}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Loại bài tập">
                <Select
                  value={editing.draft.workoutType}
                  onChange={(event) =>
                    setEditing({ ...editing, draft: { ...editing.draft, workoutType: event.target.value as WorkoutType } })
                  }
                >
                  {Object.entries(workoutLabel).map(([value_, label]) => (
                    <option key={value_} value={value_}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cường độ" hint="Đi bộ và nước kiệu không được Nặng hoặc Tối đa">
                <Select
                  value={editing.draft.intensity}
                  onChange={(event) =>
                    setEditing({ ...editing, draft: { ...editing.draft, intensity: event.target.value as TrainingIntensity } })
                  }
                >
                  {Object.entries(intensityLabel).map(([value_, label]) => (
                    <option key={value_} value={value_}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cự ly (m)" hint="200–4000 m">
                <Input
                  type="number"
                  value={editing.draft.distanceM}
                  onChange={(event) =>
                    setEditing({ ...editing, draft: { ...editing.draft, distanceM: Number(event.target.value) } })
                  }
                />
              </Field>
              <Field label="Số lần lặp" hint="1–10 lần">
                <Input
                  type="number"
                  value={editing.draft.repetitions}
                  onChange={(event) =>
                    setEditing({ ...editing, draft: { ...editing.draft, repetitions: Number(event.target.value) } })
                  }
                />
              </Field>
              <Field label="Mặt sân">
                <Select
                  value={editing.draft.surface}
                  onChange={(event) =>
                    setEditing({ ...editing, draft: { ...editing.draft, surface: event.target.value as TrackSurface } })
                  }
                >
                  {Object.entries(surfaceLabel).map(([value_, label]) => (
                    <option key={value_} value={value_}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Khối lượng bài tập">
                <div className="flex h-11 items-center rounded-xl bg-gray-50 px-4 text-sm font-semibold text-gray-700 tabular-nums">
                  {(editing.draft.distanceM * editing.draft.repetitions).toLocaleString('vi-VN')} m
                </div>
              </Field>
            </div>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
