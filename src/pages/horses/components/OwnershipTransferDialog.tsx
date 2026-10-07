// Chuyển nhượng nội bộ: chủ ngựa bán cho chủ khác trong câu lạc bộ. Quản lý ghi nhận sau khi hai bên đã thỏa thuận.
// Ngựa giữ nguyên khu, ô, Groom, lớp. Chủ mới bắt đầu sở hữu từ lúc lưu, đây cũng là mốc chia chi phí y tế.
import { useEffect, useState } from 'react';
import { useAction, useService } from '../../../hooks/useService';
import { transferOwnership } from '../../../api/horses';
import { listAllUsers } from '../../../api/users';
import { Button, ErrorBox, Field, Modal, Notice, Select, Textarea, cn, invalidClass, useToast } from '../../../components/ui';
import { formatDate } from '../../../lib/format';

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
  const owners = useService(() => (open ? listAllUsers({ role: 'HORSE_OWNER', status: 'ACTIVE' }) : Promise.resolve([])), [open]);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setNewOwnerId('');
    setReason('');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const candidates = (owners.data ?? []).filter((item) => item.id !== horse.owner?.id);
  const ownerError = action.fieldErrors.newOwnerId;
  const reasonError = action.fieldErrors.reason;
  const formError = action.error && !ownerError && !reasonError ? action.error : undefined;
  const stale = formError?.includes('vừa được người khác cập nhật') ?? false;
  const canSubmit = !!newOwnerId && !!reason.trim() && !action.pending;

  const submit = async () => {
    if (!canSubmit) return;
    const done = await action.run(() => transferOwnership(horse.id, { newOwnerId, reason: reason.trim(), version: horse.version }));
    if (done) {
      const name = candidates.find((item) => item.id === newOwnerId)?.fullName ?? 'chủ mới';
      toast.push(`Đã chuyển ${horse.name} sang ${name}`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Chuyển chủ trong câu lạc bộ: ${horse.name}`}
      description="Quản lý ghi nhận sau khi hai chủ ngựa đã thỏa thuận. Ngựa giữ nguyên khu, ô, Groom và lớp đang học."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {action.pending ? 'Đang lưu…' : 'Xác nhận chuyển chủ'}
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
        <Field label="Chủ mới" name="newOwnerId" required error={ownerError} hint="Chỉ hiện tài khoản Chủ ngựa đang hoạt động, trừ chủ hiện tại.">
          <Select
            value={newOwnerId}
            disabled={owners.loading && !owners.data}
            onChange={(event) => {
              setNewOwnerId(event.target.value);
              if (ownerError) action.clearError();
            }}
            className={cn(ownerError && invalidClass)}
          >
            <option value="">{owners.loading && !owners.data ? 'Đang tải…' : 'Chọn chủ mới'}</option>
            {candidates.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.fullName} · {owner.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lý do" name="reason" required error={reasonError} hint="Ví dụ: chủ cũ bán lại cho chủ mới theo thỏa thuận giữa hai bên. Ghi vào lịch sử sở hữu.">
          <Textarea value={reason} maxLength={REASON_MAX} onChange={(event) => setReason(event.target.value)} className={cn(reasonError && invalidClass)} />
        </Field>
        <Notice tone="info">
          Chủ mới sở hữu từ lúc lưu. Chi phí các bệnh án đã đóng trước đó vẫn tính cho chủ cũ. Chủ cũ không xem được hồ sơ ngựa nữa.
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
        {owners.error && <ErrorBox message={owners.error} />}
      </div>
    </Modal>
  );
}
