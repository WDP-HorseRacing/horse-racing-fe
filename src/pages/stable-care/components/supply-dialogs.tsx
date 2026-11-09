// Hộp thoại Quản lý CLB thêm hoặc sửa thông tin vật tư. Tồn kho do bên thứ ba đảm nhận.
import { useState } from 'react';
import { createSupplyItem, updateSupplyItem } from '../../../api/supplies';
import type { SupplyCategory, SupplyItem } from '../../../api/types';
import { Button, CancelButton, ErrorBox, Field, Input, Modal, Select, cn, invalidClass, useToast } from '../../../components/ui';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { useAction } from '../../../hooks/useService';
import { SUPPLY_CATEGORIES, SUPPLY_UNIT_HINTS, parseQuantity, quantityError, quantityText, supplyCategoryText, textError } from '../../../lib/stable-labels';
import { QuantityInput } from './QuantityInput';

const MAX_THRESHOLD = 1_000_000_000;

function Footer({ onSubmit, pending, label }: { onSubmit: () => void; pending: boolean; label: string }) {
  return (
    <>
      <CancelButton />
      <Button onClick={onSubmit} disabled={pending}>
        {pending ? 'Đang lưu…' : label}
      </Button>
    </>
  );
}

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
  const dirty = name !== initial.name || category !== initial.category || unit !== initial.unit || threshold !== initial.threshold;

  const errors: Partial<Record<'name' | 'category' | 'unit' | 'reorderThreshold', string>> = {
    name: textError(name, { label: 'Tên vật tư', max: 160 }),
    unit: !unit.trim() ? 'Nhập đơn vị' : unit.trim().length > 32 ? 'Đơn vị tối đa 32 ký tự' : undefined,
    reorderThreshold: quantityError(threshold, { label: 'Ngưỡng báo thiếu', positive: false, max: MAX_THRESHOLD }),
  };
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (action.error) action.clearError();
  };

  const submit = () => {
    if (!f.attempt()) return;
    const input = { name: name.trim(), category, unit: unit.trim(), reorderThreshold: parseQuantity(threshold) };
    void action.run(
      () => (item ? updateSupplyItem(item.id, input) : createSupplyItem(input)),
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
      description="Tồn kho và nhập, xuất do bên thứ ba đảm nhận."
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
              setCategory(event.target.value as SupplyCategory);
              if (action.error) action.clearError();
            }}
            className={cn(f.show('category') && invalidClass)}
          >
            {SUPPLY_CATEGORIES.map((value) => (
              <option key={value} value={value}>{supplyCategoryText[value]}</option>
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
        <Field label="Ngưỡng báo thiếu" required name="reorderThreshold" error={f.show('reorderThreshold')} onBlur={f.blur('reorderThreshold')} hint="Còn từ mức này trở xuống là Sắp hết" className="sm:col-span-6">
          <QuantityInput value={threshold} onChange={edit(setThreshold)} placeholder="0" className={cn(f.show('reorderThreshold') && invalidClass)} />
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
