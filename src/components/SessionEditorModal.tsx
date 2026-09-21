// Trình soạn một buổi tập. Dùng chung cho bảng lịch tập và lưới từng tuần trong giáo án.
import { useEffect, useState } from 'react';
import { useAction, useService } from '../hooks/useService';
import {
  createSession,
  listPhaseOptions,
  listSlots,
  updateSession,
  type SessionRow,
} from '../services/training.service';
import { listGrooms, listHorses } from '../services/horse.service';
import { Button, ErrorBox, Field, Input, Modal, Select, Textarea } from './ui';
import { intensityLabel, surfaceLabel, workoutLabel } from '../lib/labels';
import type { TrackSurface, TrainingIntensity, WorkoutType } from '../types/domain';

export interface SessionDraft {
  horseId?: string;
  planId?: string;
  phaseId?: string;
  sessionDate?: string;
  slotId?: string;
}

export function SessionEditorModal({
  open,
  session,
  draft,
  lockHorse,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Có `session` là sửa, không có là thêm mới. */
  session?: SessionRow;
  draft?: SessionDraft;
  /** Khóa ô chọn ngựa và giai đoạn, dùng khi thêm buổi từ trong một giáo án cụ thể. */
  lockHorse?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const slots = useService(() => listSlots(), []);
  const horses = useService(() => listHorses(), []);
  const grooms = useService(() => listGrooms(), []);
  const action = useAction();

  const [form, setForm] = useState({
    horseId: '',
    phaseKey: '',
    sessionDate: '',
    slotId: '',
    workoutType: 'CANTER' as WorkoutType,
    distanceM: 1600,
    repetitions: 1,
    intensity: 'MODERATE' as TrainingIntensity,
    surface: 'DIRT' as TrackSurface,
    groomId: '',
    trainerNote: '',
  });

  const phaseOptions = useService(
    () => (form.horseId ? listPhaseOptions(form.horseId) : Promise.resolve([])),
    [form.horseId],
  );

  useEffect(() => {
    if (!open) return;
    if (session) {
      setForm({
        horseId: session.horseId,
        phaseKey: `${session.planId}|${session.phaseId}`,
        sessionDate: session.sessionDate,
        slotId: session.slotId,
        workoutType: session.workoutType,
        distanceM: session.distanceM,
        repetitions: session.repetitions,
        intensity: session.intensity,
        surface: session.surface,
        groomId: session.groomId ?? '',
        trainerNote: session.trainerNote ?? '',
      });
      return;
    }
    setForm((current) => ({
      ...current,
      horseId: draft?.horseId ?? '',
      phaseKey: draft?.planId && draft?.phaseId ? `${draft.planId}|${draft.phaseId}` : '',
      sessionDate: draft?.sessionDate ?? '',
      slotId: draft?.slotId ?? '',
      trainerNote: '',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id, draft?.horseId, draft?.sessionDate, draft?.slotId, draft?.phaseId]);

  const fieldError = (field: string) => (action.field === field ? action.error : undefined);

  const submit = async () => {
    const [planId, phaseId] = form.phaseKey.split('|');
    if (!planId || !phaseId) return;
    const payload = {
      horseId: form.horseId,
      planId,
      phaseId,
      sessionDate: form.sessionDate,
      slotId: form.slotId,
      groomId: form.groomId || undefined,
      workoutType: form.workoutType,
      distanceM: Number(form.distanceM),
      repetitions: Number(form.repetitions),
      intensity: form.intensity,
      surface: form.surface,
      trainerNote: form.trainerNote || undefined,
    };
    const done = await action.run(async () => {
      if (session) await updateSession(session.id, payload);
      else await createSession(payload);
    });
    if (done !== undefined) onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={session ? 'Sửa buổi tập' : 'Thêm buổi tập'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ngựa" required error={fieldError('horseId')}>
            <Select
              value={form.horseId}
              disabled={!!session || lockHorse}
              onChange={(event) => setForm({ ...form, horseId: event.target.value, phaseKey: '' })}
            >
              <option value="">Chọn ngựa</option>
              {horses.data
                ?.filter((horse) => horse.lifecycleStatus === 'ACTIVE' && !horse.isReference)
                .map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    {horse.name}
                    {horse.trainAllowed ? '' : ' — đang bị chặn tập'}
                  </option>
                ))}
            </Select>
          </Field>

          <Field
            label="Giáo án và giai đoạn"
            required
            hint="Buổi tập luôn thuộc một giai đoạn của giáo án"
            error={fieldError('phaseId')}
          >
            <Select
              value={form.phaseKey}
              disabled={lockHorse}
              onChange={(event) => setForm({ ...form, phaseKey: event.target.value })}
            >
              <option value="">Chọn giai đoạn</option>
              {phaseOptions.data?.map((option) => (
                <option key={option.phaseId} value={`${option.planId}|${option.phaseId}`}>
                  {option.planName} — {option.phaseName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Ngày tập" required error={fieldError('sessionDate')}>
            <Input
              type="date"
              value={form.sessionDate}
              onChange={(event) => setForm({ ...form, sessionDate: event.target.value })}
            />
          </Field>
          <Field label="Khung giờ" required error={fieldError('slotId')}>
            <Select value={form.slotId} onChange={(event) => setForm({ ...form, slotId: event.target.value })}>
              <option value="">Chọn khung giờ</option>
              {slots.data?.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.startTime}–{slot.endTime}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Loại bài tập" required>
            <Select
              value={form.workoutType}
              onChange={(event) => setForm({ ...form, workoutType: event.target.value as WorkoutType })}
            >
              {Object.entries(workoutLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cường độ" required error={fieldError('intensity')}>
            <Select
              value={form.intensity}
              onChange={(event) => setForm({ ...form, intensity: event.target.value as TrainingIntensity })}
            >
              {Object.entries(intensityLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Cự ly (m)" required hint="200–4000 m" error={fieldError('distanceM')}>
            <Input
              type="number"
              value={form.distanceM}
              onChange={(event) => setForm({ ...form, distanceM: Number(event.target.value) })}
            />
          </Field>
          <Field label="Số lần lặp" required hint="1–10 lần">
            <Input
              type="number"
              value={form.repetitions}
              onChange={(event) => setForm({ ...form, repetitions: Number(event.target.value) })}
            />
          </Field>

          <Field label="Mặt sân" required>
            <Select value={form.surface} onChange={(event) => setForm({ ...form, surface: event.target.value as TrackSurface })}>
              {Object.entries(surfaceLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nhân viên chăm sóc">
            <Select value={form.groomId} onChange={(event) => setForm({ ...form, groomId: event.target.value })}>
              <option value="">Chưa phân công</option>
              {grooms.data?.map((groom) => (
                <option key={groom.id} value={groom.id}>
                  {groom.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Ghi chú gửi nhân viên chăm sóc">
          <Textarea value={form.trainerNote} onChange={(event) => setForm({ ...form, trainerNote: event.target.value })} />
        </Field>

        <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
          Khối lượng bài tập:{' '}
          <strong className="text-gray-800 tabular-nums">
            {(Number(form.distanceM) * Number(form.repetitions)).toLocaleString('vi-VN')} m
          </strong>
        </div>

        {action.error && !action.field && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}
