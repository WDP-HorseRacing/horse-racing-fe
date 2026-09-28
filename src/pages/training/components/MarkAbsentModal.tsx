// Báo một ngựa không tham gia buổi: Groom báo không thực hiện được, hoặc HT cho nghỉ buổi này.
// Chỉ đánh dấu vắng riêng con ngựa đó — buổi của lớp vẫn diễn ra với các ngựa khác.
import { useEffect, useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { Button, Field, Modal, Notice, Segmented, Textarea, ToggleChip, useToast } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';
import { markAbsent } from '../../../services/session.service';

export default function MarkAbsentModal({
  open,
  onClose,
  sessionId,
  horse,
  byGroom,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  horse?: { id: string; name: string };
  /** Groom báo (GROOM_REPORTED) hay HT cho nghỉ (TRAINER_CHANGED). */
  byGroom: boolean;
  onDone?: () => void;
}) {
  const action = useAction();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [exam, setExam] = useState(false);
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT'>('NORMAL');

  useEffect(() => {
    if (!open) return;
    setNote('');
    setExam(false);
    setUrgency('NORMAL');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (!horse) return;
    const done = await action.run(() =>
      markAbsent(sessionId, horse.id, { note, requestExam: exam ? { urgency } : undefined }),
    );
    if (done === undefined) return;
    toast.push(`${horse.name} được đánh dấu vắng buổi này${exam ? ', đã gửi yêu cầu khám' : ''}`, 'success');
    onClose();
    onDone?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={byGroom ? 'Báo không thực hiện được' : 'Cho ngựa nghỉ buổi này'}
      description={horse ? `${horse.name} — chỉ con ngựa này vắng, buổi của lớp vẫn diễn ra.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button variant="danger" onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Đánh dấu vắng'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field
          label="Ghi chú"
          required
          hint={byGroom ? 'HT của khu nhận được thông báo kèm ghi chú này.' : 'Ghi rõ vì sao ngựa nghỉ buổi này.'}
          error={action.field === 'note' ? action.error : undefined}
        >
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={byGroom ? 'Ví dụ: ngựa bỏ ăn sáng, đi hơi khập khiễng chân sau phải' : 'Ví dụ: giảm tải sau buổi chạy thử hôm qua'}
          />
        </Field>

        <div className="rounded-xl bg-emerald-50/50 p-4">
          <ToggleChip checked={exam} onChange={setExam}>
            <Stethoscope size={14} /> Gửi kèm yêu cầu khám
          </ToggleChip>
          {exam && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-500">Mức độ</span>
              <Segmented
                value={urgency}
                onChange={setUrgency}
                options={[
                  { value: 'NORMAL', label: 'Bình thường' },
                  { value: 'URGENT', label: 'Khẩn' },
                ]}
              />
              {urgency === 'URGENT' && (
                <p className="w-full text-xs text-red-600">Bác sĩ nhận thông báo khẩn ngay khi gửi.</p>
              )}
            </div>
          )}
        </div>

        {action.error && action.field !== 'note' && <Notice tone="danger">{action.error}</Notice>}
      </div>
    </Modal>
  );
}
