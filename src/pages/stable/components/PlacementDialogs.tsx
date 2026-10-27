// Hộp thoại xếp chỗ dùng chung cho sơ đồ chuồng và hồ sơ ngựa (F1.6, F1.7).
// CM xếp/đổi khu; HT của khu xếp ô hoặc chuyển ô (chỉ chọn ô), giao/đổi Groom (riêng), gỡ khỏi ô.
import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Info, UserRound } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import { assignBarn, previewBarn } from '../../../api/horses';
import { assignGroom, listBarns, listGroomWorkload, listStalls, moveStall, removeFromStall } from '../../../api/stable';
import { ChoiceList } from '../../../components/ui/ChoiceList';
import type { HealthStatus, PlacementStatus } from '../../../api/types';
import { barnBlocker } from './barn';
import { useCurrentGroom } from './useCurrentGroom';
import { Button, CancelButton, CharCount, ErrorBox, Field, Modal, Notice, Skeleton, Textarea, cn, invalidClass, useToast } from '../../../components/ui';

const REASON_MAX = 500;

/** Dòng lỗi dưới một nhóm lựa chọn (không phải ô nhập). */
function ChoiceError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" data-invalid="true" className="text-xs font-medium text-red-600">
      {message}
    </p>
  );
}

export interface PlacementHorse {
  id: string;
  name: string;
  barnId?: string;
  barnName?: string;
  stallId?: string;
  stallCode?: string;
  groomId?: string;
  groomName?: string;
  placementStatus?: PlacementStatus;
  healthStatus?: HealthStatus;
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
  const [barnId, setBarnId] = useState('');
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const barns = useService(() => (horse ? listBarns() : Promise.resolve([])), [horse?.id]);
  const preview = useService(() => (horse && barnId ? previewBarn(horse.id, barnId) : Promise.resolve(undefined)), [horse?.id, barnId]);

  useEffect(() => {
    setBarnId('');
    setReason('');
    setReasonTouched(false);
    setAttempted(false);
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horse?.id]);

  // Xếp khu lần đầu không cần lý do; đổi khu thì bắt buộc (BA chốt 30/09).
  const isChange = !!horse?.barnId;
  const data = preview.data;
  const chosen = barns.data?.find((item) => item.id === barnId);
  const blocked = !data || !data.allowed || (!!chosen && !!barnBlocker(chosen));
  const barnError = attempted && !barnId ? 'Chọn khu' : undefined;
  const reasonError = isChange && !reason.trim() && (reasonTouched || attempted) ? 'Nhập lý do đổi khu' : undefined;

  const submit = async () => {
    if (!horse || action.pending) return;
    setAttempted(true);
    if (!barnId || (isChange && !reason.trim()) || blocked) return;
    const done = await action.run(() => assignBarn(horse.id, barnId, isChange ? reason.trim() : undefined));
    if (done) {
      toast.push(`${horse.name} đã được xếp vào ${data?.toBarnName ?? 'khu mới'}`, 'success');
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
      dirty={barnId !== '' || reason.trim() !== ''}
      busy={action.pending}
      description={isChange ? `Đang ở ${horse?.barnName}${horse?.stallCode ? `, ô ${horse.stallCode}` : ''}` : 'Ngựa đang chờ xếp khu'}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button onClick={submit} disabled={action.pending || (!!barnId && blocked)}>
            {action.pending ? 'Đang xếp…' : isChange ? 'Xác nhận đổi khu' : 'Xếp vào khu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {barns.loading ? (
          <Skeleton rows={2} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {(barns.data ?? []).map((barn) => {
              const current = barn.id === horse?.barnId;
              const blocker = barnBlocker(barn);
              const disabled = !!blocker || current;
              return (
                <button
                  key={barn.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setBarnId(barn.id)}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left transition',
                    barnId === barn.id ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20' : 'border-gray-200 bg-white hover:border-gray-400',
                    disabled && 'cursor-not-allowed border-dashed bg-gray-50/60 opacity-70 hover:border-gray-200',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900">{barn.name}</span>
                    <span className={cn('text-xs tabular-nums', barn.availableStallCount > 0 ? 'text-gray-600' : 'font-medium text-amber-700')}>
                      Còn nhận {barn.availableStallCount}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">HLV: {barn.headTrainerFullName ?? 'chưa có'}</p>
                  {current && <p className="mt-1 text-xs font-medium text-gray-500">Khu hiện tại</p>}
                  {!current && blocker && <p className="mt-1 text-xs text-gray-500">{blocker}</p>}
                </button>
              );
            })}
          </div>
        )}
        <ChoiceError message={barnError} />

        {barnId && preview.loading && <Skeleton rows={1} />}
        {preview.error && <ErrorBox message={preview.error} />}
        {data && (
          <div className="space-y-3">
            {!data.allowed && data.blockedReason && (
              <Notice tone="danger" icon={<AlertTriangle size={16} />}>
                {data.blockedReason}
              </Notice>
            )}
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700 ring-1 ring-gray-200/70">
              <p className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
                {data.fromBarnName ?? 'Chờ xếp khu'} <ArrowRight size={14} className="text-gray-400" /> {data.toBarnName}
              </p>
              <ul className="space-y-1.5">
                <li>
                  Ngựa vào danh sách "Chờ xếp ô" của {data.toBarnName}
                  {data.newHeadTrainerName ? `. HLV trưởng ${data.newHeadTrainerName} xếp ô và nhận thông báo.` : '.'}
                </li>
                {data.stallReleased && <li>Ô {data.stallReleased} được trả về trống.</li>}
                {isChange && (
                  <li className={data.classesWithdrawn ? 'font-medium text-amber-700' : ''}>
                    {data.classesWithdrawn
                      ? `Rút khỏi ${data.classesWithdrawn} lớp không do HLV khu mới phụ trách`
                      : 'Không phải rút khỏi lớp nào (khu mới cùng HLV hoặc ngựa chưa học lớp)'}
                  </li>
                )}
                <li>{data.groomKept ? `Giữ nguyên Groom ${data.groomKept}` : 'Chưa có Groom, HLV trưởng phân công khi xếp ô'}</li>
              </ul>
            </div>
          </div>
        )}

        {isChange && (
          <Field label="Lý do đổi khu" required name="reason" error={reasonError} onBlur={() => setReasonTouched(true)} counter={<CharCount value={reason} max={REASON_MAX} />}>
            <Textarea
              value={reason}
              maxLength={REASON_MAX}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ví dụ: cân đối số ngựa giữa hai khu"
              className={cn(reasonError && invalidClass)}
            />
          </Field>
        )}
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== HT xếp ô hoặc chuyển ô (chỉ chọn ô; Groom phân công riêng) ===== */

export function AssignStallDialog({
  horse,
  onClose,
  onDone,
  presetStallId,
  presetStallCode,
  onAssignGroom,
}: {
  horse: PlacementHorse | null;
  onClose: () => void;
  onDone: () => void;
  /** Có ô chọn sẵn (bấm ô trống trên sơ đồ) thì chỉ hiện xác nhận gọn, không hiện lưới ô. */
  presetStallId?: string;
  presetStallCode?: string;
  /** Có thì sau khi xếp ô cho ngựa chưa có Groom, thông báo có nút "Giao Groom". */
  onAssignGroom?: (horse: PlacementHorse) => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [stallId, setStallId] = useState('');
  const [attempted, setAttempted] = useState(false);
  const preset = !!presetStallId;
  const stalls = useService(
    () => (horse?.barnId && !preset ? listStalls({ barnId: horse.barnId, status: 'AVAILABLE' }) : Promise.resolve([])),
    [horse?.id, horse?.barnId, preset],
  );
  const moving = !!horse?.stallId;
  const current = useCurrentGroom(horse);

  useEffect(() => {
    setStallId(presetStallId ?? '');
    setAttempted(false);
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horse?.id, presetStallId]);

  const submit = async () => {
    if (!horse || action.pending) return;
    setAttempted(true);
    if (!stallId) return;
    const done = await action.run(async () => {
      await moveStall(horse.id, stallId);
      return true;
    });
    if (done) {
      const code = (preset ? presetStallCode : stalls.data?.find((item) => item.id === stallId)?.code) ?? '';
      const needsGroom = !moving && current.ready && !current.groom;
      const placed: PlacementHorse = { ...horse, stallId, stallCode: code, placementStatus: 'PLACED' };
      toast.push(
        needsGroom ? `${horse.name} đã vào ô ${code}, chưa có Groom` : `${horse.name} đã vào ô ${code}`,
        'success',
        needsGroom && onAssignGroom ? { label: 'Giao Groom', onClick: () => onAssignGroom(placed) } : undefined,
      );
      onDone();
      onClose();
    }
  };

  const quarantine = horse?.healthStatus === 'QUARANTINED' && (
    <Notice tone="warning" icon={<Info size={16} />}>
      Ngựa đang cách ly. Có thể chọn ô cách xa các ngựa khác để tách đàn.
    </Notice>
  );
  const groomNote = (
    <p className="flex items-start gap-2 rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600">
      <UserRound size={15} className="mt-0.5 shrink-0 text-gray-400" />
      {!current.ready ? (
        <span className="text-gray-400">Đang kiểm tra Groom phụ trách…</span>
      ) : moving ? (
        <span>Chuyển ô không đổi Groom{current.groom ? ` (${current.groom.fullName})` : ''}, ô cũ được trả về trống.</span>
      ) : current.groom ? (
        <span>
          Groom phụ trách giữ nguyên: <span className="font-medium text-gray-900">{current.groom.fullName}</span>.
        </span>
      ) : (
        <span>Ngựa chưa có Groom, giao Groom sau khi xếp ô.</span>
      )}
    </p>
  );

  if (preset) {
    return (
      <Modal
        open={!!horse}
        onClose={onClose}
        width="max-w-md"
        title={`${moving ? 'Chuyển' : 'Xếp'} ${horse?.name ?? ''} vào ô ${presetStallCode ?? ''}`}
        busy={action.pending}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Quay lại
            </Button>
            <Button onClick={submit} disabled={action.pending}>
              {action.pending ? 'Đang lưu…' : `${moving ? 'Chuyển' : 'Xếp'} vào ô ${presetStallCode ?? ''}`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 shadow-card">
            <span className="flex h-10 min-w-12 items-center justify-center rounded-lg border border-dashed border-emerald-400 bg-white px-2 font-mono text-sm font-semibold text-emerald-800">
              {presetStallCode}
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-semibold text-gray-900">
                {presetStallCode} · {horse?.barnName}
              </span>
              <span className="block text-xs text-gray-500">Ô trống{moving && horse?.stallCode ? `, ngựa đang ở ô ${horse.stallCode}` : ''}</span>
            </span>
          </div>
          {quarantine}
          {groomNote}
          {action.error && <ErrorBox message={action.error} />}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={!!horse}
      onClose={onClose}
      width="max-w-2xl"
      title={moving ? `Chuyển ô cho ${horse?.name ?? ''}` : `Xếp ô cho ${horse?.name ?? ''}`}
      dirty={stallId !== ''}
      busy={action.pending}
      description={`${horse?.barnName ?? ''}${moving ? ` · đang ở ô ${horse?.stallCode}` : ' · đang chờ xếp ô'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || (!stalls.loading && (stalls.data ?? []).length === 0)}>
            {action.pending ? 'Đang lưu…' : moving ? 'Chuyển sang ô này' : 'Xếp vào ô'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {quarantine}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-600">
            Chọn ô trống<span className="ml-0.5 text-red-500">*</span>
          </p>
          {stalls.loading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="skeleton h-12 rounded-xl" />
              ))}
            </div>
          ) : (stalls.data ?? []).length === 0 ? (
            <Notice tone="warning">Khu không còn ô trống. Quản lý câu lạc bộ cần thêm ô, kết thúc bảo trì một ô, hoặc đổi khu cho ngựa.</Notice>
          ) : (
            <div role="radiogroup" aria-label="Ô trống" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(stalls.data ?? []).map((stall) => (
                <button
                  key={stall.id}
                  type="button"
                  role="radio"
                  aria-checked={stallId === stall.id}
                  onClick={() => setStallId(stall.id)}
                  className={cn(
                    'rounded-xl border px-3 py-3 font-mono text-sm font-semibold transition',
                    stallId === stall.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-raised ring-2 ring-emerald-500/20'
                      : 'border-dashed border-gray-300 bg-white text-gray-700 hover:border-emerald-400 hover:bg-emerald-50/30',
                  )}
                >
                  {stall.code}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2">
            <ChoiceError message={attempted && !stallId ? 'Chọn một ô trống' : undefined} />
          </div>
        </div>
        {groomNote}
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== HT giao / đổi Groom ===== */

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
  const [attempted, setAttempted] = useState(false);
  const grooms = useService(() => (horse ? listGroomWorkload() : Promise.resolve([])), [horse?.id]);
  // Sơ đồ chuồng không mang Groom theo ngựa: tra Groom đang phụ trách trước khi hiện tiêu đề, nút.
  const current = useCurrentGroom(horse);
  const currentId = current.groom?.id;
  const changing = !!current.groom;

  useEffect(() => {
    setGroomId('');
    setAttempted(false);
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horse?.id]);

  const groomError = !groomId ? (changing ? 'Chọn Groom mới' : 'Chọn Groom') : undefined;

  const submit = async () => {
    if (!horse || action.pending || !current.ready) return;
    setAttempted(true);
    if (groomError) return;
    const done = await action.run(() => assignGroom(horse.id, groomId));
    if (done) {
      const name = grooms.data?.find((groom) => groom.groomId === groomId)?.fullName ?? 'Groom mới';
      toast.push(changing ? `Đã đổi Groom của ${horse.name} sang ${name}` : `Đã giao ${name} phụ trách ${horse.name}`, 'success');
      onDone();
      onClose();
    }
  };

  // Ít việc nhất lên đầu (Groom hiện tại luôn đứng đầu); thanh khối lượng so với Groom nhiều ngựa nhất.
  const list = [...(grooms.data ?? [])].sort((a, b) => a.activeHorseCount - b.activeHorseCount || a.fullName.localeCompare(b.fullName, 'vi'));
  const most = Math.max(1, ...list.map((groom) => groom.activeHorseCount));
  const loading = !current.ready || (grooms.loading && !grooms.data);

  return (
    <Modal
      open={!!horse}
      onClose={onClose}
      width="max-w-2xl"
      title={!current.ready ? <span className="skeleton inline-block h-5 w-56 rounded-md align-middle" /> : changing ? `Đổi Groom cho ${horse?.name}` : `Giao Groom cho ${horse?.name ?? ''}`}
      dirty={groomId !== ''}
      busy={action.pending}
      description={!current.ready ? <span className="skeleton mt-1 inline-block h-3.5 w-40 rounded" /> : current.groom ? `Đang phụ trách: ${current.groom.fullName}` : 'Ngựa chưa có Groom phụ trách'}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          {current.ready && (
            <Button onClick={submit} disabled={action.pending}>
              {action.pending ? 'Đang lưu…' : changing ? 'Đổi Groom' : 'Giao Groom'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {loading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <ChoiceList
            label="Groom"
            value={groomId}
            onChange={setGroomId}
            empty="Chưa có Groom nào đang hoạt động."
            choices={list.map((groom) => ({
              value: groom.groomId,
              title: groom.fullName,
              meta: `Đang phụ trách ${groom.activeHorseCount} ngựa`,
              badge: groom.groomId === currentId ? 'Đang phụ trách' : undefined,
              locked: groom.groomId === currentId,
              load: groom.activeHorseCount / most,
            }))}
          />
        )}
        <ChoiceError message={attempted ? groomError : undefined} />
        <p className="text-xs text-gray-500">Groom được phân công theo con ngựa, không theo ô: chuyển ô vẫn giữ Groom.</p>
        {changing && (
          <Notice tone="info">Groom cũ và Groom mới đều nhận thông báo. Groom cũ vẫn xem được hồ sơ nhưng không thao tác được nữa.</Notice>
        )}
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== HT gỡ ngựa khỏi ô ===== */

export function RemoveStallDialog({
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
  useEffect(() => {
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horse?.id]);
  return (
    <Modal
      open={!!horse}
      onClose={onClose}
      title={`Gỡ ${horse?.name ?? ''} khỏi ô ${horse?.stallCode ?? ''}`}
      busy={action.pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button
            variant="danger"
            disabled={action.pending}
            onClick={async () => {
              if (!horse) return;
              const done = await action.run(() => removeFromStall(horse.id));
              if (done) {
                toast.push(`Đã gỡ ${horse.name} khỏi ô`, 'success');
                onDone();
                onClose();
              }
            }}
          >
            {action.pending ? 'Đang gỡ…' : 'Gỡ khỏi ô'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-gray-600">
        <p>Ngựa về danh sách "Chờ xếp ô" của khu, ô trở về trống. Groom phụ trách được giữ nguyên.</p>
        {action.error && <ErrorBox message={action.error} />}
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
  const [touched, setTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const close = () => {
    setReason('');
    setTouched(false);
    setAttempted(false);
    onClose();
  };
  const reasonError = !reason.trim() && (touched || attempted) ? 'Nhập lý do' : undefined;
  const submit = async () => {
    if (pending) return;
    setAttempted(true);
    if (!reason.trim()) return;
    setPending(true);
    const ok = await onSubmit(reason.trim());
    setPending(false);
    if (ok) close();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      dirty={reason.trim() !== ''}
      busy={pending}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button variant={danger ? 'danger' : 'primary'} disabled={pending} onClick={submit}>
            {pending ? 'Đang xử lý…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600">{message}</div>
        <Field label="Lý do" required name="reason" error={reasonError} onBlur={() => setTouched(true)} counter={<CharCount value={reason} max={REASON_MAX} />}>
          <Textarea value={reason} maxLength={REASON_MAX} onChange={(event) => setReason(event.target.value)} className={cn(reasonError && invalidClass)} autoFocus />
        </Field>
        {error && <ErrorBox message={error} />}
      </div>
    </Modal>
  );
}
