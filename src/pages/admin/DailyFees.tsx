// Phí nuôi theo ngày (chỉ Quản lý CLB): một mức chung cho mọi ngựa, đồng mỗi con mỗi ngày.
// Đặt mức áp dụng từ hôm nay trở đi. Mức sắp áp dụng và mức đang áp dụng sửa được số tiền kèm lý do, mức đã thay thì chỉ xem.
// Báo cáo tài chính và chi phí chủ ngựa lấy mức đang áp dụng của từng ngày.
import { useState } from 'react';
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { createDailyFee, deleteDailyFee, listDailyFees, updateDailyFee, type DailyFee } from '../../api/billing';
import { can } from '../../auth/permissions';
import { useCrumbs } from '../../components/Breadcrumb';
import { MoneyInput } from '../../components/MoneyInput';
import { Button, ConfirmDialog, ErrorBox, Field, Input, Modal, NotFound, PageHeader, Pill, Skeleton, cn, useToast } from '../../components/ui';
import { DatePicker } from '../../components/ui/DatePicker';
import { useAction, useService } from '../../hooks/useService';
import { clubDateKey } from '../../lib/club-time';
import { now } from '../../lib/clock';
import { formatDate, formatMoney, formatMoneyInput, moneyError, parseMoney } from '../../lib/format';
import { useStore } from '../../store/store';

export default function DailyFees() {
  const user = useStore((state) => state.currentUser);
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<DailyFee | null>(null);
  const [editing, setEditing] = useState<DailyFee | null>(null);
  const remove = useAction();
  useCrumbs([{ label: 'Phí nuôi' }]);
  const allowed = can(user, 'fee.manage');
  const fees = useService(() => (allowed ? listDailyFees() : Promise.resolve([])), [allowed]);

  if (!allowed) return <NotFound message="Trang này dành cho Quản lý CLB." />;

  const today = clubDateKey(now());
  const list = fees.data ?? [];
  // BE trả ngày áp dụng mới nhất trước.
  const current = list.find((fee) => fee.effectiveFrom <= today);
  const upcoming = list.filter((fee) => fee.effectiveFrom > today).reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phí nuôi"
        description="Mức phí chung cho mọi ngựa ở CLB, tính theo ngày cho chủ ngựa."
        actions={
          <Button onClick={() => setCreating(true)}>
            <CalendarPlus size={16} /> Đặt mức mới
          </Button>
        }
      />

      {fees.loading && !fees.data ? (
        <Skeleton rows={4} />
      ) : fees.error ? (
        <ErrorBox message={fees.error} />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-12 [&>*]:min-w-0">
          <div className="space-y-4 lg:col-span-5">
            <section className="rounded-3xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-6 text-white shadow-[0_24px_48px_-28px_rgba(6,78,59,0.8)]">
              <p className="text-sm text-emerald-100">Đang áp dụng</p>
              {current ? (
                <>
                  <p className="mt-2 font-mono text-4xl font-bold tabular-nums">{formatMoney(current.dailyFee)}</p>
                  <p className="mt-1 text-sm text-emerald-100">mỗi con mỗi ngày, từ {formatDate(current.effectiveFrom)}</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-semibold">Chưa có</p>
                  <p className="mt-1 text-sm text-emerald-100">Báo cáo chi phí chưa tính phí nuôi cho tới khi có mức áp dụng.</p>
                </>
              )}
            </section>
            {upcoming.length > 0 && (
              <section className="rounded-2xl bg-amber-50/80 p-4 ring-1 ring-amber-100 shadow-[0_18px_36px_-28px_rgba(180,83,9,0.5)]">
                <p className="text-sm font-semibold text-amber-900">Sắp áp dụng</p>
                <ul className="mt-2 space-y-1.5">
                  {upcoming.map((fee) => (
                    <li key={fee.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-amber-900">Từ {formatDate(fee.effectiveFrom)}</span>
                      <span className="font-mono font-semibold tabular-nums text-amber-950">{formatMoney(fee.dailyFee)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="px-1 text-xs leading-relaxed text-gray-500">
              Mức đang áp dụng nhập sai thì sửa số tiền kèm lý do, báo cáo phí tính lại cho mọi ngày của mức đó. Muốn đổi giá từ một ngày thì đặt mức mới. Ngày chuyển chủ tính cho chủ mới. Ngựa đã chuyển nhượng ra ngoài hoặc đã mất không tính phí.
            </p>
          </div>

          <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-200/80 lg:col-span-7">
            <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Các mức đã đặt</h2>
            {list.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500">Chưa đặt mức nào.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {list.map((fee) => {
                  const future = fee.effectiveFrom > today;
                  const active = fee.id === current?.id;
                  return (
                    <li key={fee.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3', !future && !active && 'text-gray-500')}>
                      <span className="w-28 shrink-0 text-sm tabular-nums">{formatDate(fee.effectiveFrom)}</span>
                      <span className={cn('min-w-0 flex-1 font-mono text-sm font-semibold tabular-nums', active ? 'text-emerald-800' : future ? 'text-gray-900' : 'text-gray-500')}>
                        {formatMoney(fee.dailyFee)}
                      </span>
                      {active ? <Pill tone="green">Đang áp dụng</Pill> : future ? <Pill tone="amber">Sắp áp dụng</Pill> : <Pill tone="gray">Đã thay</Pill>}
                      {(future || active) && (
                        <Button variant="ghost" size="icon" title="Sửa số tiền" onClick={() => setEditing(fee)}>
                          <Pencil size={15} />
                        </Button>
                      )}
                      {future && (
                        <Button variant="ghost" size="icon" title="Xóa mức này" onClick={() => setRemoving(fee)}>
                          <Trash2 size={15} />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {creating && <FeeDialog today={today} onClose={() => setCreating(false)} onDone={() => fees.reload()} />}
      {editing && <EditFeeDialog fee={editing} active={editing.id === current?.id} onClose={() => setEditing(null)} onDone={() => fees.reload()} />}
      <ConfirmDialog
        open={!!removing}
        title={removing ? `Xóa mức từ ${formatDate(removing.effectiveFrom)}` : 'Xóa mức phí'}
        message={removing ? `Mức ${formatMoney(removing.dailyFee)} sẽ không được áp dụng.` : ''}
        confirmLabel="Xóa"
        pending={remove.pending}
        onClose={() => {
          remove.clearError();
          setRemoving(null);
        }}
        onConfirm={() =>
          removing &&
          void remove.run(
            () => deleteDailyFee(removing.id),
            () => {
              toast.push('Đã xóa mức phí', 'success');
              setRemoving(null);
              fees.reload();
            },
          )
        }
      >
        {remove.error && <ErrorBox message={remove.error} />}
      </ConfirmDialog>
    </div>
  );
}

function FeeDialog({ today, onClose, onDone }: { today: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState(false);
  const clientErrors = {
    effectiveFrom: !date ? 'Chọn ngày áp dụng' : date < today ? 'Ngày áp dụng phải từ hôm nay trở đi' : undefined,
    dailyFee: moneyError(amount, { label: 'Số tiền' }),
  };
  const errors = {
    effectiveFrom: clientErrors.effectiveFrom ?? action.fieldErrors.effectiveFrom,
    dailyFee: clientErrors.dailyFee ?? action.fieldErrors.dailyFee,
  };
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (action.error) action.clearError();
  };

  const submit = () => {
    setTouched(true);
    if (Object.values(clientErrors).some(Boolean)) return;
    void action.run(
      () => createDailyFee({ effectiveFrom: date, dailyFee: parseMoney(amount) }),
      (fee) => {
        toast.push(`Đã đặt ${formatMoney(fee.dailyFee)} từ ${formatDate(fee.effectiveFrom)}`, 'success');
        onDone();
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Đặt mức phí mới"
      description="Áp dụng cho mọi ngựa từ ngày đã chọn."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
      dirty={amount !== '' || date !== today}
      onSave={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Áp dụng từ" required error={touched ? errors.effectiveFrom : undefined}>
          <DatePicker value={date} min={today} onChange={edit(setDate)} clearable={false} />
        </Field>
        <Field label="Số tiền" required error={touched ? errors.dailyFee : undefined}>
          <MoneyInput value={amount} onChange={edit(setAmount)} suffix="đ/con/ngày" autoFocus placeholder="Ví dụ: 250.000" />
        </Field>
      </div>
      {action.error && !Object.keys(action.fieldErrors).length && (
        <div className="mt-4">
          <ErrorBox message={action.error} />
        </div>
      )}
    </Modal>
  );
}

function EditFeeDialog({ fee, active, onClose, onDone }: { fee: DailyFee; active: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const initial = formatMoneyInput(String(fee.dailyFee));
  const [amount, setAmount] = useState(initial);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const clientErrors = {
    dailyFee: moneyError(amount, { label: 'Số tiền' }),
    reason: !reason.trim() ? 'Nhập lý do sửa' : undefined,
  };
  const errors = {
    dailyFee: clientErrors.dailyFee ?? action.fieldErrors.dailyFee,
    reason: clientErrors.reason ?? action.fieldErrors.reason,
  };
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (action.error) action.clearError();
  };

  const submit = () => {
    setTouched(true);
    if (Object.values(clientErrors).some(Boolean)) return;
    void action.run(
      () => updateDailyFee(fee.id, { dailyFee: parseMoney(amount), reason: reason.trim() }),
      (saved) => {
        toast.push(`Đã sửa mức từ ${formatDate(saved.effectiveFrom)} thành ${formatMoney(saved.dailyFee)}`, 'success');
        onDone();
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Sửa mức phí từ ${formatDate(fee.effectiveFrom)}`}
      description={active ? 'Mức đang áp dụng. Báo cáo phí tính lại theo số mới cho mọi ngày từ ngày áp dụng, chủ ngựa không nhận thông báo.' : 'Mức sắp áp dụng. Ngày áp dụng giữ nguyên.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
      dirty={amount !== initial || reason.trim() !== ''}
      onSave={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Áp dụng từ">
          <p className="flex h-10 items-center rounded-xl bg-gray-50 px-3 text-sm tabular-nums text-gray-600 ring-1 ring-gray-200">{formatDate(fee.effectiveFrom)}</p>
        </Field>
        <Field label="Số tiền" required error={touched ? errors.dailyFee : undefined}>
          <MoneyInput value={amount} onChange={edit(setAmount)} suffix="đ/con/ngày" autoFocus />
        </Field>
        <Field label="Lý do sửa" required error={touched ? errors.reason : undefined} className="sm:col-span-2">
          <Input value={reason} maxLength={500} onChange={(event) => edit(setReason)(event.target.value)} placeholder="Ví dụ: Nhập nhầm số tiền" />
        </Field>
      </div>
      {action.error && !Object.keys(action.fieldErrors).length && (
        <div className="mt-4">
          <ErrorBox message={action.error} />
        </div>
      )}
    </Modal>
  );
}
