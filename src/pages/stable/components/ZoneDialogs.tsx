// Hộp thoại quản lý danh mục khu và ô (F2.1, chỉ CM).
import { useEffect, useState } from 'react';
import { useAction } from '../../../hooks/useService';
import {
  createStalls,
  createZone,
  setStallMaintenance,
  setZoneHeadTrainer,
  setZoneStatus,
  updateZone,
  type PersonOption,
  type StallRow,
  type ZoneRow,
} from '../../../services/horse.service';
import { Button, ErrorBox, Field, Input, Modal, Notice, Select, Textarea, useToast } from '../../../components/ui';
import { zoneStatusLabel } from '../../../lib/labels';
import type { ZoneStatus } from '../../../types/domain';

export function ZoneFormDialog({
  open,
  zone,
  headTrainers,
  onClose,
  onDone,
}: {
  open: boolean;
  /** Không có = thêm khu mới. */
  zone?: ZoneRow;
  headTrainers: PersonOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [form, setForm] = useState({ code: '', name: '', headTrainerId: '' });
  useEffect(() => {
    if (!open) return;
    setForm({ code: zone?.code ?? '', name: zone?.name ?? '', headTrainerId: '' });
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, zone?.id]);

  const submit = async () => {
    const done = await action.run(async () => {
      if (zone) await updateZone(zone.id, { code: form.code, name: form.name });
      else await createZone(form);
      return true;
    });
    if (done) {
      toast.push(zone ? 'Đã cập nhật khu' : `Đã thêm ${form.name}`, 'success');
      onDone();
      onClose();
    }
  };
  const err = (key: string) => (action.field === key ? action.error : undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={zone ? `Sửa ${zone.name}` : 'Thêm khu chuồng'}
      description={zone ? undefined : 'Khu mới ở trạng thái Đang hoạt động. Thêm ô chuồng sau khi tạo khu.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || !form.code.trim() || !form.name.trim()}>
            {action.pending ? 'Đang lưu…' : zone ? 'Lưu' : 'Thêm khu'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Mã khu" required error={err('code')} hint="Dùng làm tiền tố mã ô, ví dụ E → E-01">
          <Input value={form.code} maxLength={4} className="font-mono uppercase" onChange={(event) => setForm({ ...form, code: event.target.value })} />
        </Field>
        <Field label="Tên khu" required error={err('name')} className="sm:col-span-2">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Khu E" />
        </Field>
        {!zone && (
          <Field label="HT phụ trách" error={err('headTrainerId')} className="sm:col-span-3" hint="Có thể để trống; khu chưa có HT thì không nhận ngựa">
            <Select value={form.headTrainerId} onChange={(event) => setForm({ ...form, headTrainerId: event.target.value })}>
              <option value="">— Chưa giao —</option>
              {headTrainers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {action.error && !action.field && <div className="mt-4"><ErrorBox message={action.error} /></div>}
    </Modal>
  );
}

export function HeadTrainerDialog({
  zone,
  headTrainers,
  onClose,
  onDone,
}: {
  zone: ZoneRow | null;
  headTrainers: PersonOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [userId, setUserId] = useState('');
  useEffect(() => {
    setUserId(zone?.headTrainerId ?? '');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id]);

  const horses = zone?.capacity.horseCount ?? 0;
  const submit = async () => {
    if (!zone) return;
    const done = await action.run(() => setZoneHeadTrainer(zone.id, userId || null));
    if (done) {
      toast.push('Đã đổi HT phụ trách', 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!zone}
      onClose={onClose}
      title={`HT phụ trách ${zone?.name ?? ''}`}
      description="Một khu có đúng một HT phụ trách; một HT phụ trách được nhiều khu."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || (userId || undefined) === zone?.headTrainerId || (!userId && horses > 0)}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Huấn luyện viên trưởng">
          <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">— Gỡ HT (để trống) —</option>
            {headTrainers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        {!userId && horses > 0 && (
          <Notice tone="warning">Khu còn {horses} ngựa nên không gỡ HT được — chỉ đổi sang HT khác.</Notice>
        )}
        {userId && userId !== zone?.headTrainerId && (
          <Notice tone="info">HT mới và HT cũ đều nhận thông báo. Các lớp của khu chuyển sang HT mới quản lý.</Notice>
        )}
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

export function ZoneStatusDialog({ zone, onClose, onDone }: { zone: ZoneRow | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [status, setStatus] = useState<ZoneStatus>('ACTIVE');
  const [reason, setReason] = useState('');
  useEffect(() => {
    setStatus(zone?.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE');
    setReason('');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id]);

  const horses = zone?.capacity.horseCount ?? 0;
  const blocked = status !== 'ACTIVE' && horses > 0;
  const submit = async () => {
    if (!zone) return;
    const done = await action.run(() => setZoneStatus(zone.id, status, reason));
    if (done) {
      toast.push(`${zone.name}: ${zoneStatusLabel[status]}`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!zone}
      onClose={onClose}
      title={`Đổi trạng thái ${zone?.name ?? ''}`}
      description={zone ? `Hiện tại: ${zoneStatusLabel[zone.status]}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || blocked || !reason.trim() || status === zone?.status}>
            {action.pending ? 'Đang lưu…' : 'Đổi trạng thái'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Trạng thái mới">
          <Select value={status} onChange={(event) => setStatus(event.target.value as ZoneStatus)}>
            {(Object.keys(zoneStatusLabel) as ZoneStatus[])
              .filter((item) => item !== zone?.status)
              .map((item) => (
                <option key={item} value={item}>
                  {zoneStatusLabel[item]}
                </option>
              ))}
          </Select>
        </Field>
        {blocked && <Notice tone="danger">Khu còn {horses} ngựa nên không chuyển sang Đóng hoặc Bảo trì được. Chuyển hết ngựa sang khu khác trước.</Notice>}
        <Field label="Lý do" required>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: thay mái che" />
        </Field>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

export function AddStallsDialog({ zone, onClose, onDone }: { zone: ZoneRow | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [count, setCount] = useState('2');
  useEffect(() => {
    setCount('2');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id]);

  const n = Number.parseInt(count, 10) || 0;
  const lastNumber = (zone?.stalls ?? []).reduce((max, stall) => Math.max(max, Number.parseInt(stall.code.split('-')[1] ?? '0', 10) || 0), 0);
  const preview = Array.from({ length: Math.min(Math.max(n, 0), 30) }, (_, index) => `${zone?.code}-${String(lastNumber + index + 1).padStart(2, '0')}`);

  const submit = async () => {
    if (!zone) return;
    const result = await action.run(() => createStalls(zone.id, n));
    if (result) {
      toast.push(`Đã thêm ${result.codes.length} ô: ${result.codes.join(', ')}`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!zone}
      onClose={onClose}
      title={`Thêm ô cho ${zone?.name ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || n < 1 || n > 30}>
            {action.pending ? 'Đang thêm…' : `Thêm ${n > 0 ? n : ''} ô`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Số ô cần thêm" hint="Từ 1 đến 30 ô mỗi lần. Mã ô sinh tự động nối tiếp." error={action.field === 'count' ? action.error : undefined}>
          <Input type="number" min={1} max={30} value={count} onChange={(event) => setCount(event.target.value)} />
        </Field>
        {preview.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {preview.map((code) => (
              <span key={code} className="rounded-md bg-white px-2 py-1 font-mono text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                {code}
              </span>
            ))}
          </div>
        )}
        {action.error && action.field !== 'count' && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

export function MaintenanceDialog({ stall, onClose, onDone }: { stall: StallRow | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [note, setNote] = useState('');
  useEffect(() => {
    setNote('');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stall?.id]);

  const submit = async () => {
    if (!stall) return;
    const done = await action.run(() => setStallMaintenance(stall.id, true, note));
    if (done) {
      toast.push(`Ô ${stall.code} chuyển sang bảo trì`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!stall}
      onClose={onClose}
      title={`Bảo trì ô ${stall?.code ?? ''}`}
      description="Ô bảo trì không tính vào chỗ trống của khu."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Chuyển sang bảo trì'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Ghi chú bảo trì">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: thay sàn cao su" className="min-h-16" />
        </Field>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}
