// Hộp thoại xác nhận có ô lý do bắt buộc: hủy lớp, hủy buổi, báo vắng, rời lớp.
import { useState, type ReactNode } from 'react';
import { Button, ErrorBox, Field, Modal, Textarea, invalidClass } from '../../../components/ui';

export function ReasonDialog({
  title,
  message,
  label = 'Lý do',
  placeholder,
  suggestions = [],
  confirmLabel = 'Xác nhận',
  danger = true,
  pending,
  error,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  message?: ReactNode;
  label?: string;
  placeholder?: string;
  /** Lý do hay gặp, bấm để điền nhanh. */
  suggestions?: string[];
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  error?: string;
  children?: ReactNode;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = !reason.trim();
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={pending}
            onClick={() => {
              setTouched(true);
              if (!missing) onConfirm(reason.trim());
            }}
          >
            {pending ? 'Đang xử lý…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {message && <div className="text-sm text-gray-600">{message}</div>}
        {error && <ErrorBox message={error} />}
        <Field label={label} required error={touched && missing ? 'Nhập lý do' : undefined}>
          <Textarea rows={3} autoFocus value={reason} placeholder={placeholder} onChange={(event) => setReason(event.target.value)} className={touched && missing ? invalidClass : ''} />
        </Field>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((item) => (
              <button key={item} type="button" onClick={() => setReason(item)} className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300">
                {item}
              </button>
            ))}
          </div>
        )}
        {children}
      </div>
    </Modal>
  );
}
