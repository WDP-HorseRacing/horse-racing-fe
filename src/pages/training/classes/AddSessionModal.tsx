// Thêm buổi học cho lớp (F2.6) — buổi thêm vẫn thuộc lớp, có thể chọn khung giờ khác.
import { useState } from 'react';
import { useAction, useService } from '../../../hooks/useService';
import {
  addExtraSession,
  listSlots,
  listSubjectOptions,
  type ClassDetail,
} from '../../../services/training.service';
import { Button, ErrorBox, Field, Input, Modal, Notice, Select, Textarea, useToast } from '../../../components/ui';
import { intensityLabel } from '../../../lib/labels';
import { now } from '../../../lib/clock';
import { formatDate, toDateKey } from '../../../lib/format';
import { weekdayLong, workoutLine } from '../setup-components/helpers';

export function AddSessionModal({
  detail,
  open,
  onClose,
  onDone,
}: {
  detail: ClassDetail;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const slots = useService(() => listSlots(), []);
  const subjects = useService(() => listSubjectOptions(), []);
  const today = toDateKey(now());
  const minDate = today > detail.startDate ? today : detail.startDate;
  const [form, setForm] = useState({ date: minDate, slotId: detail.slotId, subjectId: '', note: '' });

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm({ date: minDate, slotId: detail.slotId, subjectId: '', note: '' });
      action.clearError();
    }
  }

  const submit = async () => {
    const id = await action.run(() => addExtraSession(detail.id, form));
    if (id) {
      toast.push(`Đã thêm buổi ngày ${formatDate(form.date)}`, 'success');
      onDone();
      onClose();
    }
  };

  const fieldError = (field: string) => (action.field === field ? action.error : undefined);
  const subject = subjects.data?.find((item) => item.id === form.subjectId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm buổi học"
      description={`Buổi thêm thuộc lớp ${detail.name}, áp dụng cho mọi ngựa đang học vào ngày đó.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || !form.subjectId || !form.date}>
            {action.pending ? 'Đang thêm…' : 'Thêm buổi'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Ngày"
            required
            hint={form.date ? `${weekdayLong(form.date)} · trong thời gian lớp tới ${formatDate(detail.endDate)}` : undefined}
          >
            <Input
              type="date"
              min={minDate}
              max={detail.endDate}
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </Field>
          <Field label="Khung giờ" required error={fieldError('slotId')} hint="Mặc định là khung giờ của lớp">
            <Select value={form.slotId} onChange={(event) => setForm({ ...form, slotId: event.target.value })}>
              {slots.data?.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                  {slot.id === detail.slotId ? ' (khung giờ lớp)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Môn học" required error={fieldError('subjectId')}>
          <Select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}>
            <option value="">Chọn môn học…</option>
            {subjects.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {intensityLabel[item.intensity]} · {workoutLine(item.distanceM, item.repetitions)}
              </option>
            ))}
          </Select>
        </Field>
        {subject && detail.maxIntensity && subject.intensity !== 'LIGHT' && (
          <p className="text-xs font-light text-gray-500">
            Ngựa không được tập ở mức {intensityLabel[subject.intensity]} sẽ tự được đánh dấu vắng (chặn y tế) khi bắt đầu buổi.
          </p>
        )}
        <Field label="Ghi chú">
          <Textarea
            value={form.note}
            className="min-h-16"
            placeholder="Lý do thêm buổi, lưu ý cho Groom…"
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </Field>
        <Notice tone="info">
          Hệ thống kiểm giới hạn trong ngày của từng ngựa qua mọi lớp: tối đa 2 buổi, chỉ 1 buổi từ Trung bình trở lên, không trùng
          khung giờ. Có ngựa vi phạm thì không thêm được.
        </Notice>
        {action.error && action.field !== 'slotId' && action.field !== 'subjectId' && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}
