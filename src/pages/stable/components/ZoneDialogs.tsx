// Hộp thoại quản lý khu và ô chuồng trên Sơ đồ chuồng (CM). Backend kiểm lại mọi luật: khu còn ngựa không đóng/bảo trì/gỡ HT/xóa,
// khu còn ô không xóa, ô có ngựa không bảo trì/xóa, không làm khu thiếu ô cho ngựa đang chờ xếp ô.
import { useEffect, useMemo, useState } from 'react';
import { useAction } from '../../../hooks/useService';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { createBarn, createStall, updateBarn, updateStall } from '../../../api/stable';
import type { BarnListItem, BarnStatus, Stall, StallType, UserAccount } from '../../../api/types';
import { Button, CancelButton, CharCount, ConfirmDialog, ErrorBox, Field, Input, Modal, Notice, Select, Textarea, cn, invalidClass, scrollToFirstError, useToast } from '../../../components/ui';
import { ChoiceList } from '../../../components/ui/ChoiceList';
import { zoneStatusLabel } from '../../../lib/labels';
import { stallTypeLabel } from '../../../lib/api-labels';
import { MAX_STALLS_PER_BARN, stallLimit, stallRoom } from './barn';

const ZONE_NAME_MAX = 80;
const ZONE_DESCRIPTION_MAX = 1000;
const STALL_CODE_MAX = 80;
const STALL_NOTE_MAX = 500;

/** Loại ô được chọn khi thêm ô. */
const SELECTABLE_STALL_TYPES: StallType[] = ['STANDARD', 'ISOLATION', 'RECOVERY'];

/* ===== Thêm / sửa khu ===== */

export function ZoneFormDialog({
  open,
  zone,
  stallCount = 0,
  headTrainers,
  onClose,
  onDone,
}: {
  open: boolean;
  zone?: BarnListItem;
  /** Số ô hiện có của khu (khi sửa): sức chứa không được nhỏ hơn. */
  stallCount?: number;
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

  const capacityValue = capacity.trim() ? Number(capacity) : undefined;
  // Sơ đồ mỗi khu tối đa 9 ô; để trống = không đặt sức chứa (tối đa 9 ô).
  const errors = useMemo(
    () => ({
      name: !name.trim() ? 'Nhập tên khu' : undefined,
      capacity: !capacity.trim()
        ? undefined
        : !/^\d+$/.test(capacity.trim()) || Number(capacity) < 1 || Number(capacity) > MAX_STALLS_PER_BARN
          ? `Sức chứa là số nguyên từ 1 đến ${MAX_STALLS_PER_BARN}`
          : zone && Number(capacity) < stallCount
            ? `Khu đang có ${stallCount} ô, sức chứa không được nhỏ hơn`
            : undefined,
      description: description.trim().length > ZONE_DESCRIPTION_MAX ? `Tối đa ${ZONE_DESCRIPTION_MAX} ký tự` : undefined,
    }),
    [name, capacity, zone, stallCount, description],
  );
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const { reset } = f;

  useEffect(() => {
    if (!open) return;
    setName(zone?.name ?? '');
    setDescription(zone?.description ?? '');
    setCapacity(zone?.capacity ? String(zone.capacity) : '');
    setHeadTrainerId('');
    action.clearError();
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, zone?.id]);

  const serverOnField = ['name', 'capacity', 'description'].some((key) => action.fieldErrors[key] || action.field === key);

  const submit = async () => {
    if (action.pending || !f.attempt()) return;
    const done = await action.run(async () => {
      const input = { name: name.trim(), description: description.trim() || undefined, capacity: capacityValue };
      // Sửa khu: xóa trống sức chứa thì gửi null để bỏ giới hạn (undefined = giữ nguyên).
      if (zone) return updateBarn(zone.id, { ...input, capacity: capacityValue ?? null });
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
      dirty={name !== (zone?.name ?? '') || description !== (zone?.description ?? '') || capacity !== (zone?.capacity ? String(zone.capacity) : '') || headTrainerId !== ''}
      busy={action.pending}
      description="Tên khu không trùng với khu khác đang dùng."
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : zone ? 'Lưu' : 'Tạo khu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tên khu" required name="name" error={f.show('name')} onBlur={f.blur('name')}>
          <Input
            value={name}
            maxLength={ZONE_NAME_MAX}
            onChange={(event) => {
              setName(event.target.value);
              if (action.fieldErrors.name || action.field === 'name') action.clearError();
            }}
            placeholder="Ví dụ: Khu D"
            className={cn(f.show('name') && invalidClass)}
          />
        </Field>
        <Field
          label="Sức chứa (số ô tối đa)"
          name="capacity"
          error={f.show('capacity')}
          onBlur={f.blur('capacity')}
          hint={`Tối đa ${MAX_STALLS_PER_BARN} ô, để trống = ${MAX_STALLS_PER_BARN} ô.`}
        >
          <Input
            inputMode="numeric"
            maxLength={2}
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            placeholder={`Để trống = ${MAX_STALLS_PER_BARN} ô`}
            className={cn(f.show('capacity') && invalidClass)}
          />
        </Field>
        <Field label="Mô tả" name="description" error={f.show('description')} onBlur={f.blur('description')} counter={<CharCount value={description} max={ZONE_DESCRIPTION_MAX} />}>
          <Textarea value={description} maxLength={ZONE_DESCRIPTION_MAX} onChange={(event) => setDescription(event.target.value)} className="min-h-16" placeholder="Vị trí, tiện nghi…" />
        </Field>
        {!zone && (
          <Field label="HLV phụ trách" hint="Có thể gán sau. Khu chưa có HLV thì chưa nhận ngựa.">
            <Select value={headTrainerId} onChange={(event) => setHeadTrainerId(event.target.value)}>
              <option value="">Chưa gán</option>
              {headTrainers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {action.error && !serverOnField && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Đổi HT phụ trách ===== */

export function HeadTrainerDialog({
  zone,
  headTrainers,
  barns = [],
  onClose,
  onDone,
}: {
  zone: BarnListItem | null;
  headTrainers: UserAccount[];
  /** Mọi khu: để ghi dưới tên mỗi HT các khu họ đang phụ trách. */
  barns?: BarnListItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [headTrainerId, setHeadTrainerId] = useState('');
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    setHeadTrainerId(zone?.headTrainerId ?? '');
    setAttempted(false);
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id]);

  const choiceError = !headTrainerId ? 'Chọn HLV phụ trách' : headTrainerId === (zone?.headTrainerId ?? '') ? 'Chọn HLV khác HLV hiện tại' : undefined;

  const submit = async () => {
    setAttempted(true);
    if (!zone || choiceError || action.pending) return;
    const done = await action.run(() => updateBarn(zone.id, { headTrainerId }));
    if (done) {
      toast.push(zone.headTrainerId ? 'Đã đổi HLV phụ trách' : 'Đã gán HLV phụ trách', 'success');
      onDone();
      onClose();
    }
  };

  const zonesOf = (userId: string) => barns.filter((barn) => barn.headTrainerId === userId).map((barn) => barn.name);

  return (
    <Modal
      open={!!zone}
      onClose={onClose}
      width="max-w-2xl"
      title={`${zone?.headTrainerId ? 'Đổi' : 'Gán'} HLV phụ trách ${zone?.name ?? ''}`}
      dirty={headTrainerId !== (zone?.headTrainerId ?? '')}
      busy={action.pending}
      description={zone?.headTrainerFullName ? `Hiện tại: ${zone.headTrainerFullName}` : 'Khu chưa có HLV phụ trách'}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ChoiceList
          label="HLV phụ trách"
          value={headTrainerId}
          onChange={setHeadTrainerId}
          empty="Chưa có HLV trưởng nào đang hoạt động."
          choices={headTrainers.map((item) => {
            const names = zonesOf(item.id);
            return {
              value: item.id,
              title: item.fullName,
              meta: names.length ? `Đang phụ trách ${names.join(', ')}` : 'Chưa phụ trách khu nào',
              badge: item.id === zone?.headTrainerId ? 'Hiện tại' : undefined,
            };
          })}
        />
        {attempted && choiceError && (
          <p role="alert" data-invalid="true" className="text-xs font-medium text-red-600">
            {choiceError}
          </p>
        )}
        <Notice tone="info">Ngựa của khu chuyển sang HLV mới ngay khi lưu.</Notice>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Gỡ HT phụ trách (thao tác riêng, có xác nhận) ===== */

export function UnassignTrainerDialog({
  zone,
  horseCount,
  onClose,
  onDone,
}: {
  zone: BarnListItem | null;
  /** Số ngựa còn trong khu: còn ngựa thì không gỡ được. */
  horseCount: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  useEffect(() => {
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id]);
  const blocked = horseCount > 0;

  return (
    <ConfirmDialog
      open={!!zone}
      title={`Gỡ HLV phụ trách ${zone?.name ?? ''}`}
      message={
        blocked ? (
          <>Không gỡ được: khu còn {horseCount} ngựa. Đổi khu cho các ngựa này trước, hoặc đổi sang HLV khác.</>
        ) : (
          <>
            Gỡ <span className="font-semibold text-gray-900">{zone?.headTrainerFullName ?? 'HLV'}</span> khỏi {zone?.name}. Khu sẽ không có ai phụ trách.
          </>
        )
      }
      consequences={blocked ? [] : ['Khu ngừng nhận ngựa mới cho tới khi có HLV', 'Không ai xếp ô, chuyển ô hay giao Groom trong khu này']}
      confirmLabel="Gỡ HLV"
      disabled={blocked}
      pending={action.pending}
      onClose={onClose}
      onConfirm={async () => {
        if (!zone) return;
        const done = await action.run(async () => {
          await updateBarn(zone.id, { headTrainerId: null });
          return true;
        });
        if (done) {
          toast.push(`Đã gỡ HLV phụ trách ${zone.name}`, 'success');
          onDone();
          onClose();
        }
      }}
    >
      {action.error && <ErrorBox message={action.error} />}
    </ConfirmDialog>
  );
}

/* ===== Đổi trạng thái khu ===== */

export function ZoneStatusDialog({ zone, onClose, onDone }: { zone: BarnListItem | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [status, setStatus] = useState<BarnStatus>('ACTIVE');
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    setStatus(zone?.status ?? 'ACTIVE');
    setAttempted(false);
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id]);

  const unchanged = status === zone?.status;

  const submit = async () => {
    setAttempted(true);
    if (!zone || unchanged || action.pending) return;
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
      busy={action.pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Trạng thái" name="status" error={attempted && unchanged ? 'Chọn trạng thái khác trạng thái hiện tại' : undefined}>
          <Select value={status} onChange={(event) => setStatus(event.target.value as BarnStatus)}>
            {(Object.keys(zoneStatusLabel) as BarnStatus[]).map((item) => (
              <option key={item} value={item}>
                {zoneStatusLabel[item]}
              </option>
            ))}
          </Select>
        </Field>
        <Notice tone="info">Khu còn ngựa thì chưa đóng hoặc bảo trì được.</Notice>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Thêm ô ===== */

/** Gợi ý tiền tố và số tiếp theo từ các mã ô sẵn có, ví dụ "SD-A07" → tiền tố "SD-A", số 8. */
function suggestCodes(codesInZone: string[], zoneName: string) {
  const parsed = codesInZone.map((code) => code.match(/^(.*?)(\d+)$/)).filter(Boolean) as RegExpMatchArray[];
  if (parsed.length) {
    const prefix = parsed[0][1];
    const width = parsed[0][2].length;
    const max = Math.max(...parsed.filter((item) => item[1] === prefix).map((item) => Number(item[2])));
    return { prefix, next: max + 1, width };
  }
  // "Khu C (seed)" → "C-": bỏ chữ "Khu", phần trong ngoặc và khoảng trắng.
  const letter =
    zoneName
      .replace(/\(.*?\)/g, '')
      .replace(/^\s*khu\s+/i, '')
      .replace(/\s+/g, '')
      .slice(0, 2)
      .toUpperCase() || 'X';
  return { prefix: `${letter}-`, next: 1, width: 2 };
}

export function AddStallsDialog({
  zone,
  stalls,
  onClose,
  onDone,
  onEditZone,
}: {
  zone: BarnListItem | null;
  stalls: Stall[];
  onClose: () => void;
  onDone: () => void;
  /** Mở hộp sửa khu (để tăng sức chứa) khi khu đã đầy. */
  onEditZone?: () => void;
}) {
  const toast = useToast();
  const [count, setCount] = useState('1');
  const [prefix, setPrefix] = useState('');
  const [start, setStart] = useState('1');
  const [width, setWidth] = useState(2);
  const [type, setType] = useState<StallType>('STANDARD');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [touched, setTouched] = useState<Partial<Record<'count' | 'prefix' | 'start', boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  // Ô vừa tạo trong lần mở hộp thoại này: tính vào số ô hiện có và gợi ý mã tiếp theo,
  // để thử lại sau khi lỗi giữa chừng không bị trùng mã.
  const [created, setCreated] = useState<string[]>([]);

  useEffect(() => {
    if (!zone) return;
    const suggestion = suggestCodes(
      stalls.map((stall) => stall.code),
      zone.name,
    );
    setPrefix(suggestion.prefix);
    setStart(String(suggestion.next));
    setWidth(suggestion.width);
    setCount('1');
    setType('STANDARD');
    setError(undefined);
    setCreated([]);
    setTouched({});
    setAttempted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id]);

  const current = stalls.length + created.filter((code) => !stalls.some((stall) => stall.code === code)).length;
  const limit = zone ? stallLimit(zone) : MAX_STALLS_PER_BARN;
  const room = zone ? stallRoom(zone, current) : 0;
  const capped = !!zone?.capacity && zone.capacity < MAX_STALLS_PER_BARN;
  const digits = (value: string) => /^\d+$/.test(value.trim());
  const n = Number(count.trim());
  const first = Number(start.trim());
  // Mã dài nhất là mã của ô cuối (backend giới hạn mã ô 80 ký tự).
  const lastCode = digits(count) && digits(start) ? `${prefix.trim()}${String(first + n - 1).padStart(width, '0')}` : '';
  const errors = {
    count: !count.trim()
      ? 'Nhập số ô'
      : !digits(count) || n < 1
        ? 'Số ô là số nguyên từ 1'
        : n > room
          ? room > 0
            ? `Chỉ thêm được ${room} ô nữa`
            : 'Khu không thêm được ô nào nữa'
          : undefined,
    prefix: !prefix.trim() ? 'Nhập tiền tố mã' : undefined,
    start: !start.trim()
      ? 'Nhập số bắt đầu'
      : !digits(start) || first < 1
        ? 'Số bắt đầu là số nguyên từ 1'
        : lastCode.length > STALL_CODE_MAX
          ? `Mã ô tối đa ${STALL_CODE_MAX} ký tự, hãy rút ngắn tiền tố`
          : undefined,
  };
  const show = (key: keyof typeof errors) => (touched[key] || attempted ? errors[key] : undefined);
  const touch = (key: keyof typeof errors) => () => setTouched((current) => ({ ...current, [key]: true }));
  const valid = !Object.values(errors).some(Boolean);
  const codes = valid ? Array.from({ length: n }, (_, index) => `${prefix.trim()}${String(first + index).padStart(width, '0')}`) : [];

  const submit = async () => {
    if (!zone || pending) return;
    setAttempted(true);
    if (!valid) {
      scrollToFirstError();
      return;
    }
    setPending(true);
    setError(undefined);
    const done: string[] = [];
    try {
      for (const code of codes) {
        await createStall({ barnId: zone.id, code, type });
        done.push(code);
      }
      toast.push(`Đã thêm ${done.length} ô: ${done.join(', ')}`, 'success');
      onDone();
      onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Đã xảy ra lỗi';
      setError(done.length ? `Đã thêm ${done.join(', ')}. Dừng ở ô tiếp theo: ${message}` : message);
      if (done.length) {
        // Gợi ý lại số bắt đầu và số ô còn lại để bấm thử tiếp không trùng mã đã tạo.
        const all = [...created, ...done];
        setCreated(all);
        const next = suggestCodes([...stalls.map((stall) => stall.code), ...all], zone.name);
        if (next.prefix === prefix.trim()) setStart(String(next.next));
        setCount(String(Math.max(1, n - done.length)));
        onDone();
      }
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
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={pending || room === 0}>
            {pending ? 'Đang thêm…' : `Thêm ${valid ? n : ''} ô`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 ring-1 ring-gray-100">
          <span className="text-2xl font-bold tabular-nums text-gray-900">
            {current}
            <span className="text-base font-semibold text-gray-400">/{limit}</span>
          </span>
          <span className="min-w-0 flex-1">
            Khu đang có {current} ô · {capped ? `sức chứa ${zone?.capacity} ô` : `tối đa ${MAX_STALLS_PER_BARN} ô`}
            <span className="block text-xs text-gray-500">{room > 0 ? `Thêm được ${room} ô nữa.` : 'Không thêm được ô nào nữa.'}</span>
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Số ô" required name="count" error={room === 0 ? undefined : show('count')} onBlur={touch('count')}>
            <Input
              inputMode="numeric"
              maxLength={2}
              value={count}
              disabled={room === 0}
              onChange={(event) => setCount(event.target.value)}
              className={cn(room > 0 && show('count') && invalidClass)}
            />
          </Field>
          <Field label="Tiền tố mã" required name="prefix" error={show('prefix')} onBlur={touch('prefix')}>
            <Input value={prefix} maxLength={STALL_CODE_MAX - 1} className={cn('font-mono', show('prefix') && invalidClass)} onChange={(event) => setPrefix(event.target.value)} />
          </Field>
          <Field label="Bắt đầu từ số" required name="start" error={show('start')} onBlur={touch('start')}>
            <Input inputMode="numeric" maxLength={6} value={start} onChange={(event) => setStart(event.target.value)} className={cn(show('start') && invalidClass)} />
          </Field>
        </div>
        <Field label="Loại ô">
          <Select value={type} onChange={(event) => setType(event.target.value as StallType)}>
            {SELECTABLE_STALL_TYPES.map((item) => (
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
        {room === 0 &&
          (capped ? (
            <Notice tone="warning">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>Khu đã đạt sức chứa ({zone?.capacity} ô). Tăng sức chứa của khu để thêm ô.</span>
                {onEditZone && (
                  <Button size="sm" variant="secondary" onClick={onEditZone}>
                    Sửa sức chứa
                  </Button>
                )}
              </span>
            </Notice>
          ) : (
            <Notice tone="warning">Khu đã đủ {MAX_STALLS_PER_BARN} ô, không thêm được nữa.</Notice>
          ))}
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
      dirty={note.trim() !== ''}
      busy={action.pending}
      description="Ô bảo trì không nhận ngựa cho tới khi kết thúc bảo trì."
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Chuyển sang bảo trì'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Ghi chú bảo trì" hint="Lưu vào mô tả của ô" counter={<CharCount value={note} max={STALL_NOTE_MAX} />}>
          <Textarea value={note} maxLength={STALL_NOTE_MAX} onChange={(event) => setNote(event.target.value)} className="min-h-16" placeholder="Ví dụ: thay máng nước" />
        </Field>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}
