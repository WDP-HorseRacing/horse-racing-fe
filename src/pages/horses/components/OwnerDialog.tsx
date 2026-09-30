// CM gán hoặc đổi chủ sở hữu (một chủ duy nhất, không lưu lịch sử — backend ghi nhật ký thao tác).
import { useEffect, useState } from 'react';
import { useAction, useService } from '../../../hooks/useService';
import { updateHorse } from '../../../api/horses';
import { listAllUsers } from '../../../api/users';
import { Button, ErrorBox, Field, Modal, Notice, Select, useToast } from '../../../components/ui';

export default function OwnerDialog({
  open,
  horse,
  onClose,
  onDone,
}: {
  open: boolean;
  horse: { id: string; name: string; version: number; ownerId: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const owners = useService(() => (open ? listAllUsers({ role: 'HORSE_OWNER', status: 'ACTIVE' }) : Promise.resolve([])), [open]);
  const [ownerId, setOwnerId] = useState('');

  useEffect(() => {
    if (!open) return;
    setOwnerId(horse.ownerId ?? '');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, horse.ownerId]);

  const submit = async () => {
    const done = await action.run(() => updateHorse(horse.id, { version: horse.version, ownerId: ownerId || null }));
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
          <Button onClick={submit} disabled={action.pending || (ownerId || null) === horse.ownerId}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Chủ sở hữu" hint="Chỉ hiện tài khoản Chủ ngựa đang hoạt động.">
          <Select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
            <option value="">— Để trống —</option>
            {(owners.data ?? []).map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.fullName} · {owner.email}
              </option>
            ))}
          </Select>
        </Field>
        <Notice tone="info">Chủ mới xem được toàn bộ lịch sử của ngựa; chủ cũ mất quyền xem ngay khi lưu.</Notice>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}
