// Bác sĩ đặt hoặc sửa nhịp tim tối đa của một ngựa (F2.11). Giá trị mặc định chỉ là gợi ý trong form —
// ngựa chưa được đặt thì quy tắc R1 không chạy, không có giá trị dự phòng.
import { useEffect, useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { Button, Field, Input, Modal, Notice, Textarea, useToast } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';
import { setMaxHeartRate } from '../../../services/session.service';

export default function MaxHeartRateModal({
  open,
  onClose,
  horse,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  horse?: { id: string; name: string; current?: number; suggested: number };
  onDone?: () => void;
}) {
  const action = useAction();
  const toast = useToast();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open || !horse) return;
    setValue(String(horse.current ?? horse.suggested));
    setReason('');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, horse?.id]);

  const submit = async () => {
    if (!horse) return;
    const done = await action.run(() => setMaxHeartRate(horse.id, Number(value), reason));
    if (done === undefined) return;
    toast.push(`Đã đặt nhịp tim tối đa ${value} cho ${horse.name}`, 'success');
    onClose();
    onDone?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={horse?.current !== undefined ? 'Sửa nhịp tim tối đa' : 'Đặt nhịp tim tối đa'}
      description={horse ? `${horse.name}${horse.current !== undefined ? ` · đang áp dụng ${horse.current} nhịp/phút` : ' · chưa đặt, R1 đang tắt'}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending}>
            <HeartPulse size={15} /> {action.pending ? 'Đang lưu…' : 'Lưu ngưỡng'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Nhịp tim tối đa (nhịp/phút)"
          required
          hint={`Khoảng hợp lệ 180–260. Gợi ý mặc định của câu lạc bộ: ${horse?.suggested ?? '—'} — chỉ là gợi ý, không tự áp dụng.`}
          error={action.field === 'value' ? action.error : undefined}
        >
          <Input type="number" min={180} max={260} step={1} value={value} onChange={(event) => setValue(event.target.value)} />
        </Field>
        <Field label="Lý do" required error={action.field === 'reason' ? action.error : undefined}>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: kết quả khám tim mạch đầu mùa; ngựa lớn tuổi, hạ ngưỡng an toàn"
          />
        </Field>
        <p className="text-xs font-light text-gray-500">
          Ngưỡng mới áp dụng từ buổi bắt đầu sau khi lưu. Buổi đang diễn ra vẫn dùng giá trị đã chốt lúc bắt đầu.
        </p>
        {action.error && action.field !== 'value' && action.field !== 'reason' && (
          <Notice tone="danger">{action.error}</Notice>
        )}
      </div>
    </Modal>
  );
}
