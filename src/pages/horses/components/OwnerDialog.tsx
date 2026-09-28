// CM gán hoặc đổi chủ sở hữu (một chủ duy nhất, không lưu lịch sử — chỉ ghi nhật ký thao tác).
import { useEffect, useState } from 'react';
import { useAction, useService } from '../../../hooks/useService';
import { listOwnerAccounts, setOwner } from '../../../services/horse.service';
import { Button, ErrorBox, Field, Modal, Select, Textarea, useToast } from '../../../components/ui';

export default function OwnerDialog({
  open,
  horse,
  currentOwnerId,
  onClose,
  onDone,
}: {
  open: boolean;
  horse: { id: string; name: string };
  currentOwnerId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const owners = useService(() => (open ? listOwnerAccounts() : Promise.resolve([])), [open]);
  const [ownerId, setOwnerId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setOwnerId(currentOwnerId ?? '');
    setReason('');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentOwnerId]);

  const submit = async () => {
    const done = await action.run(() => setOwner(horse.id, ownerId || null, reason));
    if (done) {
      toast.push(ownerId ? 'Đã cập nhật chủ sở hữu' : 'Đã bỏ trống chủ sở hữu', 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Chủ sở hữu của ${horse.name}`}
      description="Mỗi ngựa có một chủ sở hữu. Việc đổi chủ được ghi vào nhật ký thao tác."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || (ownerId || undefined) === currentOwnerId}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Chủ sở hữu" hint="Chỉ hiện tài khoản Chủ ngựa đang hoạt động." error={action.field === 'ownerId' ? action.error : undefined}>
          <Select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
            <option value="">— Để trống —</option>
            {(owners.data ?? []).map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} · {owner.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ghi chú">
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-16" placeholder="Ví dụ: hợp đồng mua bán ngày…" />
        </Field>
        {action.error && action.field !== 'ownerId' && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}
