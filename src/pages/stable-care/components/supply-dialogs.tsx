// Các hộp thoại của trang Vật tư: thêm, sửa vật tư và nhập hàng (Quản lý CLB), xuất dùng (Quản lý CLB, HLV, bác sĩ, Groom),
// gửi, sửa đề xuất (HLV, Groom), cấp hàng và từ chối đề xuất (Quản lý CLB).
// Mọi ô được kiểm trước khi gửi, lỗi hiện khi rời ô. Lỗi trùng tên vật tư (409) của BE gắn vào ô Tên vật tư.
// Ô số dùng QuantityInput (dấu phẩy, tối đa 2 chữ số lẻ). Đã nhập mà bấm ra ngoài hộp thì hỏi trước khi đóng.
import { useState } from 'react';
import { createSupplyItem, createSupplyRequest, editSupplyRequest, fulfillSupplyRequest, receiveSupply, recordSupplyUsage, reviewSupplyRequest, updateSupplyItem } from '../../../api/supplies';
import type { SupplyCategory, SupplyItem, SupplyRequest } from '../../../api/types';
import { Button, CancelButton, ErrorBox, Field, Input, Modal, Select, Textarea, cn, invalidClass, useToast } from '../../../components/ui';
import { MoneyInput } from '../../../components/MoneyInput';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { useAction } from '../../../hooks/useService';
import { formatMoney, moneyError, parseMoney } from '../../../lib/format';
import { SUPPLY_CATEGORIES, SUPPLY_UNIT_HINTS, formatAmount, parseQuantity, quantityError, quantityText, supplyCategoryText, textError } from '../../../lib/stable-labels';
import { QuantityInput } from './QuantityInput';

const MAX_STOCK = 1_000_000_000;

/** Đơn giá nhập, cấp hàng: BE nhận 0 nhưng lô 0 đ hiện "Chưa có giá" dễ nhầm, nên bắt nhập giá thật. */
function unitPriceError(raw: string) {
  return moneyError(raw, { label: 'Đơn giá' }) ?? (parseMoney(raw) <= 0 ? 'Đơn giá phải lớn hơn 0' : undefined);
}

function Footer({ onSubmit, pending, label, danger }: { onSubmit: () => void; pending: boolean; label: string; danger?: boolean }) {
  return (
    <>
      <CancelButton />
      <Button variant={danger ? 'danger' : 'primary'} onClick={onSubmit} disabled={pending}>
        {pending ? 'Đang lưu…' : label}
      </Button>
    </>
  );
}

/* ===== Thêm, sửa vật tư ===== */

export function SupplyItemDialog({ item, onClose, onDone }: { item?: SupplyItem; onClose: () => void; onDone: (item: SupplyItem) => void }) {
  const toast = useToast();
  const action = useAction();
  const initial = {
    name: item?.name ?? '',
    category: item?.category ?? ('FEED' as SupplyCategory),
    unit: item?.unit ?? '',
    threshold: quantityText(item?.reorderThreshold),
  };
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState<SupplyCategory>(initial.category);
  const [unit, setUnit] = useState(initial.unit);
  const [threshold, setThreshold] = useState(initial.threshold);
  const [stock, setStock] = useState('');
  const [openingPrice, setOpeningPrice] = useState('');
  const dirty = name !== initial.name || category !== initial.category || unit !== initial.unit || threshold !== initial.threshold || stock !== '' || openingPrice !== '';
  // Đơn giá tồn ban đầu chỉ có nghĩa khi có nhập tồn.
  const stockValue = parseQuantity(stock);
  const hasStock = !item && !Number.isNaN(stockValue) && stockValue > 0;

  // Khóa theo tên ô của BE để lỗi BE (trùng tên, đã có nhập xuất nên không đổi loại, đơn vị) tự gắn vào ô.
  const errors: Partial<Record<'name' | 'category' | 'unit' | 'reorderThreshold' | 'quantityOnHand' | 'openingUnitPrice', string>> = {
    name: textError(name, { label: 'Tên vật tư', max: 160 }),
    unit: !unit.trim() ? 'Nhập đơn vị' : unit.trim().length > 32 ? 'Đơn vị tối đa 32 ký tự' : undefined,
    reorderThreshold: quantityError(threshold, { label: 'Ngưỡng báo thiếu', positive: false, max: MAX_STOCK }),
    quantityOnHand: !item && stock.trim() ? quantityError(stock, { label: 'Tồn ban đầu', positive: false, max: MAX_STOCK }) : undefined,
    openingUnitPrice: hasStock ? moneyError(openingPrice, { label: 'Đơn giá', required: false }) : undefined,
  };
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (action.error) action.clearError();
  };

  const submit = () => {
    if (!f.attempt()) return;
    const base = { name: name.trim(), category, unit: unit.trim(), reorderThreshold: parseQuantity(threshold) };
    void action.run(
      () =>
        item
          ? updateSupplyItem(item.id, base)
          : createSupplyItem(
              hasStock ? { ...base, quantityOnHand: stockValue, ...(openingPrice.trim() ? { openingUnitPrice: parseMoney(openingPrice) } : {}) } : stock.trim() ? { ...base, quantityOnHand: stockValue } : base,
            ),
      (saved) => {
        toast.push(item ? `Đã lưu ${saved.name}` : `Đã thêm ${saved.name}`, 'success');
        onDone(saved);
        onClose();
      },
    );
  };
  const saveLabel = item ? 'Lưu' : 'Thêm';

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? `Sửa vật tư: ${item.name}` : 'Thêm vật tư'}
      description={item ? 'Muốn đổi số tồn thì dùng Nhập hàng hoặc Xuất dùng.' : undefined}
      footer={<Footer onSubmit={submit} pending={action.pending} label={saveLabel} />}
      dirty={dirty}
      busy={action.pending}
      onSave={submit}
      saveLabel={saveLabel}
    >
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Tên vật tư" required name="name" error={f.show('name')} onBlur={f.blur('name')} className="sm:col-span-6">
          <Input
            value={name}
            onChange={(event) => edit(setName)(event.target.value)}
            maxLength={160}
            placeholder="Ví dụ: Yến mạch, Cỏ khô Timothy, Vitamin E"
            className={cn(f.show('name') && invalidClass)}
          />
        </Field>
        <Field label="Loại" required name="category" error={f.show('category')} className="sm:col-span-4">
          <Select
            value={category}
            onChange={(event) => {
              const next = event.target.value as SupplyCategory;
              setCategory(next);
              if (action.error) action.clearError();
            }}
            className={cn(f.show('category') && invalidClass)}
          >
            {SUPPLY_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {supplyCategoryText[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Đơn vị" required name="unit" error={f.show('unit')} onBlur={f.blur('unit')} className="sm:col-span-2">
          <Input
            value={unit}
            onChange={(event) => edit(setUnit)(event.target.value)}
            maxLength={32}
            placeholder={SUPPLY_UNIT_HINTS[category]}
            className={cn(f.show('unit') && invalidClass)}
          />
        </Field>
        <Field
          label="Ngưỡng báo thiếu"
          required
          name="reorderThreshold"
          error={f.show('reorderThreshold')}
          onBlur={f.blur('reorderThreshold')}
          hint="Còn từ mức này trở xuống là Sắp hết"
          className={item ? 'sm:col-span-6' : 'sm:col-span-3'}
        >
          <QuantityInput value={threshold} onChange={edit(setThreshold)} placeholder="0" className={cn(f.show('reorderThreshold') && invalidClass)} />
        </Field>
        {!item && (
          <Field label="Tồn ban đầu" name="quantityOnHand" error={f.show('quantityOnHand')} onBlur={f.blur('quantityOnHand')} hint="Bỏ trống là 0" className="sm:col-span-3">
            <QuantityInput value={stock} onChange={edit(setStock)} placeholder="0" className={cn(f.show('quantityOnHand') && invalidClass)} />
          </Field>
        )}
        {hasStock && (
          <Field label="Đơn giá tồn ban đầu" name="openingUnitPrice" error={f.show('openingUnitPrice')} onBlur={f.blur('openingUnitPrice')} hint="Bỏ trống là 0 đ" className="sm:col-span-6">
            <MoneyInput value={openingPrice} onChange={edit(setOpeningPrice)} suffix={unit ? `đ/${unit}` : 'đ'} placeholder="Ví dụ: 15.000" className={cn(f.show('openingUnitPrice') && invalidClass)} />
          </Field>
        )}
      </div>
      {action.error && !Object.keys(action.fieldErrors).length && (
        <div className="mt-4">
          <ErrorBox message={action.error} />
        </div>
      )}
    </Modal>
  );
}

/* ===== Nhập hàng (Quản lý CLB) ===== */

export function ReceiveDialog({ item, onClose, onDone }: { item: SupplyItem; onClose: () => void; onDone: (item: SupplyItem) => void }) {
  const toast = useToast();
  const action = useAction();
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const errors: Partial<Record<'quantity' | 'unitPrice' | 'note', string>> = {
    quantity: quantityError(quantity, { label: 'Số lượng', max: MAX_STOCK }),
    unitPrice: unitPriceError(price),
    note: textError(note, { label: 'Ghi chú', max: 500, required: false }),
  };
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (action.error) action.clearError();
  };
  const total = errors.quantity || errors.unitPrice ? undefined : Math.round(parseQuantity(quantity) * parseMoney(price));

  const submit = () => {
    if (!f.attempt()) return;
    const amount = parseQuantity(quantity);
    void action.run(
      () => receiveSupply(item.id, { quantity: amount, unitPrice: parseMoney(price), ...(note.trim() ? { note: note.trim() } : {}) }),
      (saved) => {
        toast.push(`Đã nhập ${formatAmount(amount, saved.unit)} ${saved.name}`, 'success');
        onDone(saved);
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Nhập hàng: ${item.name}`}
      description={`Đang còn ${formatAmount(item.quantityOnHand, item.unit)}.`}
      footer={<Footer onSubmit={submit} pending={action.pending} label="Nhập hàng" />}
      dirty={quantity !== '' || price !== '' || note !== ''}
      busy={action.pending}
      onSave={submit}
      saveLabel="Nhập hàng"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Số lượng (${item.unit})`} required name="quantity" error={f.show('quantity')} onBlur={f.blur('quantity')}>
          <QuantityInput value={quantity} onChange={edit(setQuantity)} autoFocus placeholder="Ví dụ: 30" className={cn(f.show('quantity') && invalidClass)} />
        </Field>
        <Field label="Đơn giá" required name="unitPrice" error={f.show('unitPrice')} onBlur={f.blur('unitPrice')}>
          <MoneyInput value={price} onChange={edit(setPrice)} suffix={`đ/${item.unit}`} placeholder="Ví dụ: 18.000" className={cn(f.show('unitPrice') && invalidClass)} />
        </Field>
        {total !== undefined && (
          <p className="text-sm text-gray-600 sm:col-span-2">
            Thành tiền <span className="font-semibold text-gray-900 tabular-nums">{formatMoney(total)}</span>
          </p>
        )}
        <Field label="Ghi chú" name="note" error={f.show('note')} onBlur={f.blur('note')} className="sm:col-span-2">
          <Textarea
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => edit(setNote)(event.target.value)}
            placeholder="Ví dụ: Mua của đại lý Minh Phát"
            className={cn(f.show('note') && invalidClass)}
          />
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

/* ===== Xuất dùng (Quản lý CLB, HLV, bác sĩ, Groom; thuốc chỉ Quản lý CLB, bác sĩ). Ghi chú bắt buộc ===== */

export function UsageDialog({ item, onClose, onDone }: { item: SupplyItem; onClose: () => void; onDone: (item: SupplyItem) => void }) {
  const toast = useToast();
  const action = useAction();
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const value = parseQuantity(quantity);
  const overStock = !Number.isNaN(value) && value > item.quantityOnHand;
  const errors: Partial<Record<'quantity' | 'note', string>> = {
    quantity: quantityError(quantity, { label: 'Số lượng', max: MAX_STOCK }) ?? (overStock ? `Chỉ còn ${formatAmount(item.quantityOnHand, item.unit)}` : undefined),
    note: note.trim() ? textError(note, { label: 'Ghi chú', max: 500, required: false }) : 'Phải ghi chú lần xuất',
  };
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const edit = (setter: (value: string) => void) => (next: string) => {
    setter(next);
    if (action.error) action.clearError();
  };
  // Số còn lại sau khi lấy, làm tròn 2 chữ số lẻ như BE.
  const after = errors.quantity ? undefined : Math.round((item.quantityOnHand - value) * 100) / 100;
  const crossesThreshold = after !== undefined && !item.lowStock && after <= item.reorderThreshold;

  const submit = () => {
    if (!f.attempt()) return;
    void action.run(
      () => recordSupplyUsage(item.id, { quantity: value, note: note.trim() }),
      (saved) => {
        toast.push(`Đã xuất ${formatAmount(value, saved.unit)} ${saved.name}`, 'success');
        onDone(saved);
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Xuất dùng: ${item.name}`}
      description={`Đang còn ${formatAmount(item.quantityOnHand, item.unit)}.`}
      footer={<Footer onSubmit={submit} pending={action.pending} label="Xuất dùng" />}
      dirty={quantity !== '' || note !== ''}
      busy={action.pending}
      onSave={submit}
      saveLabel="Xuất dùng"
    >
      <div className="space-y-4">
        <Field label={`Số lượng lấy ra (${item.unit})`} required name="quantity" error={f.show('quantity')} onBlur={f.blur('quantity')}>
          <QuantityInput value={quantity} onChange={edit(setQuantity)} autoFocus placeholder="Ví dụ: 5" className={cn(f.show('quantity') && invalidClass)} />
        </Field>
        {after !== undefined && (
          <p className={crossesThreshold ? 'text-sm text-amber-800' : 'text-sm text-gray-600'}>
            Còn lại {formatAmount(after, item.unit)}
            {crossesThreshold ? '. Xuống mức sắp hết, Quản lý CLB sẽ được báo.' : ''}
          </p>
        )}
        <Field label="Ghi chú" required name="note" error={f.show('note')} onBlur={f.blur('note')} hint="Lấy cho ai, việc gì. Sổ nhập xuất giữ ghi chú này.">
          <Textarea
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => edit(setNote)(event.target.value)}
            placeholder="Ví dụ: Cho ngựa ô A3, hoặc Hao hụt khi kiểm kho"
            className={cn(f.show('note') && invalidClass)}
          />
        </Field>
        {action.error && !Object.keys(action.fieldErrors).length && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Đề xuất thêm ===== */

export function SupplyRequestDialog({
  items,
  item,
  request,
  onClose,
  onDone,
}: {
  /** Danh sách để chọn khi không mở từ một vật tư. */
  items?: SupplyItem[];
  item?: SupplyItem;
  /** Sửa đề xuất đang chờ duyệt. */
  request?: SupplyRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const fixed = request?.item ?? item;
  const initial = { itemId: fixed?.id ?? '', note: request?.note ?? '' };
  const [itemId, setItemId] = useState(initial.itemId);
  const [note, setNote] = useState(initial.note);
  const picked = fixed ?? items?.find((entry) => entry.id === itemId);
  // Không ghi số lượng: nhu cầu ghi bằng chữ, Quản lý cấp theo số thực nhận.
  const errors: Partial<Record<'itemId' | 'note', string>> = {
    itemId: itemId ? undefined : 'Chọn vật tư',
    note: textError(note, { label: 'Nhu cầu', max: 500 }),
  };
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const dirty = itemId !== initial.itemId || note !== initial.note;

  const submit = () => {
    if (!f.attempt()) return;
    void action.run(
      () => (request ? editSupplyRequest(request.id, { note: note.trim() }) : createSupplyRequest({ itemId, note: note.trim() })),
      () => {
        toast.push(request ? 'Đã sửa đề xuất' : 'Đã gửi đề xuất', 'success');
        onDone();
        onClose();
      },
    );
  };
  const saveLabel = request ? 'Lưu' : 'Gửi';

  return (
    <Modal
      open
      onClose={onClose}
      title={request ? 'Sửa đề xuất' : picked && fixed ? `Đề xuất thêm ${picked.name}` : 'Đề xuất thêm vật tư'}
      description="Quản lý CLB sẽ duyệt và cấp hàng."
      footer={<Footer onSubmit={submit} pending={action.pending} label={saveLabel} />}
      dirty={dirty}
      busy={action.pending}
      onSave={submit}
      saveLabel={saveLabel}
    >
      <div className="space-y-4">
        {!fixed && (
          <Field label="Vật tư" required name="itemId" error={f.show('itemId')} onBlur={f.blur('itemId')}>
            <Select
              value={itemId}
              onChange={(event) => {
                setItemId(event.target.value);
                if (action.error) action.clearError();
              }}
              onBlur={f.blur('itemId')}
              className={cn(f.show('itemId') && invalidClass)}
            >
              <option value="">Chọn vật tư…</option>
              {items?.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {supplyCategoryText[entry.category]} · còn {formatAmount(entry.quantityOnHand, entry.unit)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {picked && (
          <p className="text-sm text-gray-600">
            Còn <span className="font-semibold text-gray-900">{formatAmount(picked.quantityOnHand, picked.unit)}</span>. Báo sắp hết ở {formatAmount(picked.reorderThreshold, picked.unit)}.
          </p>
        )}
        <Field label="Nhu cầu" required name="note" error={f.show('note')} onBlur={f.blur('note')} hint="Ghi khoảng bao nhiêu, dùng cho việc gì. Quản lý cấp theo số thực nhận.">
          <Textarea
            rows={3}
            value={note}
            maxLength={500}
            onChange={(event) => {
              setNote(event.target.value);
              if (action.error) action.clearError();
            }}
            placeholder={`Ví dụ: Cần thêm khoảng 20 ${picked?.unit ?? 'bao'} cho tuần sau`}
            className={cn(f.show('note') && invalidClass)}
          />
        </Field>
        {action.error && !Object.keys(action.fieldErrors).length && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Từ chối đề xuất ===== */

export function RejectRequestDialog({ request, onClose, onDone }: { request: SupplyRequest; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [reason, setReason] = useState('');
  const errors: Partial<Record<'reason', string>> = { reason: textError(reason, { label: 'Lý do', max: 500 }) };
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const submit = () => {
    if (!f.attempt()) return;
    void action.run(
      () => reviewSupplyRequest(request.id, 'REJECTED', reason.trim()),
      () => {
        toast.push('Đã từ chối đề xuất', 'success');
        onDone();
        onClose();
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Từ chối đề xuất ${request.item.name}`}
      description={request.note ? `${request.requester.fullName}: ${request.note}` : `Đề xuất của ${request.requester.fullName}.`}
      footer={<Footer onSubmit={submit} pending={action.pending} label="Từ chối" danger />}
      dirty={reason.trim() !== ''}
      busy={action.pending}
      onSave={submit}
      saveLabel="Từ chối"
    >
      <Field label="Lý do" required name="reason" error={f.show('reason')} onBlur={f.blur('reason')}>
        <Textarea
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (action.error) action.clearError();
          }}
          placeholder="Ví dụ: Kho còn đủ dùng 3 tuần, đề xuất lại cuối tháng"
          className={cn(f.show('reason') && invalidClass)}
        />
      </Field>
      {action.error && !Object.keys(action.fieldErrors).length && (
        <div className="mt-3">
          <ErrorBox message={action.error} />
        </div>
      )}
    </Modal>
  );
}

/* ===== Cấp hàng theo đề xuất (Quản lý CLB) =====
 * approveFirst: mở từ nút Duyệt ở đề xuất Chờ duyệt, gửi duyệt rồi nhập kho trong một lần bấm (BE không có route gộp).
 * Đóng hộp trước khi gửi thì đề xuất vẫn Chờ duyệt. Duyệt được mà nhập lỗi thì giữ hộp, thử lại chỉ gọi bước nhập. */

export function FulfillRequestDialog({ request, approveFirst, onClose, onDone }: { request: SupplyRequest; approveFirst?: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [approved, setApproved] = useState(false);
  const { item } = request;
  const label = approveFirst ? 'Duyệt và nhập kho' : 'Cấp hàng';
  // Đã duyệt mà chưa nhập được thì danh sách đổi trạng thái, nên đóng hộp phải tải lại.
  const close = () => {
    if (approved) onDone();
    onClose();
  };
  const errors: Partial<Record<'quantity' | 'unitPrice', string>> = {
    quantity: quantityError(quantity, { label: 'Số lượng thực nhận', max: MAX_STOCK }),
    unitPrice: unitPriceError(price),
  };
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (action.error) action.clearError();
  };
  const amount = errors.quantity ? undefined : parseQuantity(quantity);
  const total = amount === undefined || errors.unitPrice ? undefined : Math.round(amount * parseMoney(price));
  const after = amount === undefined ? undefined : Math.round((item.quantityOnHand + amount) * 100) / 100;

  const submit = () => {
    if (!f.attempt() || amount === undefined) return;
    void action.run(
      async () => {
        if (approveFirst && !approved) {
          await reviewSupplyRequest(request.id, 'APPROVED');
          setApproved(true);
        }
        return fulfillSupplyRequest(request.id, { quantity: amount, unitPrice: parseMoney(price) });
      },
      () => {
        toast.push(approveFirst ? `Đã duyệt và nhập ${formatAmount(amount, item.unit)} ${item.name}` : `Đã cấp ${formatAmount(amount, item.unit)} ${item.name}`, 'success');
        onDone();
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={close}
      title={`${approveFirst ? 'Duyệt và nhập kho' : 'Cấp hàng'}: ${item.name}`}
      description={`Đề xuất của ${request.requester.fullName}. Kho đang còn ${formatAmount(item.quantityOnHand, item.unit)}.`}
      footer={<Footer onSubmit={submit} pending={action.pending} label={label} />}
      dirty={quantity !== '' || price !== ''}
      busy={action.pending}
      onSave={submit}
      saveLabel={label}
    >
      <div className="space-y-4">
        {request.note && (
          <p className="whitespace-pre-line rounded-xl bg-emerald-50/60 px-3 py-2 text-sm text-gray-700 ring-1 ring-emerald-100">
            <span className="block text-xs text-gray-500">Nhu cầu</span>
            {request.note}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Số lượng thực nhận (${item.unit})`} required name="quantity" error={f.show('quantity')} onBlur={f.blur('quantity')} hint="Số hàng thật sự về kho">
            <QuantityInput value={quantity} onChange={edit(setQuantity)} autoFocus placeholder="Ví dụ: 40" className={cn(f.show('quantity') && invalidClass)} />
          </Field>
          <Field label="Đơn giá" required name="unitPrice" error={f.show('unitPrice')} onBlur={f.blur('unitPrice')}>
            <MoneyInput value={price} onChange={edit(setPrice)} suffix={`đ/${item.unit}`} placeholder="Ví dụ: 20.000" className={cn(f.show('unitPrice') && invalidClass)} />
          </Field>
        </div>
        {(total !== undefined || after !== undefined) && (
          <p className="text-sm text-gray-600">
            {total !== undefined && (
              <>
                Thành tiền <span className="font-semibold text-gray-900 tabular-nums">{formatMoney(total)}</span>
              </>
            )}
            {total !== undefined && after !== undefined && ' · '}
            {after !== undefined && (
              <>
                Tồn sau khi cấp <span className="font-semibold text-gray-900 tabular-nums">{formatAmount(after, item.unit)}</span>
              </>
            )}
          </p>
        )}
        {action.error && approved ? (
          <ErrorBox message={`Đã duyệt nhưng chưa nhập được hàng: ${action.error}`} />
        ) : (
          action.error && !Object.keys(action.fieldErrors).length && <ErrorBox message={action.error} />
        )}
      </div>
    </Modal>
  );
}
