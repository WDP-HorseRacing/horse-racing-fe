// Hộp thoại xác nhận có ô lý do bắt buộc: hủy lớp, hủy buổi, báo vắng, rời lớp.
// Lỗi "Nhập lý do" hiện khi rời ô hoặc bấm xác nhận. Bấm gợi ý thì nối vào lý do đang gõ, không ghi đè.
import { useState, type ReactNode } from 'react';
import { Button, CancelButton, CharCount, ErrorBox, Field, Modal, Textarea, invalidClass } from '../../../components/ui';

/** Nối gợi ý vào lý do đang gõ: ô trống thì điền, đã có thì thêm sau dấu phẩy. Không vượt giới hạn ký tự. */
function appendSuggestion(current: string, item: string, max: number) {
  const text = current.trim();
  if (!text) return item.slice(0, max);
  if (text.toLowerCase().includes(item.toLowerCase())) return current;
  return `${text}${/[.,;:!?]$/.test(text) ? ' ' : ', '}${item}`.slice(0, max);
}

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
  maxLength = 500,
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
  /** Số ký tự tối đa của lý do (mặc định 500 như BE). */
  maxLength?: number;
  children?: ReactNode;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = !reason.trim();
  const reasonError = touched && missing ? 'Nhập lý do' : undefined;
  const confirm = () => {
    setTouched(true);
    if (!missing) onConfirm(reason.trim());
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      dirty={!missing}
      busy={pending}
      onSave={confirm}
      saveLabel={confirmLabel}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button variant={danger ? 'danger' : 'primary'} disabled={pending} onClick={confirm}>
            {pending ? 'Đang xử lý…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {message && <div className="text-sm text-gray-600">{message}</div>}
        {error && <ErrorBox message={error} />}
        <Field label={label} required name="reason" error={reasonError} onBlur={() => setTouched(true)} counter={<CharCount value={reason} max={maxLength} />}>
          <Textarea rows={3} autoFocus maxLength={maxLength} value={reason} placeholder={placeholder} onChange={(event) => setReason(event.target.value)} className={reasonError ? invalidClass : ''} />
        </Field>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                // Giữ con trỏ trong ô lý do: bấm gợi ý không tính là rời ô (không nháy lỗi "Nhập lý do").
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setReason((current) => appendSuggestion(current, item, maxLength))}
                className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300"
              >
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
