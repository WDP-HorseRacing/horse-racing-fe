// Hộp thoại của danh mục khu và ô chuồng (CM). Backend kiểm lại mọi luật: khu còn ngựa không đóng/bảo trì/gỡ HT/xóa,
// khu còn ô không xóa, ô có ngựa không bảo trì/xóa, không làm khu thiếu ô cho ngựa đang chờ xếp ô.
import { useEffect, useState } from 'react';
import { useAction } from '../../../hooks/useService';
import { createBarn, createStall, updateBarn, updateStall } from '../../../api/stable';
import type { BarnListItem, BarnStatus, Stall, StallType, UserAccount } from '../../../api/types';
import { Button, ErrorBox, Field, Input, Modal, Notice, Select, Textarea, useToast } from '../../../components/ui';
import { zoneStatusLabel } from '../../../lib/labels';
import { stallTypeLabel } from '../../../lib/api-labels';

/* ===== Thêm / sửa khu ===== */

export function ZoneFormDialog({
  open,
  zone,
  headTrainers,
  onClose,
  onDone,
}: {
  open: boolean;
  zone?: BarnListItem;
  headTrainers: UserAccount[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('');
  const [headTrainerId, setHeadTrainerId] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(zone?.name ?? '');
    setDescription(zone?.description ?? '');
    setCapacity(zone?.capacity ? String(zone.capacity) : '');
    setHeadTrainerId('');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, zone?.id]);

  const capacityValue = capacity.trim() ? Number(capacity) : undefined;
  const capacityInvalid = capacityValue !== undefined && (!Number.isInteger(capacityValue) || capacityValue < 1);

  const submit = async () => {
    const done = await action.run(async () => {
      const input = { name: name.trim(), description: description.trim() || undefined, capacity: capacityValue };
      if (zone) return updateBarn(zone.id, input);
      const created = await createBarn(input);
      // Khu mới chưa có HT; gán luôn nếu CM đã chọn.
      if (headTrainerId) await updateBarn(created.id, { headTrainerId });
      return created;
    });
    if (done) {
      toast.push(zone ? `Đã lưu ${name.trim()}` : `Đã tạo ${name.trim()}`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={zone ? `Sửa ${zone.name}` : 'Thêm khu chuồng'}
      description="Tên khu không trùng với khu khác đang dùng. Sức chứa là số ô tối đa; để trống nếu không giới hạn."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={!name.trim() || capacityInvalid || action.pending}>
            {action.pending ? 'Đang lưu…' : zone ? 'Lưu' : 'Tạo khu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tên khu" required>
          <Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Khu D" />
        </Field>
        <Field label="Sức chứa (số ô tối đa)" error={capacityInvalid ? 'Sức chứa là số nguyên từ 1 trở lên' : undefined}>
          <Input inputMode="numeric" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="Không giới hạn" />
        </Field>
        <Field label="Mô tả">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-16" placeholder="Vị trí, tiện nghi…" />
        </Field>
        {!zone && (
          <Field label="HT phụ trách" hint="Có thể gán sau. Khu chưa có HT thì chưa nhận ngựa.">
            <Select value={headTrainerId} onChange={(event) => setHeadTrainerId(event.target.value)}>
              <option value="">— Chưa gán —</option>
              {headTrainers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Đổi HT phụ trách ===== */

export function HeadTrainerDialog({
  zone,
  headTrainers,
  onClose,
  onDone,
}: {
  zone: BarnListItem | null;
  headTrainers: UserAccount[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [headTrainerId, setHeadTrainerId] = useState('');

  useEffect(() => {
    setHeadTrainerId(zone?.headTrainerId ?? '');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id]);

  const submit = async () => {
    if (!zone) return;
    const done = await action.run(() => updateBarn(zone.id, { headTrainerId: headTrainerId || null }));
    if (done) {
      toast.push(headTrainerId ? 'Đã đổi HT phụ trách' : 'Đã gỡ HT phụ trách', 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!zone}
      onClose={onClose}
      title={`HT phụ trách ${zone?.name ?? ''}`}
      description={zone?.headTrainerFullName ? `Hiện tại: ${zone.headTrainerFullName}` : 'Khu chưa có HT phụ trách'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || (headTrainerId || null) === (zone?.headTrainerId ?? null)}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="HT phụ trách">
          <Select value={headTrainerId} onChange={(event) => setHeadTrainerId(event.target.value)}>
            <option value="">— Gỡ HT (chỉ khi khu không còn ngựa) —</option>
            {headTrainers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Notice tone="info">Đổi sang HT khác luôn được, kể cả khi khu còn ngựa: ngựa chuyển sang phạm vi của HT mới ngay.</Notice>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Đổi trạng thái khu ===== */

export function ZoneStatusDialog({ zone, onClose, onDone }: { zone: BarnListItem | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [status, setStatus] = useState<BarnStatus>('ACTIVE');

  useEffect(() => {
    setStatus(zone?.status ?? 'ACTIVE');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id]);

  const submit = async () => {
    if (!zone) return;
    const done = await action.run(() => updateBarn(zone.id, { status }));
    if (done) {
      toast.push(`${zone.name}: ${zoneStatusLabel[status].toLowerCase()}`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!zone}
      onClose={onClose}
      title={`Trạng thái ${zone?.name ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || status === zone?.status}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Trạng thái">
          <Select value={status} onChange={(event) => setStatus(event.target.value as BarnStatus)}>
            {(Object.keys(zoneStatusLabel) as BarnStatus[]).map((item) => (
              <option key={item} value={item}>
                {zoneStatusLabel[item]}
              </option>
            ))}
          </Select>
        </Field>
        <Notice tone="info">Khu còn ngựa thì không chuyển sang Bảo trì hoặc Đóng — hãy đổi khu cho các ngựa trước. Khu không hoạt động không nhận ngựa mới.</Notice>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Thêm ô ===== */

/** Gợi ý tiền tố và số tiếp theo từ các mã ô sẵn có, ví dụ "SD-A07" → tiền tố "SD-A", số 8. */
function suggestCodes(stalls: Stall[], zoneName: string) {
  const parsed = stalls.map((stall) => stall.code.match(/^(.*?)(\d+)$/)).filter(Boolean) as RegExpMatchArray[];
  if (parsed.length) {
    const prefix = parsed[0][1];
    const width = parsed[0][2].length;
    const max = Math.max(...parsed.filter((item) => item[1] === prefix).map((item) => Number(item[2])));
    return { prefix, next: max + 1, width };
  }
  const letter = zoneName.replace(/^khu\s+/i, '').trim().slice(0, 2).toUpperCase() || 'X';
  return { prefix: `${letter}-`, next: 1, width: 2 };
}

export function AddStallsDialog({
  zone,
  stalls,
  onClose,
  onDone,
}: {
  zone: BarnListItem | null;
  stalls: Stall[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [count, setCount] = useState('1');
  const [prefix, setPrefix] = useState('');
  const [start, setStart] = useState('1');
  const [width, setWidth] = useState(2);
  const [type, setType] = useState<StallType>('STANDARD');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!zone) return;
    const suggestion = suggestCodes(stalls, zone.name);
    setPrefix(suggestion.prefix);
    setStart(String(suggestion.next));
    setWidth(suggestion.width);
    setCount('1');
    setType('STANDARD');
    setError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id]);

  const n = Number(count);
  const first = Number(start);
  const valid = Number.isInteger(n) && n >= 1 && n <= 20 && Number.isInteger(first) && first >= 0 && prefix.trim().length > 0;
  const codes = valid ? Array.from({ length: n }, (_, index) => `${prefix.trim()}${String(first + index).padStart(width, '0')}`) : [];

  const submit = async () => {
    if (!zone) return;
    setPending(true);
    setError(undefined);
    const created: string[] = [];
    try {
      for (const code of codes) {
        await createStall({ barnId: zone.id, code, type });
        created.push(code);
      }
      toast.push(`Đã thêm ${created.length} ô: ${created.join(', ')}`, 'success');
      onDone();
      onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Đã xảy ra lỗi';
      setError(created.length ? `Đã thêm ${created.join(', ')}; dừng ở ô tiếp theo: ${message}` : message);
      if (created.length) onDone();
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={!!zone}
      onClose={onClose}
      title={`Thêm ô cho ${zone?.name ?? ''}`}
      description="Mã ô không trùng trong toàn câu lạc bộ. Ô mới luôn ở trạng thái Trống."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={!valid || pending}>
            {pending ? 'Đang thêm…' : `Thêm ${valid ? n : ''} ô`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Số ô" required hint="Tối đa 20 ô một lần">
            <Input inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} />
          </Field>
          <Field label="Tiền tố mã" required>
            <Input value={prefix} maxLength={70} className="font-mono" onChange={(event) => setPrefix(event.target.value)} />
          </Field>
          <Field label="Bắt đầu từ số" required>
            <Input inputMode="numeric" value={start} onChange={(event) => setStart(event.target.value)} />
          </Field>
        </div>
        <Field label="Loại ô">
          <Select value={type} onChange={(event) => setType(event.target.value as StallType)}>
            {(Object.keys(stallTypeLabel) as StallType[]).map((item) => (
              <option key={item} value={item}>
                {stallTypeLabel[item]}
              </option>
            ))}
          </Select>
        </Field>
        {codes.length > 0 && (
          <p className="text-sm text-gray-600">
            Sẽ tạo: <span className="font-mono">{codes.join(', ')}</span>
          </p>
        )}
        {zone?.capacity && <p className="text-xs text-gray-500">Sức chứa tối đa của khu: {zone.capacity} ô.</p>}
        {error && <ErrorBox message={error} />}
      </div>
    </Modal>
  );
}

/* ===== Chuyển ô sang bảo trì ===== */

export function MaintenanceDialog({ stall, onClose, onDone }: { stall: Stall | null; onClose: () => void; onDone: () => void }) {
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
    const done = await action.run(() => updateStall(stall.id, { status: 'MAINTENANCE', description: note.trim() || undefined }));
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
      description="Ô bảo trì không nhận ngựa cho tới khi kết thúc bảo trì."
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
        <Field label="Ghi chú bảo trì" hint="Lưu vào mô tả của ô">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-16" placeholder="Ví dụ: thay máng nước" />
        </Field>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}
