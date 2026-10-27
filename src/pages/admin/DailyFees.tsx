import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, CalendarPlus, Coins, Info, Pencil, ShieldCheck, Trash2, TrendingUp, Users } from 'lucide-react';
import { createDailyFee, deleteDailyFee, listDailyFees, updateDailyFee, type DailyFee } from '../../api/billing';
import { countHorses } from '../../api/horses';
import { can } from '../../auth/permissions';
import { useCrumbs } from '../../components/Breadcrumb';
import { MoneyInput } from '../../components/MoneyInput';
import { Button, CancelButton, CharCount, ConfirmDialog, ErrorBox, Field, Input, Modal, NotFound, PageHeader, Pill, Skeleton, cn, invalidClass, useToast } from '../../components/ui';
import { useFormErrors } from '../../hooks/useFormErrors';
import { DatePicker } from '../../components/ui/DatePicker';
import { useAction, useService } from '../../hooks/useService';
import { clubDateKey } from '../../lib/club-time';
import { now } from '../../lib/clock';
import { daysBetween, formatDate, formatMoney, formatMoneyInput, moneyError, parseMoney } from '../../lib/format';
import { links } from '../../lib/links';
import { useStore } from '../../store/store';

const REASON_MAX = 500;

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
  const horses = useService(() => (allowed ? countHorses() : Promise.resolve(0)), [allowed]);

  if (!allowed) return <NotFound message="Trang này dành cho Quản lý CLB." />;

  const today = clubDateKey(now());
  const list = fees.data ?? [];
  const horseCount = horses.data ?? 0;
  // BE trả ngày áp dụng mới nhất trước.
  const current = list.find((fee) => fee.effectiveFrom <= today);
  const upcoming = list.filter((fee) => fee.effectiveFrom > today).reverse();

  const dailyProjected = current ? current.dailyFee * horseCount : 0;
  const monthlyProjected = dailyProjected * 30;
  const daysActive = current ? daysBetween(current.effectiveFrom, today) : 0;

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
        <Skeleton rows={6} />
      ) : fees.error ? (
        <ErrorBox message={fees.error} />
      ) : (
        <div className="space-y-6">
          {/* Bento KPI Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Mức phí đang áp dụng */}
            <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-grass-tint ring-1 ring-emerald-100">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Coins size={20} />
                </span>
                {current ? <Pill tone="green">Đang áp dụng</Pill> : <Pill tone="gray">Chưa đặt</Pill>}
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500">Mức phí hiện tại</p>
                <p className="mt-1 tabular-nums text-2xl font-bold  text-emerald-950 sm:text-3xl">
                  {current ? formatMoney(current.dailyFee) : '0 đ'}
                </p>
                <p className="mt-1.5 text-xs text-gray-500">
                  {current ? `từ ${formatDate(current.effectiveFrom)} (${daysActive === 0 ? 'hôm nay' : `${daysActive} ngày`})` : 'Chưa có mức áp dụng'}
                </p>
              </div>
            </div>

            {/* Card 2: Đàn ngựa tính phí hôm nay */}
            <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <Users size={20} />
                </span>
                <Link to={links.horses} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                  Xem đàn <ArrowRight size={13} />
                </Link>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500">Ngựa tính phí hôm nay</p>
                <p className="mt-1 tabular-nums text-2xl font-bold  text-gray-900 sm:text-3xl">
                  {horseCount} con
                </p>
                <p className="mt-1.5 text-xs text-gray-500">Ngựa đang hoạt động tại CLB</p>
              </div>
            </div>

            {/* Card 3: Dự phóng doanh thu theo ngày */}
            <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <TrendingUp size={20} />
                </span>
                <span className="text-[11px] font-medium text-gray-400">Theo ngày</span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500">Dự phóng doanh thu / ngày</p>
                <p className="mt-1 tabular-nums text-2xl font-bold  text-gray-900 sm:text-3xl">
                  {formatMoney(dailyProjected)}
                </p>
                <p className="mt-1.5 text-xs text-gray-500">
                  {horseCount} con × {current ? formatMoney(current.dailyFee) : '0 đ'}
                </p>
              </div>
            </div>

            {/* Card 4: Dự phóng doanh thu theo tháng */}
            <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Calendar size={20} />
                </span>
                <span className="text-[11px] font-medium text-gray-400">Ước tính 30 ngày</span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500">Dự phóng doanh thu / tháng</p>
                <p className="mt-1 tabular-nums text-2xl font-bold  text-gray-900 sm:text-3xl">
                  {formatMoney(monthlyProjected)}
                </p>
                <p className="mt-1.5 text-xs text-gray-500">Quy mô đàn hiện tại</p>
              </div>
            </div>
          </div>

          {/* Sắp áp dụng thông báo nếu có */}
          {upcoming.length > 0 && (
            <div className="flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
              <Info size={19} className="mt-0.5 shrink-0 text-amber-700" />
              <div className="min-w-0 flex-1 text-sm text-amber-900">
                <p className="font-semibold">Có mức phí sắp được áp dụng trong thời gian tới</p>
                <ul className="mt-1.5 space-y-1 text-xs text-amber-800">
                  {upcoming.map((fee) => (
                    <li key={fee.id} className="flex flex-wrap items-center gap-2">
                      <span>• Từ ngày <strong>{formatDate(fee.effectiveFrom)}</strong>:</span>
                      <span className="tabular-nums font-semibold text-amber-950">{formatMoney(fee.dailyFee)}</span>
                      <span>/ con / ngày</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Asymmetric Content Area */}
          <div className="grid items-start gap-6 lg:grid-cols-12 [&>*]:min-w-0">
            {/* Cột trái: Lịch sử & Lộ trình điều chỉnh (8 cols) */}
            <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-200/80 lg:col-span-8">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Lịch sử & Lộ trình điều chỉnh mức phí</h2>
                  <p className="mt-0.5 text-xs text-gray-500">Ghi nhận mọi mức phí đã đặt và trạng thái hiệu lực</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {list.length} mức
                </span>
              </div>

              {list.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-gray-500">Chưa có mức phí nào được thiết lập.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {list.map((fee) => {
                    const future = fee.effectiveFrom > today;
                    const active = fee.id === current?.id;
                    return (
                      <div
                        key={fee.id}
                        className={cn(
                          'flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 transition-colors',
                          active && 'bg-emerald-50/30',
                          !future && !active && 'text-gray-500',
                        )}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium tabular-nums text-gray-900">
                              Từ {formatDate(fee.effectiveFrom)}
                            </span>
                            {active ? (
                              <Pill tone="green">Đang áp dụng</Pill>
                            ) : future ? (
                              <Pill tone="amber">Sắp áp dụng</Pill>
                            ) : (
                              <Pill tone="gray">Đã thay</Pill>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            Thiết lập lúc: <span className="tabular-nums text-gray-700">{formatDate(fee.createdAt)}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <span
                            className={cn(
                              'tabular-nums text-base font-bold ',
                              active ? 'text-emerald-800' : future ? 'text-gray-900' : 'text-gray-400',
                            )}
                          >
                            {formatMoney(fee.dailyFee)}
                            <span className="text-xs font-normal text-gray-400"> / con / ngày</span>
                          </span>

                          <div className="flex items-center gap-1">
                            {(future || active) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Sửa số tiền"
                                onClick={() => setEditing(fee)}
                              >
                                <Pencil size={15} />
                              </Button>
                            )}
                            {future && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Xóa mức này"
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setRemoving(fee)}
                              >
                                <Trash2 size={15} />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Cột phải: Quy tắc tính phí & Điều hướng tài chính (4 cols) */}
            <div className="space-y-5 lg:col-span-4">
              <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80">
                <div className="flex items-center gap-2.5 text-emerald-800">
                  <ShieldCheck size={18} className="shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-900">Quy tắc tính phí CLB</h3>
                </div>
                <ul className="mt-3.5 space-y-2.5 text-xs leading-relaxed text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Tính theo ngày thực tế:</strong> Tiền phí nuôi được tính chuẩn xác theo từng ngày con ngựa thuộc quyền sở hữu của chủ ngựa.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Chuyển giao quyền sở hữu:</strong> Ngày phát sinh hợp đồng chuyển nhượng bắt đầu tính tiền cho chủ mới.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Rời CLB:</strong> Ngựa đã chuyển nhượng ra khỏi CLB hoặc đã mất sẽ tự động ngừng tính phí ngay lập tức.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Đối soát tài chính:</strong> Báo cáo tài chính và bảng kê chi phí chủ ngựa tự động lấy mức phí đang áp dụng của từng ngày trong kỳ.</span>
                  </li>
                </ul>
              </section>

              <section className="rounded-2xl bg-emerald-50/50 p-5 ring-1 ring-emerald-100">
                <h4 className="text-sm font-semibold text-emerald-950">Báo cáo Tài chính</h4>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                  Xem thực thu chi tiết theo từng chủ ngựa và đối soát dòng tiền tại trang Báo cáo Tài chính của CLB.
                </p>
                <div className="mt-4">
                  <Link
                    to="/reports?tab=finance"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    Mở Báo cáo Tài chính <ArrowRight size={14} />
                  </Link>
                </div>
              </section>
            </div>
          </div>
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
  const errors = useMemo(
    () => ({
      effectiveFrom: !date ? 'Chọn ngày áp dụng' : date < today ? 'Ngày áp dụng phải từ hôm nay trở đi' : undefined,
      dailyFee: moneyError(amount, { label: 'Số tiền' }),
    }),
    [date, today, amount],
  );
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (action.error) action.clearError();
  };

  const submit = () => {
    if (action.pending || !f.attempt()) return;
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
          <CancelButton />
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
      dirty={amount !== '' || date !== today}
      busy={action.pending}
      onSave={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Áp dụng từ" required name="effectiveFrom" error={f.show('effectiveFrom')} onBlur={f.blur('effectiveFrom')}>
          <DatePicker value={date} min={today} onChange={edit(setDate)} clearable={false} invalid={!!f.show('effectiveFrom')} />
        </Field>
        <Field label="Số tiền" required name="dailyFee" error={f.show('dailyFee')} onBlur={f.blur('dailyFee')}>
          <MoneyInput value={amount} onChange={edit(setAmount)} suffix="đ/con/ngày" autoFocus placeholder="Ví dụ: 250.000" className={cn(f.show('dailyFee') && invalidClass)} />
        </Field>
      </div>
      {action.error && !Object.keys(action.fieldErrors).length && !action.field && (
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
  const errors = useMemo(
    () => ({
      dailyFee: moneyError(amount, { label: 'Số tiền' }) ?? (parseMoney(amount) === fee.dailyFee ? 'Số tiền chưa thay đổi' : undefined),
      reason: !reason.trim() ? 'Nhập lý do sửa' : reason.trim().length > REASON_MAX ? `Tối đa ${REASON_MAX} ký tự` : undefined,
    }),
    [amount, reason, fee.dailyFee],
  );
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (action.error) action.clearError();
  };

  const submit = () => {
    if (action.pending || !f.attempt()) return;
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
          <CancelButton />
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
      dirty={amount !== initial || reason.trim() !== ''}
      busy={action.pending}
      onSave={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Áp dụng từ">
          <p className="flex h-10 items-center rounded-xl bg-gray-50 px-3 text-sm tabular-nums text-gray-600 ring-1 ring-gray-200">{formatDate(fee.effectiveFrom)}</p>
        </Field>
        <Field label="Số tiền" required name="dailyFee" error={f.show('dailyFee')} onBlur={f.blur('dailyFee')}>
          <MoneyInput value={amount} onChange={edit(setAmount)} suffix="đ/con/ngày" autoFocus className={cn(f.show('dailyFee') && invalidClass)} />
        </Field>
        <Field
          label="Lý do sửa"
          required
          name="reason"
          error={f.show('reason')}
          onBlur={f.blur('reason')}
          counter={<CharCount value={reason} max={REASON_MAX} />}
          className="sm:col-span-2"
        >
          <Input
            value={reason}
            maxLength={REASON_MAX}
            onChange={(event) => edit(setReason)(event.target.value)}
            placeholder="Ví dụ: Nhập nhầm số tiền"
            className={cn(f.show('reason') && invalidClass)}
          />
        </Field>
      </div>
      {action.error && !Object.keys(action.fieldErrors).length && !action.field && (
        <div className="mt-4">
          <ErrorBox message={action.error} />
        </div>
      )}
    </Modal>
  );
}
