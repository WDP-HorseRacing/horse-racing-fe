// Chuyển nhượng nội bộ: chủ ngựa bán cho chủ khác trong câu lạc bộ. Quản lý ghi nhận sau khi hai bên đã thỏa thuận.
// Ngựa giữ nguyên khu, ô, Groom, lớp. Chủ mới bắt đầu sở hữu từ lúc lưu, đây cũng là mốc chia chi phí y tế.
import { useEffect, useMemo, useState } from 'react';
import { useAction } from '../../../hooks/useService';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { transferOwnership } from '../../../api/horses';
import { Button, CancelButton, CharCount, ErrorBox, Field, Modal, Notice, Textarea, cn, invalidClass, useToast } from '../../../components/ui';
import { formatDate } from '../../../lib/format';
import { OwnerSelect } from './OwnerSelect';

const REASON_MAX = 500;

export default function OwnershipTransferDialog({
  open,
  horse,
  onClose,
  onDone,
}: {
  open: boolean;
  horse: { id: string; name: string; version: number; owner: { id: string; fullName: string } | null; ownerSince: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [newOwnerId, setNewOwnerId] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [reason, setReason] = useState('');

  const errors = useMemo(
    () => ({
      newOwnerId: !newOwnerId ? 'Chọn chủ mới' : undefined,
      reason: !reason.trim() ? 'Nhập lý do' : undefined,
    }),
    [newOwnerId, reason],
  );
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const { reset } = f;

  useEffect(() => {
    if (!open) return;
    setNewOwnerId('');
    setNewOwnerName('');
    setReason('');
    action.clearError();
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ownerError = f.show('newOwnerId');
  const reasonError = f.show('reason');
  const serverOnField = !!action.fieldErrors.newOwnerId || !!action.fieldErrors.reason || action.field === 'newOwnerId' || action.field === 'reason';
  const formError = action.error && !serverOnField ? action.error : undefined;
  const stale = formError?.includes('vừa được người khác cập nhật') ?? false;

  const submit = async () => {
    if (action.pending || !f.attempt()) return;
    const done = await action.run(() => transferOwnership(horse.id, { newOwnerId, reason: reason.trim(), version: horse.version }));
    if (done) {
      toast.push(`Đã chuyển ${horse.name} sang ${newOwnerName || 'chủ mới'}`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Chuyển chủ trong câu lạc bộ: ${horse.name}`}
      description="Ngựa giữ nguyên khu, ô, Groom và lớp đang học."
      dirty={newOwnerId !== '' || reason.trim() !== ''}
      busy={action.pending}
      onSave={() => void submit()}
      saveLabel="Chuyển chủ"
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Chuyển chủ'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm ring-1 ring-gray-100">
          <p className="text-xs text-gray-500">Chủ hiện tại</p>
          <p className="mt-0.5 font-semibold text-gray-900">{horse.owner?.fullName ?? 'Chưa có chủ'}</p>
          {horse.ownerSince && <p className="text-xs text-gray-500">Sở hữu từ {formatDate(horse.ownerSince)}</p>}
        </div>
        <Field label="Chủ mới" name="newOwnerId" required error={ownerError} onBlur={f.blur('newOwnerId')} hint="Chủ ngựa đang hoạt động, trừ chủ hiện tại.">
          <OwnerSelect
            value={newOwnerId}
            exclude={horse.owner?.id}
            invalid={!!ownerError}
            placeholder="Chọn chủ mới"
            onChange={(id, owner) => {
              setNewOwnerId(id);
              setNewOwnerName(owner?.fullName ?? '');
              f.touch('newOwnerId');
              if (action.error) action.clearError();
            }}
          />
        </Field>
        <Field label="Lý do" name="reason" required error={reasonError} onBlur={f.blur('reason')} hint="Ví dụ: chủ cũ bán lại cho chủ mới." counter={<CharCount value={reason} max={REASON_MAX} />}>
          <Textarea
            value={reason}
            maxLength={REASON_MAX}
            onChange={(event) => {
              setReason(event.target.value);
              if (action.fieldErrors.reason || action.field === 'reason') action.clearError();
            }}
            className={cn(reasonError && invalidClass)}
          />
        </Field>
        <Notice tone="info">
          Chủ mới sở hữu ngựa từ lúc lưu; chi phí trước đó vẫn tính cho chủ cũ.
        </Notice>
        {formError && <ErrorBox message={formError} />}
        {stale && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              onDone();
              onClose();
            }}
          >
            Tải lại hồ sơ mới nhất
          </Button>
        )}
      </div>
    </Modal>
  );
}
