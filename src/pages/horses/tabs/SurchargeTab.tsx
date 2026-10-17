// Tab Phụ phí của hồ sơ ngựa: các khoản phí riêng của con này (thay cho gói chăm sóc), cộng thêm vào phí nuôi chung.
// - Quản lý CLB: ghi khoản mới (từ hôm nay trở đi), kết thúc sớm khoản đang tính, xóa khoản chưa bắt đầu.
// - HLV khu hiện tại của ngựa: bấm "Đã áp dụng" một lần khi đã làm theo (khoản chưa kết thúc).
// - Chủ ngựa: chỉ xem. Groom và bác sĩ không thấy tab.
// Tiền tính theo ngày trong khoảng, vào chi phí chủ ngựa và báo cáo tài chính dù HLV đã xác nhận hay chưa.
import { useState } from 'react';
import { CheckCheck, CircleStop, Plus, Trash2 } from 'lucide-react';
import { applyHorseSurcharge, createHorseSurcharge, deleteHorseSurcharge, endHorseSurcharge, listHorseSurcharges, type HorseSurcharge } from '../../../api/billing';
import type { HorseDetail } from '../../../api/types';
import { MoneyInput } from '../../../components/MoneyInput';
import { Button, CharCount, ConfirmDialog, EmptyState, ErrorBox, Field, Modal, Pill, Skeleton, Textarea, cn, invalidClass, useToast } from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { useAction, useService } from '../../../hooks/useService';
import { clubDateKey, diffDateKeys } from '../../../lib/club-time';
import { now } from '../../../lib/clock';
import { formatDate, formatDateTime, formatMoney, moneyError, parseMoney } from '../../../lib/format';

const DESCRIPTION_MAX = 500;

type Phase = 'upcoming' | 'running' | 'ended';
const phaseOf = (row: Pick<HorseSurcharge, 'startDate' | 'endDate'>, today: string): Phase => (today < row.startDate ? 'upcoming' : today > row.endDate ? 'ended' : 'running');
const PHASE_PILL: Record<Phase, { label: string; tone: 'green' | 'amber' | 'gray' }> = {
  upcoming: { label: 'Chưa bắt đầu', tone: 'amber' },
  running: { label: 'Đang tính', tone: 'green' },
  ended: { label: 'Đã kết thúc', tone: 'gray' },
};
/** Số ngày tính tiền, cả hai đầu. */
const daysOf = (row: Pick<HorseSurcharge, 'startDate' | 'endDate'>) => diffDateKeys(row.startDate, row.endDate) + 1;

type Pending = { kind: 'end' | 'delete'; row: HorseSurcharge };

export default function SurchargeTab({ horse, canManage, canApply }: { horse: HorseDetail; canManage: boolean; canApply: boolean }) {
  const toast = useToast();
  const list = useService(() => listHorseSurcharges(horse.id), [horse.id]);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const apply = useAction();
  const change = useAction();
  const today = clubDateKey(now());
  // BE chỉ cho ghi phụ phí khi ngựa còn ở CLB (đang hoạt động hoặc đã giải nghệ), hồ sơ chưa xóa.
  const writable = canManage && !horse.isDeleted && (horse.lifecycleStatus === 'ACTIVE' || horse.lifecycleStatus === 'RETIRED');

  const rows = list.data ?? [];
  const running = rows.filter((row) => phaseOf(row, today) === 'running');
  const perDay = running.reduce((sum, row) => sum + row.dailyAmount, 0);
  const waiting = rows.filter((row) => !row.appliedAt && phaseOf(row, today) !== 'ended');

  const runApply = (row: HorseSurcharge) =>
    void apply.run(
      () => applyHorseSurcharge(row.id),
      () => {
        toast.push('Đã xác nhận áp dụng phụ phí', 'success');
        list.reload();
      },
    );

  return (
    <div className="grid items-start gap-5 pt-4 lg:grid-cols-12 [&>*]:min-w-0">
      <section className="space-y-3 lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Các khoản phụ phí</h2>
          {writable && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} /> Thêm phụ phí
            </Button>
          )}
        </div>
        {apply.error && <ErrorBox message={apply.error} />}
        {list.loading && !list.data ? (
          <Skeleton rows={3} />
        ) : list.error ? (
          <ErrorBox message={list.error} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Ngựa chưa có phụ phí riêng"
            hint={writable ? 'Ghi khoản chăm sóc riêng (vd thêm cỏ khô, thuốc bổ) để tính thêm vào chi phí của chủ ngựa.' : undefined}
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const phase = phaseOf(row, today);
              const pill = PHASE_PILL[phase];
              const applicable = canApply && !row.appliedAt && phase !== 'ended';
              return (
                <li
                  key={row.id}
                  className={cn(
                    'rounded-2xl bg-white p-4 ring-1',
                    phase === 'running' ? 'shadow-[0_14px_30px_-24px_rgba(4,120,87,0.55)] ring-emerald-200/80' : 'ring-gray-200/80',
                    phase === 'ended' && 'bg-gray-50/60',
                  )}
                >
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-60">
                      <p className={cn('whitespace-pre-line break-words text-sm font-medium', phase === 'ended' ? 'text-gray-600' : 'text-gray-900')}>{row.description}</p>
                      <p className="mt-1 font-mono text-xs text-gray-500">
                        {formatDate(row.startDate)} đến {formatDate(row.endDate)} · {daysOf(row)} ngày
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-base font-semibold tabular-nums text-gray-900">{formatMoney(row.dailyAmount)}</p>
                      <p className="text-xs text-gray-500">mỗi ngày, cả khoản {formatMoney(row.dailyAmount * daysOf(row))}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Pill tone={pill.tone}>{pill.label}</Pill>
                    {row.appliedAt ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-800">
                        <CheckCheck size={13} /> {row.appliedByName ?? 'HLV'} đã áp dụng lúc {formatDateTime(row.appliedAt)}
                      </span>
                    ) : phase === 'ended' ? (
                      <span className="text-xs text-gray-500">HLV chưa xác nhận áp dụng</span>
                    ) : (
                      <span className="text-xs font-medium text-amber-800">Chờ HLV khu áp dụng</span>
                    )}
                    <span className="ml-auto flex flex-wrap gap-1.5">
                      {applicable && (
                        <Button size="sm" disabled={apply.pending} onClick={() => runApply(row)}>
                          <CheckCheck size={14} /> Đã áp dụng
                        </Button>
                      )}
                      {canManage && phase === 'running' && row.endDate > today && (
                        <Button variant="inline" size="sm" onClick={() => setPending({ kind: 'end', row })}>
                          <CircleStop size={13} /> Kết thúc sớm
                        </Button>
                      )}
                      {canManage && phase === 'upcoming' && (
                        <Button variant="inlineDanger" size="sm" onClick={() => setPending({ kind: 'delete', row })}>
                          <Trash2 size={13} /> Xóa
                        </Button>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="space-y-3 lg:col-span-4">
        <section className="rounded-3xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-5 text-white shadow-[0_24px_48px_-28px_rgba(6,78,59,0.8)]">
          <p className="text-sm text-emerald-100">Phụ phí đang tính</p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums">{formatMoney(perDay)}</p>
          <p className="mt-1 text-sm text-emerald-100">{running.length ? `mỗi ngày, từ ${running.length} khoản` : 'Hôm nay không có khoản nào đang tính'}</p>
        </section>
        {waiting.length > 0 && (
          <p className="rounded-2xl bg-amber-50/80 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100 shadow-[0_18px_36px_-28px_rgba(180,83,9,0.5)]">
            {waiting.length} khoản chờ HLV khu xác nhận đã áp dụng.
          </p>
        )}
        <p className="px-1 text-xs leading-relaxed text-gray-500">
          Phụ phí cộng thêm vào phí nuôi chung, tính theo ngày trong khoảng đã ghi, vào chi phí của chủ ngựa và báo cáo tài chính. Kết thúc sớm thì tính tới hết hôm nay.
        </p>
      </aside>

      {creating && <SurchargeDialog horse={horse} today={today} onClose={() => setCreating(false)} onDone={() => list.reload()} />}
      <ConfirmDialog
        open={!!pending}
        title={pending?.kind === 'end' ? 'Kết thúc phụ phí sớm' : 'Xóa phụ phí'}
        message={
          pending
            ? pending.kind === 'end'
              ? `Khoản "${pending.row.description}" tính tới hết hôm nay ${formatDate(today)} thay vì ${formatDate(pending.row.endDate)}.`
              : `Khoản "${pending.row.description}" chưa bắt đầu, xóa thì không tính tiền.`
            : ''
        }
        confirmLabel={pending?.kind === 'end' ? 'Kết thúc sớm' : 'Xóa'}
        pending={change.pending}
        onClose={() => {
          change.clearError();
          setPending(null);
        }}
        onConfirm={() =>
          pending &&
          void change.run(
            () => (pending.kind === 'end' ? endHorseSurcharge(pending.row.id).then(() => undefined) : deleteHorseSurcharge(pending.row.id)),
            () => {
              toast.push(pending.kind === 'end' ? 'Đã kết thúc phụ phí' : 'Đã xóa phụ phí', 'success');
              setPending(null);
              list.reload();
            },
          )
        }
      >
        {change.error && <ErrorBox message={change.error} />}
      </ConfirmDialog>
    </div>
  );
}

function SurchargeDialog({ horse, today, onClose, onDone }: { horse: HorseDetail; today: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [touched, setTouched] = useState(false);
  const daily = parseMoney(amount);
  const clientErrors = {
    description: !description.trim() ? 'Nhập nội dung phụ phí' : description.trim().length > DESCRIPTION_MAX ? `Tối đa ${DESCRIPTION_MAX} ký tự` : undefined,
    dailyAmount: moneyError(amount, { label: 'Số tiền mỗi ngày' }) ?? (daily < 1 ? 'Số tiền mỗi ngày phải lớn hơn 0' : undefined),
    startDate: !startDate ? 'Chọn ngày bắt đầu' : startDate < today ? 'Ngày bắt đầu phải từ hôm nay trở đi' : undefined,
    endDate: !endDate ? 'Chọn ngày kết thúc' : endDate < startDate ? 'Ngày kết thúc không được trước ngày bắt đầu' : undefined,
  };
  const errors = Object.fromEntries(Object.entries(clientErrors).map(([key, value]) => [key, value ?? action.fieldErrors[key]])) as Record<keyof typeof clientErrors, string | undefined>;
  const show = (key: keyof typeof clientErrors) => (touched || action.fieldErrors[key] ? errors[key] : undefined);
  const days = startDate && endDate && endDate >= startDate ? diffDateKeys(startDate, endDate) + 1 : 0;
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (action.error) action.clearError();
  };

  const submit = () => {
    setTouched(true);
    if (Object.values(clientErrors).some(Boolean)) return;
    void action.run(
      () => createHorseSurcharge(horse.id, { description: description.trim(), dailyAmount: daily, startDate, endDate }),
      () => {
        toast.push(`Đã ghi phụ phí cho ${horse.name}. HLV khu và chủ ngựa đã nhận thông báo.`, 'success');
        onDone();
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Thêm phụ phí"
      description={`Khoản tính riêng cho ${horse.name}, cộng vào chi phí của chủ ngựa.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Ghi phụ phí'}
          </Button>
        </>
      }
      dirty={!!description || !!amount || !!endDate}
      onSave={submit}
    >
      <div className="space-y-4">
        {action.error && !Object.values(action.fieldErrors).some(Boolean) && <ErrorBox message={action.error} />}
        <Field label="Nội dung" required error={show('description')} hint="Vd: thêm 2kg cỏ khô mỗi ngày, thuốc bổ khớp." counter={<CharCount value={description} max={DESCRIPTION_MAX} />}>
          <Textarea rows={3} maxLength={DESCRIPTION_MAX + 50} value={description} onChange={(event) => edit(setDescription)(event.target.value)} className={cn(show('description') && invalidClass)} />
        </Field>
        <Field label="Tiền mỗi ngày" required error={show('dailyAmount')}>
          <MoneyInput value={amount} onChange={edit(setAmount)} suffix="đ/ngày" className={cn(show('dailyAmount') && invalidClass)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Từ ngày" required error={show('startDate')}>
            <DatePicker value={startDate} min={today} onChange={edit(setStartDate)} clearable={false} />
          </Field>
          <Field label="Đến ngày" required error={show('endDate')}>
            <DatePicker value={endDate} min={startDate || today} onChange={edit(setEndDate)} />
          </Field>
        </div>
        {days > 0 && daily > 0 && (
          <p className="rounded-xl bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-100">
            Tạm tính {days} ngày × {formatMoney(daily)} = <b className="font-mono tabular-nums">{formatMoney(days * daily)}</b>
          </p>
        )}
      </div>
    </Modal>
  );
}
