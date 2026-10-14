// Các hộp thoại của trang Vật tư: thêm, sửa vật tư và nhập hàng (Quản lý CLB), xuất dùng (Quản lý CLB, HLV, bác sĩ, Groom),
// gửi, sửa đề xuất (HLV, Groom), cấp hàng và từ chối đề xuất (Quản lý CLB).
// Mọi ô được kiểm trước khi gửi. Lỗi trùng tên vật tư (409) của BE gắn vào ô Tên vật tư.
// Ô số dùng QuantityInput (dấu phẩy, tối đa 2 chữ số lẻ). Đã nhập mà bấm ra ngoài hộp thì hỏi trước khi đóng.
import { useState } from 'react';
import { createSupplyItem, createSupplyRequest, editSupplyRequest, fulfillSupplyRequest, receiveSupply, recordSupplyUsage, reviewSupplyRequest, updateSupplyItem } from '../../../api/supplies';
import type { SupplyCategory, SupplyItem, SupplyRequest } from '../../../api/types';
import { Button, ErrorBox, Field, Input, Modal, Select, Textarea, useToast } from '../../../components/ui';
import { MoneyInput } from '../../../components/MoneyInput';
import { useAction } from '../../../hooks/useService';
import { formatMoney, moneyError, parseMoney } from '../../../lib/format';
import { SUPPLY_CATEGORIES, SUPPLY_UNITS, formatAmount, parseQuantity, quantityError, quantityText, supplyCategoryText, textError } from '../../../lib/stable-labels';
import { QuantityInput } from './QuantityInput';

const MAX_STOCK = 1_000_000_000;

function Footer({ onClose, onSubmit, pending, label, danger }: { onClose: () => void; onSubmit: () => void; pending: boolean; label: string; danger?: boolean }) {
  return (
    <>
      <Button variant="ghost" onClick={onClose}>
        Hủy
      </Button>
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
  const [touched, setTouched] = useState(false);
  const dirty = name !== initial.name || category !== initial.category || unit !== initial.unit || threshold !== initial.threshold || stock !== '' || openingPrice !== '';
  // Đơn giá tồn ban đầu chỉ có nghĩa khi có nhập tồn.
  const stockValue = parseQuantity(stock);
  const hasStock = !item && !Number.isNaN(stockValue) && stockValue > 0;

  // Đơn vị chọn theo loại. Vật tư cũ có đơn vị ngoài danh sách thì vẫn giữ làm một lựa chọn.
  const units = SUPPLY_UNITS[category];
  const unitOptions = item && initial.unit && !units.includes(initial.unit) && category === initial.category ? [initial.unit, ...units] : units;

  // Lỗi kiểm ở FE chặn gửi. Lỗi của BE (vd trùng tên) chỉ hiện dưới ô và mất khi sửa ô, không chặn gửi lại.
  const clientErrors = {
    name: textError(name, { label: 'Tên vật tư', max: 160 }),
    unit: unit ? undefined : 'Chọn đơn vị',
    threshold: quantityError(threshold, { label: 'Ngưỡng báo thiếu', positive: false, max: MAX_STOCK }),
    stock: !item && stock.trim() ? quantityError(stock, { label: 'Tồn ban đầu', positive: false, max: MAX_STOCK }) : undefined,
    openingPrice: hasStock ? moneyError(openingPrice, { label: 'Đơn giá', required: false }) : undefined,
  };
  const errors = {
    name: clientErrors.name ?? action.fieldErrors.name,
    unit: clientErrors.unit ?? action.fieldErrors.unit,
    threshold: clientErrors.threshold ?? action.fieldErrors.reorderThreshold,
    stock: clientErrors.stock ?? action.fieldErrors.quantityOnHand,
    openingPrice: clientErrors.openingPrice ?? action.fieldErrors.openingUnitPrice,
  };
  const shown = (key: keyof typeof errors) => (touched ? errors[key] : undefined);
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (action.error) action.clearError();
  };

  const submit = () => {
    setTouched(true);
    if (Object.values(clientErrors).some(Boolean)) return;
    const base = { name: name.trim(), category, unit, reorderThreshold: parseQuantity(threshold) };
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
      description={item ? 'Số tồn đổi qua Nhập hàng hoặc Xuất dùng.' : undefined}
      footer={<Footer onClose={onClose} onSubmit={submit} pending={action.pending} label={saveLabel} />}
      dirty={dirty}
      onSave={submit}
      saveLabel={saveLabel}
    >
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Tên vật tư" required error={shown('name')} className="sm:col-span-6">
          <Input value={name} onChange={(event) => edit(setName)(event.target.value)} maxLength={180} placeholder="Ví dụ: Yến mạch, Cỏ khô Timothy, Vitamin E" />
        </Field>
        <Field label="Loại" required className="sm:col-span-4">
          <Select
            value={category}
            onChange={(event) => {
              const next = event.target.value as SupplyCategory;
              setCategory(next);
              // Đơn vị đang chọn không có trong loại mới thì bỏ, bắt chọn lại.
              if (unit && !SUPPLY_UNITS[next].includes(unit)) setUnit('');
            }}
          >
            {SUPPLY_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {supplyCategoryText[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Đơn vị" required error={shown('unit')} className="sm:col-span-2">
          <Select value={unit} onChange={(event) => edit(setUnit)(event.target.value)}>
            <option value="">Chọn đơn vị</option>
            {unitOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ngưỡng báo thiếu" required error={shown('threshold')} hint="Còn từ mức này trở xuống là Sắp hết" className={item ? 'sm:col-span-6' : 'sm:col-span-3'}>
          <QuantityInput value={threshold} onChange={edit(setThreshold)} placeholder="0" />
        </Field>
        {!item && (
          <Field label="Tồn ban đầu" error={shown('stock')} hint="Bỏ trống là 0" className="sm:col-span-3">
            <QuantityInput value={stock} onChange={edit(setStock)} placeholder="0" />
          </Field>
        )}
        {hasStock && (
          <Field label="Đơn giá tồn ban đầu" error={shown('openingPrice')} hint="Bỏ trống là 0 đ" className="sm:col-span-6">
            <MoneyInput value={openingPrice} onChange={edit(setOpeningPrice)} suffix={unit ? `đ/${unit}` : 'đ'} placeholder="Ví dụ: 15.000" />
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
  const [touched, setTouched] = useState(false);
  const clientErrors = {
    quantity: quantityError(quantity, { label: 'Số lượng', max: MAX_STOCK }),
    unitPrice: moneyError(price, { label: 'Đơn giá' }),
    note: textError(note, { label: 'Ghi chú', max: 500, required: false }),
  };
  const errors = {
    quantity: clientErrors.quantity ?? action.fieldErrors.quantity,
    unitPrice: clientErrors.unitPrice ?? action.fieldErrors.unitPrice,
    note: clientErrors.note ?? action.fieldErrors.note,
  };
  const shown = (key: keyof typeof errors) => (touched ? errors[key] : undefined);
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (action.error) action.clearError();
  };
  const total = clientErrors.quantity || clientErrors.unitPrice ? undefined : Math.round(parseQuantity(quantity) * parseMoney(price));

  const submit = () => {
    setTouched(true);
    if (Object.values(clientErrors).some(Boolean)) return;
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
      footer={<Footer onClose={onClose} onSubmit={submit} pending={action.pending} label="Nhập hàng" />}
      dirty={quantity !== '' || price !== '' || note !== ''}
      onSave={submit}
      saveLabel="Nhập hàng"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Số lượng (${item.unit})`} required error={shown('quantity')}>
          <QuantityInput value={quantity} onChange={edit(setQuantity)} autoFocus placeholder="Ví dụ: 30" />
        </Field>
        <Field label="Đơn giá" required error={shown('unitPrice')}>
          <MoneyInput value={price} onChange={edit(setPrice)} suffix={`đ/${item.unit}`} placeholder="Ví dụ: 18.000" />
        </Field>
        {total !== undefined && (
          <p className="text-sm text-gray-600 sm:col-span-2">
            Thành tiền <span className="font-semibold text-gray-900 tabular-nums">{formatMoney(total)}</span>
          </p>
        )}
        <Field label="Ghi chú" error={shown('note')} className="sm:col-span-2">
          <Textarea rows={2} value={note} onChange={(event) => edit(setNote)(event.target.value)} placeholder="Ví dụ: Mua của đại lý Minh Phát" />
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

/* ===== Xuất dùng (Quản lý CLB, HLV, bác sĩ, Groom) ===== */

export function UsageDialog({ item, onClose, onDone }: { item: SupplyItem; onClose: () => void; onDone: (item: SupplyItem) => void }) {
  const toast = useToast();
  const action = useAction();
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const value = parseQuantity(quantity);
  const overStock = !Number.isNaN(value) && value > item.quantityOnHand;
  const clientErrors = {
    quantity: quantityError(quantity, { label: 'Số lượng', max: MAX_STOCK }) ?? (overStock ? `Chỉ còn ${formatAmount(item.quantityOnHand, item.unit)}` : undefined),
    note: textError(note, { label: 'Ghi chú', max: 500, required: false }),
  };
  const errors = {
    quantity: clientErrors.quantity ?? action.fieldErrors.quantity,
    note: clientErrors.note ?? action.fieldErrors.note,
  };
  const shown = (key: keyof typeof errors) => (touched ? errors[key] : undefined);
  const edit = (setter: (value: string) => void) => (next: string) => {
    setter(next);
    if (action.error) action.clearError();
  };
  // Số còn lại sau khi lấy, làm tròn 2 chữ số lẻ như BE.
  const after = clientErrors.quantity ? undefined : Math.round((item.quantityOnHand - value) * 100) / 100;
  const crossesThreshold = after !== undefined && !item.lowStock && after <= item.reorderThreshold;

  const submit = () => {
    setTouched(true);
    if (Object.values(clientErrors).some(Boolean)) return;
    void action.run(
      () => recordSupplyUsage(item.id, { quantity: value, ...(note.trim() ? { note: note.trim() } : {}) }),
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
      footer={<Footer onClose={onClose} onSubmit={submit} pending={action.pending} label="Xuất dùng" />}
      dirty={quantity !== '' || note !== ''}
      onSave={submit}
      saveLabel="Xuất dùng"
    >
      <div className="space-y-4">
        <Field label={`Số lượng lấy ra (${item.unit})`} required error={shown('quantity')}>
          <QuantityInput value={quantity} onChange={edit(setQuantity)} autoFocus placeholder="Ví dụ: 5" />
        </Field>
        {after !== undefined && (
          <p className={crossesThreshold ? 'text-sm text-amber-800' : 'text-sm text-gray-600'}>
            Còn lại {formatAmount(after, item.unit)}
            {crossesThreshold ? '. Xuống mức sắp hết, Quản lý CLB sẽ được báo.' : ''}
          </p>
        )}
        <Field label="Ghi chú" error={shown('note')}>
          <Textarea rows={2} value={note} onChange={(event) => edit(setNote)(event.target.value)} placeholder="Ví dụ: Cho ô A3, hoặc Hao hụt khi kiểm kho" />
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
  const initial = { itemId: fixed?.id ?? '', quantity: quantityText(request?.quantity), note: request?.note ?? '' };
  const [itemId, setItemId] = useState(initial.itemId);
  const [quantity, setQuantity] = useState(initial.quantity);
  const [note, setNote] = useState(initial.note);
  const [touched, setTouched] = useState(false);
  const picked = fixed ?? items?.find((entry) => entry.id === itemId);
  const quantityErr = quantityError(quantity, { label: 'Số lượng', max: MAX_STOCK });
  const noteError = textError(note, { label: 'Ghi chú', max: 500, required: false });
  const dirty = itemId !== initial.itemId || quantity !== initial.quantity || note !== initial.note;

  const submit = () => {
    setTouched(true);
    if (!itemId || quantityErr || noteError) return;
    const amount = parseQuantity(quantity);
    void action.run(
      // Sửa: không gửi null (BE trả 400). Ghi chú xóa trắng thì gửi chuỗi rỗng.
      () => (request ? editSupplyRequest(request.id, { quantity: amount, note: note.trim() }) : createSupplyRequest({ itemId, quantity: amount, ...(note.trim() ? { note: note.trim() } : {}) })),
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
      footer={<Footer onClose={onClose} onSubmit={submit} pending={action.pending} label={saveLabel} />}
      dirty={dirty}
      onSave={submit}
      saveLabel={saveLabel}
    >
      <div className="space-y-4">
        {!fixed && (
          <Field label="Vật tư" required error={touched && !itemId ? 'Chọn vật tư' : undefined}>
            <Select value={itemId} onChange={(event) => setItemId(event.target.value)}>
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
        <Field label={`Số lượng cần thêm${picked ? ` (${picked.unit})` : ''}`} required error={touched ? quantityErr : undefined}>
          <QuantityInput value={quantity} onChange={setQuantity} placeholder="Ví dụ: 50" />
        </Field>
        <Field label="Ghi chú" error={touched ? noteError : undefined}>
          <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Đủ dùng cho khu D trong 2 tuần" />
        </Field>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Từ chối đề xuất ===== */

export function RejectRequestDialog({ request, onClose, onDone }: { request: SupplyRequest; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const error = textError(reason, { label: 'Lý do', max: 500 });
  const submit = () => {
    setTouched(true);
    if (error) return;
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
      description={`${request.requester.fullName} xin ${formatAmount(request.quantity, request.item.unit)}.`}
      footer={<Footer onClose={onClose} onSubmit={submit} pending={action.pending} label="Từ chối" danger />}
      dirty={reason.trim() !== ''}
      onSave={submit}
      saveLabel="Từ chối"
    >
      <Field label="Lý do" required error={touched ? error : undefined}>
        <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Kho còn đủ dùng 3 tuần, đề xuất lại cuối tháng" />
      </Field>
      {action.error && (
        <div className="mt-3">
          <ErrorBox message={action.error} />
        </div>
      )}
    </Modal>
  );
}

/* ===== Cấp hàng theo đề xuất (Quản lý CLB) ===== */

export function FulfillRequestDialog({ request, onClose, onDone }: { request: SupplyRequest; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [price, setPrice] = useState('');
  const [touched, setTouched] = useState(false);
  const { item } = request;
  const clientError = moneyError(price, { label: 'Đơn giá' });
  const error = clientError ?? action.fieldErrors.unitPrice;
  const total = clientError ? undefined : Math.round(request.quantity * parseMoney(price));
  const after = Math.round((item.quantityOnHand + request.quantity) * 100) / 100;

  const submit = () => {
    setTouched(true);
    if (clientError) return;
    void action.run(
      () => fulfillSupplyRequest(request.id, parseMoney(price)),
      () => {
        toast.push(`Đã cấp ${formatAmount(request.quantity, item.unit)} ${item.name}`, 'success');
        onDone();
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cấp hàng: ${item.name}`}
      description={`${request.requester.fullName} xin ${formatAmount(request.quantity, item.unit)}. Kho sẽ tăng từ ${formatAmount(item.quantityOnHand, item.unit)} lên ${formatAmount(after, item.unit)}.`}
      footer={<Footer onClose={onClose} onSubmit={submit} pending={action.pending} label="Cấp hàng" />}
      dirty={price !== ''}
      onSave={submit}
      saveLabel="Cấp hàng"
    >
      <div className="space-y-3">
        <Field label="Đơn giá" required error={touched ? error : undefined}>
          <MoneyInput
            value={price}
            onChange={(value) => {
              setPrice(value);
              if (action.error) action.clearError();
            }}
            suffix={`đ/${item.unit}`}
            autoFocus
            placeholder="Ví dụ: 20.000"
          />
        </Field>
        {total !== undefined && (
          <p className="text-sm text-gray-600">
            Thành tiền <span className="font-semibold text-gray-900 tabular-nums">{formatMoney(total)}</span>
          </p>
        )}
        {action.error && !Object.keys(action.fieldErrors).length && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}
