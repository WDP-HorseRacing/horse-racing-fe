// Các hộp thoại của trang Vật tư: thêm, sửa vật tư (Quản lý CLB), kiểm kê (Quản lý CLB, HLV, Groom),
// gửi, sửa đề xuất bổ sung (HLV, Groom), từ chối đề xuất (Quản lý CLB).
// Câu lỗi validate của BE ở đây còn tiếng Anh: mọi ô được kiểm trước khi gửi, câu báo tiếng Việt.
import { useState } from 'react';
import { countSupplyStock, createSupplyItem, createSupplyRequest, editSupplyRequest, setSupplyRequestStatus, updateSupplyItem } from '../../../api/supplies';
import type { SupplyCategory, SupplyItem, SupplyRequest } from '../../../api/types';
import { Button, ErrorBox, Field, Input, Modal, Select, Textarea, useToast } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';
import { SUPPLY_CATEGORIES, formatAmount, formatQuantity, parseQuantity, quantityError, supplyCategoryText, textError } from '../../../lib/stable-labels';

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
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<SupplyCategory>(item?.category ?? 'FEED');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [threshold, setThreshold] = useState(item ? String(item.reorderThreshold) : '');
  const [stock, setStock] = useState('');
  const [touched, setTouched] = useState(false);

  const errors = {
    name: textError(name, { label: 'Tên vật tư', max: 160 }) ?? action.fieldErrors.name,
    unit: textError(unit, { label: 'Đơn vị', max: 32 }) ?? action.fieldErrors.unit,
    threshold: quantityError(threshold, { label: 'Ngưỡng báo thiếu', positive: false, max: MAX_STOCK }) ?? action.fieldErrors.reorderThreshold,
    stock: !item && stock.trim() ? quantityError(stock, { label: 'Tồn ban đầu', positive: false, max: MAX_STOCK }) : undefined,
  };
  const shown = (key: keyof typeof errors) => (touched ? errors[key] : undefined);

  const submit = () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const base = { name: name.trim(), category, unit: unit.trim(), reorderThreshold: parseQuantity(threshold) };
    void action.run(
      () => (item ? updateSupplyItem(item.id, base) : createSupplyItem(stock.trim() ? { ...base, quantityOnHand: parseQuantity(stock) } : base)),
      (saved) => {
        toast.push(item ? `Đã lưu ${saved.name}` : `Đã thêm ${saved.name} vào kho`, 'success');
        onDone(saved);
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? `Sửa vật tư: ${item.name}` : 'Thêm vật tư'}
      description={item ? 'Đổi tồn kho bằng Kiểm kê, không sửa ở đây.' : 'Kho chung của cả câu lạc bộ.'}
      footer={<Footer onClose={onClose} onSubmit={submit} pending={action.pending} label={item ? 'Lưu' : 'Thêm vật tư'} />}
    >
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Tên vật tư" required error={shown('name')} className="sm:col-span-6">
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={180} placeholder="Ví dụ: Yến mạch, Cỏ khô Timothy, Vitamin E" />
        </Field>
        <Field label="Loại" required className="sm:col-span-4">
          <Select value={category} onChange={(event) => setCategory(event.target.value as SupplyCategory)}>
            {SUPPLY_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {supplyCategoryText[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Đơn vị" required error={shown('unit')} className="sm:col-span-2">
          <Input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={40} placeholder="kg, bao, lọ" />
        </Field>
        <Field label="Ngưỡng báo thiếu" required error={shown('threshold')} hint="Tồn bằng hoặc dưới mức này thì hiện Sắp hết" className={item ? 'sm:col-span-6' : 'sm:col-span-3'}>
          <Input value={threshold} onChange={(event) => setThreshold(event.target.value)} inputMode="decimal" placeholder="0" />
        </Field>
        {!item && (
          <Field label="Tồn ban đầu" error={shown('stock')} hint="Bỏ trống là 0" className="sm:col-span-3">
            <Input value={stock} onChange={(event) => setStock(event.target.value)} inputMode="decimal" placeholder="0" />
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

/* ===== Kiểm kê ===== */

export function StockCountDialog({ item, onClose, onDone }: { item: SupplyItem; onClose: () => void; onDone: (item: SupplyItem) => void }) {
  const toast = useToast();
  const action = useAction();
  const [count, setCount] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const countError = quantityError(count, { label: 'Số đếm', positive: false, max: MAX_STOCK });
  const noteError = textError(note, { label: 'Ghi chú', max: 500, required: false });
  const value = parseQuantity(count);
  const delta = Number.isNaN(value) ? undefined : Math.round((value - item.quantityOnHand) * 100) / 100;

  const submit = () => {
    setTouched(true);
    if (countError || noteError) return;
    void action.run(
      () => countSupplyStock(item.id, value, note.trim() || undefined),
      (saved) => {
        toast.push(`Đã cập nhật tồn ${saved.name}: ${formatAmount(saved.quantityOnHand, saved.unit)}`, 'success');
        onDone(saved);
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Kiểm kê: ${item.name}`}
      description={`Đếm thực tế rồi nhập số còn lại. Hệ thống đang ghi ${formatAmount(item.quantityOnHand, item.unit)}.`}
      footer={<Footer onClose={onClose} onSubmit={submit} pending={action.pending} label="Lưu số đếm" />}
    >
      <div className="space-y-4">
        <Field label={`Số đếm được (${item.unit})`} required error={touched ? countError : undefined}>
          <Input value={count} onChange={(event) => setCount(event.target.value)} inputMode="decimal" autoFocus placeholder={formatQuantity(item.quantityOnHand)} />
        </Field>
        {delta !== undefined && delta !== 0 && !countError && (
          <p className={delta < 0 ? 'text-sm text-amber-800' : 'text-sm text-emerald-800'}>
            {delta < 0 ? `Ít hơn hệ thống ${formatAmount(-delta, item.unit)}` : `Nhiều hơn hệ thống ${formatAmount(delta, item.unit)}`}. Sổ nhập xuất ghi lại chênh lệch này.
          </p>
        )}
        <Field label="Ghi chú" error={touched ? noteError : undefined}>
          <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Đã dùng cho tuần này, 1 bao bị ẩm bỏ đi" />
        </Field>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Đề xuất bổ sung ===== */

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
  const [itemId, setItemId] = useState(fixed?.id ?? '');
  const [quantity, setQuantity] = useState(request ? String(request.quantity) : '');
  const [note, setNote] = useState(request?.note ?? '');
  const [touched, setTouched] = useState(false);
  const picked = fixed ?? items?.find((entry) => entry.id === itemId);
  const quantityErr = quantityError(quantity, { label: 'Số lượng', max: MAX_STOCK });
  const noteError = textError(note, { label: 'Ghi chú', max: 500, required: false });

  const submit = () => {
    setTouched(true);
    if (!itemId || quantityErr || noteError) return;
    const amount = parseQuantity(quantity);
    void action.run(
      // Sửa: không gửi null (BE lỗi 500). Ghi chú xóa trắng thì gửi chuỗi rỗng.
      () => (request ? editSupplyRequest(request.id, { quantity: amount, note: note.trim() }) : createSupplyRequest({ itemId, quantity: amount, ...(note.trim() ? { note: note.trim() } : {}) })),
      () => {
        toast.push(request ? 'Đã sửa đề xuất' : `Đã gửi đề xuất bổ sung ${picked?.name ?? ''}, theo dõi ở tab Đề xuất của tôi`, 'success');
        onDone();
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={request ? 'Sửa đề xuất' : picked && fixed ? `Đề xuất bổ sung: ${picked.name}` : 'Đề xuất bổ sung vật tư'}
      description="Quản lý CLB duyệt rồi cấp, số cấp được cộng vào kho chung."
      footer={<Footer onClose={onClose} onSubmit={submit} pending={action.pending} label={request ? 'Lưu' : 'Gửi đề xuất'} />}
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
            Đang còn <span className="font-semibold text-gray-900">{formatAmount(picked.quantityOnHand, picked.unit)}</span>, ngưỡng báo thiếu {formatAmount(picked.reorderThreshold, picked.unit)}.
          </p>
        )}
        <Field label={`Số lượng cần thêm${picked ? ` (${picked.unit})` : ''}`} required error={touched ? quantityErr : undefined}>
          <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" placeholder="Ví dụ: 50" />
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
      () => setSupplyRequestStatus(request.id, 'REJECTED', reason.trim()),
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
      description={`${request.requester.fullName} xin ${formatAmount(request.quantity, request.item.unit)}. Người đề xuất thấy lý do này.`}
      footer={<Footer onClose={onClose} onSubmit={submit} pending={action.pending} label="Từ chối" danger />}
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
