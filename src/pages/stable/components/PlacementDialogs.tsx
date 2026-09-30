// Hộp thoại xếp chỗ dùng chung cho sơ đồ chuồng và hồ sơ ngựa (F1.6, F1.7).
import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Info } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import {
  assignStall,
  assignZone,
  listAvailableStalls,
  listGrooms,
  listZoneOptions,
  previewZoneAssignment,
  setGroom,
} from '../../../services/horse.service';
import { Button, ErrorBox, Field, Modal, Notice, Select, Skeleton, Textarea, cn, useToast } from '../../../components/ui';

export interface PlacementHorse {
  id: string;
  name: string;
  zoneId?: string;
  zoneName?: string;
  stallCode?: string;
  groomId?: string;
  groomName?: string;
  quarantined?: boolean;
}

/* ===== CM xếp / đổi khu ===== */

export function AssignZoneDialog({
  horse,
  onClose,
  onDone,
}: {
  horse: PlacementHorse | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [zoneId, setZoneId] = useState('');
  const [reason, setReason] = useState('');
  const zones = useService(() => (horse ? listZoneOptions() : Promise.resolve([])), [horse?.id]);
  const preview = useService(
    () => (horse && zoneId ? previewZoneAssignment(horse.id, zoneId) : Promise.resolve(undefined)),
    [horse?.id, zoneId],
  );

  useEffect(() => {
    setZoneId('');
    setReason('');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horse?.id]);

  const isChange = !!horse?.zoneId;
  const data = preview.data;
  const blocked = !data || data.blockers.length > 0;

  const submit = async () => {
    if (!horse) return;
    const done = await action.run(() => assignZone(horse.id, zoneId, reason));
    if (done) {
      toast.push(`${horse.name} đã được xếp vào ${data?.zoneName ?? 'khu mới'}`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!horse}
      onClose={onClose}
      width="max-w-2xl"
      title={isChange ? `Đổi khu cho ${horse?.name ?? ''}` : `Xếp khu cho ${horse?.name ?? ''}`}
      description={isChange ? `Đang ở ${horse?.zoneName}${horse?.stallCode ? `, ô ${horse.stallCode}` : ''}` : 'Ngựa đang chờ xếp khu'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={!zoneId || blocked || action.pending || (isChange && !reason.trim())}>
            {action.pending ? 'Đang xếp…' : isChange ? 'Xác nhận đổi khu' : 'Xếp vào khu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {zones.loading ? (
          <Skeleton rows={2} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {(zones.data ?? []).map((zone) => {
              const current = zone.id === horse?.zoneId;
              const disabled = !zone.available || current;
              return (
                <button
                  key={zone.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setZoneId(zone.id)}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left transition',
                    zoneId === zone.id
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 bg-white hover:border-gray-400',
                    disabled && 'cursor-not-allowed border-dashed bg-gray-50/60 opacity-70 hover:border-gray-200',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900">{zone.name}</span>
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        zone.free > 0 ? 'text-gray-600' : 'font-medium text-amber-700',
                      )}
                    >
                      Chỗ trống {Math.max(0, zone.free)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">HT: {zone.headTrainerName ?? 'chưa có'}</p>
                  {current && <p className="mt-1 text-xs font-medium text-gray-500">Khu hiện tại</p>}
                  {!current && zone.reason && <p className="mt-1 text-xs text-gray-500">{zone.reason}</p>}
                </button>
              );
            })}
          </div>
        )}

        {zoneId && preview.loading && <Skeleton rows={1} />}
        {data && (
          <div className="space-y-3">
            {data.blockers.length > 0 && (
              <Notice tone="danger" icon={<AlertTriangle size={16} />}>
                {data.blockers.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </Notice>
            )}
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700 ring-1 ring-gray-200/70">
              <p className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
                {data.fromZoneName ?? 'Chờ xếp khu'} <ArrowRight size={14} className="text-gray-400" /> {data.zoneName}
              </p>
              <ul className="space-y-1.5">
                <li>Ngựa vào danh sách "Chờ xếp ô" của {data.zoneName}; HT của khu sẽ xếp ô và nhận thông báo.</li>
                {data.stallToFree && <li>Ô {data.stallToFree} được trả về trống.</li>}
                {data.isChange && (
                  <li className={data.classesToLeave.length ? 'font-medium text-amber-700' : ''}>
                    {data.classesToLeave.length
                      ? `Rút khỏi ${data.classesToLeave.length} lớp của khu cũ: ${data.classesToLeave.join(', ')}`
                      : 'Không có lớp nào của khu cũ phải rút'}
                  </li>
                )}
                <li>{data.groomKept ? `Giữ nguyên Groom ${data.groomKept}` : 'Chưa có Groom — HT phân công khi xếp ô'}</li>
                <li>
                  Sau khi xếp, chỗ trống của {data.zoneName} còn {Math.max(0, data.free - 1)}.
                </li>
              </ul>
            </div>
          </div>
        )}

        {isChange && (
          <Field label="Lý do đổi khu" required error={action.field === 'reason' ? action.error : undefined}>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: cân đối số ngựa giữa hai khu" />
          </Field>
        )}
        {action.error && action.field !== 'reason' && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== HT xếp / đổi ô (kèm Groom bắt buộc) ===== */

export function AssignStallDialog({
  horse,
  onClose,
  onDone,
  presetStallId,
}: {
  horse: PlacementHorse | null;
  onClose: () => void;
  onDone: () => void;
  presetStallId?: string;
}) {
  const toast = useToast();
  const action = useAction();
  const [stallId, setStallId] = useState('');
  const [groomId, setGroomId] = useState('');
  const stalls = useService(
    () => (horse?.zoneId ? listAvailableStalls(horse.zoneId) : Promise.resolve([])),
    [horse?.id, horse?.zoneId],
  );
  const grooms = useService(() => (horse ? listGrooms() : Promise.resolve([])), [horse?.id]);

  useEffect(() => {
    setStallId(presetStallId ?? '');
    setGroomId(horse?.groomId ?? '');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horse?.id, presetStallId]);

  const moving = !!horse?.stallCode;
  const submit = async () => {
    if (!horse) return;
    const done = await action.run(() => assignStall(horse.id, stallId, groomId));
    if (done) {
      const code = stalls.data?.find((item) => item.id === stallId)?.code;
      toast.push(`${horse.name} đã vào ô ${code ?? ''}`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!horse}
      onClose={onClose}
      width="max-w-2xl"
      title={moving ? `Đổi ô cho ${horse?.name ?? ''}` : `Xếp ô cho ${horse?.name ?? ''}`}
      description={`${horse?.zoneName ?? ''}${moving ? ` · đang ở ô ${horse?.stallCode}` : ' · đang chờ xếp ô'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={!stallId || !groomId || action.pending}>
            {action.pending ? 'Đang lưu…' : moving ? 'Chuyển sang ô này' : 'Xếp vào ô'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {horse?.quarantined && (
          <Notice tone="warning" icon={<Info size={16} />}>
            Ngựa đang cách ly. Cân nhắc chuyển sang ô trống cách xa các ngựa khác để tách đàn.
          </Notice>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-600">
            Chọn ô trống<span className="ml-0.5 text-red-500">*</span>
          </p>
          {stalls.loading ? (
            <Skeleton rows={1} />
          ) : (stalls.data ?? []).length === 0 ? (
            <Notice tone="warning">Khu không còn ô trống. Quản lý câu lạc bộ cần thêm ô hoặc kết thúc bảo trì một ô.</Notice>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(stalls.data ?? []).map((stall) => (
                <button
                  key={stall.id}
                  type="button"
                  onClick={() => setStallId(stall.id)}
                  className={cn(
                    'rounded-xl border px-3 py-3 font-mono text-sm font-semibold transition',
                    stallId === stall.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-dashed border-gray-300 bg-white text-gray-700 hover:border-gray-400',
                  )}
                >
                  {stall.code}
                </button>
              ))}
            </div>
          )}
          {action.field === 'stallId' && <p className="mt-1.5 text-xs font-medium text-red-600">{action.error}</p>}
        </div>
        <Field
          label="Groom phụ trách"
          required
          hint="Bắt buộc khi xếp ô. Groom được phân công theo con ngựa, không theo ô."
          error={action.field === 'groomId' ? action.error : undefined}
        >
          <Select value={groomId} onChange={(event) => setGroomId(event.target.value)}>
            <option value="">— Chọn Groom —</option>
            {(grooms.data ?? []).map((groom) => (
              <option key={groom.id} value={groom.id}>
                {groom.name} · đang phụ trách {groom.horseCount} ngựa
              </option>
            ))}
          </Select>
        </Field>
        {horse?.groomId && groomId && groomId !== horse.groomId && (
          <Notice tone="info">Groom {horse.groomName} sẽ kết thúc phân công; cả Groom cũ và mới đều nhận thông báo.</Notice>
        )}
        {action.error && action.field !== 'stallId' && action.field !== 'groomId' && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== HT phân công / đổi Groom ===== */

export function GroomDialog({
  horse,
  onClose,
  onDone,
}: {
  horse: PlacementHorse | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [groomId, setGroomId] = useState('');
  const [reason, setReason] = useState('');
  const grooms = useService(() => (horse ? listGrooms() : Promise.resolve([])), [horse?.id]);

  useEffect(() => {
    setGroomId('');
    setReason('');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horse?.id]);

  const submit = async () => {
    if (!horse) return;
    const done = await action.run(() => setGroom(horse.id, groomId, reason));
    if (done) {
      toast.push(`Đã phân công Groom cho ${horse.name}`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!horse}
      onClose={onClose}
      title={horse?.groomId ? `Đổi Groom cho ${horse?.name}` : `Phân công Groom cho ${horse?.name ?? ''}`}
      description={horse?.groomName ? `Đang phụ trách: ${horse.groomName}` : 'Ngựa chưa có Groom phụ trách'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={!groomId || action.pending}>
            {action.pending ? 'Đang lưu…' : 'Phân công'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Groom" required error={action.field === 'groomId' ? action.error : undefined}>
          <Select value={groomId} onChange={(event) => setGroomId(event.target.value)}>
            <option value="">— Chọn Groom —</option>
            {(grooms.data ?? [])
              .filter((groom) => groom.id !== horse?.groomId)
              .map((groom) => (
                <option key={groom.id} value={groom.id}>
                  {groom.name} · đang phụ trách {groom.horseCount} ngựa
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Ghi chú" hint="Việc của các buổi chưa diễn ra chuyển sang Groom mới; việc đã xong giữ tên người làm.">
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-16" />
        </Field>
        {action.error && action.field !== 'groomId' && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Hộp thoại bắt buộc lý do ===== */

export function ReasonDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = true,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  error?: string;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  /** Trả true khi thành công để đóng hộp thoại. */
  onSubmit: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const close = () => {
    setReason('');
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Quay lại
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={!reason.trim() || pending}
            onClick={async () => {
              setPending(true);
              const ok = await onSubmit(reason.trim());
              setPending(false);
              if (ok) close();
            }}
          >
            {pending ? 'Đang xử lý…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600">{message}</div>
        <Field label="Lý do" required>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} autoFocus />
        </Field>
        {error && <ErrorBox message={error} />}
      </div>
    </Modal>
  );
}
