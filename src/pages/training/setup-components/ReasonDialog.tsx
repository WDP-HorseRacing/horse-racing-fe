// Hộp xác nhận bắt buộc nhập lý do (hủy lớp, kết thúc sớm, hủy buổi, rút ngựa).
import { useState, type ReactNode } from 'react';
import { ConfirmDialog, ErrorBox, Field, Textarea } from '../../../components/ui';

export function ReasonDialog({
  open,
  title,
  message,
  consequences,
  label = 'Lý do',
  placeholder,
  confirmLabel,
  danger = true,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  consequences?: string[];
  label?: string;
  placeholder?: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  error?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReason('');
  }
  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      consequences={consequences}
      confirmLabel={confirmLabel}
      danger={danger}
      pending={pending}
      disabled={!reason.trim()}
      onConfirm={() => onConfirm(reason.trim())}
      onClose={onClose}
    >
      <div className="space-y-3">
        <Field label={label} required hint="Bắt buộc — được ghi vào nhật ký thao tác">
          <Textarea
            autoFocus
            value={reason}
            placeholder={placeholder}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-20"
          />
        </Field>
        {error && <ErrorBox message={error} />}
      </div>
    </ConfirmDialog>
  );
}
