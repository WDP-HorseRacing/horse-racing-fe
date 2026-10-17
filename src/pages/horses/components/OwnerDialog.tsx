// CM gán chủ sở hữu cho ngựa chưa có chủ. Ngựa đã có chủ thì đổi chủ bằng chuyển nhượng nội bộ (OwnershipTransferDialog).
import { useEffect, useState } from 'react';
import { useAction } from '../../../hooks/useService';
import { updateHorse } from '../../../api/horses';
import { Button, ErrorBox, Field, Modal, Notice, useToast } from '../../../components/ui';
import { OwnerSelect } from './OwnerSelect';

export default function OwnerDialog({
  open,
  horse,
  onClose,
  onDone,
}: {
  open: boolean;
  horse: { id: string; name: string; version: number };
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [ownerId, setOwnerId] = useState('');

  useEffect(() => {
    if (!open) return;
    setOwnerId('');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (!ownerId) return;
    const done = await action.run(() => updateHorse(horse.id, { version: horse.version, ownerId }));
    if (done) {
      toast.push('Đã gán chủ sở hữu', 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Gán chủ sở hữu cho ${horse.name}`}
      description="Mỗi ngựa có một chủ sở hữu."
      dirty={ownerId !== ''}
      onSave={() => void submit()}
      saveLabel="Gán chủ"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || !ownerId}>
            {action.pending ? 'Đang lưu…' : 'Gán chủ'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Chủ sở hữu" required hint="Chủ ngựa đang hoạt động.">
          <OwnerSelect value={ownerId} onChange={(id) => setOwnerId(id)} />
        </Field>
        <Notice tone="info">Chủ sở hữu bắt đầu từ lúc lưu. Sau này muốn đổi chủ thì dùng Chuyển chủ trên hồ sơ ngựa.</Notice>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}
