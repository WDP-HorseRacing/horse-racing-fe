// Hộp thoại nhập lý do bắt buộc — dùng cho dừng khẩn buổi, dừng riêng một ngựa, xóa ngưỡng nhịp tim.
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Field, Modal, Notice, Textarea } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';

export default function ReasonModal({
  open,
  onClose,
  title,
  description,
  message,
  confirmLabel,
  placeholder,
  danger = true,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  message?: ReactNode;
  confirmLabel: string;
  placeholder?: string;
  danger?: boolean;
  /** Trả undefined khi thất bại (theo quy ước useAction). */
  onSubmit: (reason: string) => Promise<unknown>;
}) {
  const action = useAction();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason('');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    const done = await action.run(() => onSubmit(reason));
    if (done !== undefined) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang xử lý…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {message && <div className="text-sm text-gray-600">{message}</div>}
        <Field label="Lý do" required error={action.field === 'reason' ? action.error : undefined}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={placeholder} />
        </Field>
        {action.error && action.field !== 'reason' && <Notice tone="danger">{action.error}</Notice>}
      </div>
    </Modal>
  );
}
