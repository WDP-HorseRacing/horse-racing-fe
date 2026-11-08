// Chi tiết vật tư: nhân viên xem tồn kho; chỉ Quản lý CLB được sửa thông tin.
import { Pencil } from 'lucide-react';
import type { SupplyItem } from '../../../api/types';
import { Button, Meter, Pill, Sheet, cn } from '../../../components/ui';
import { formatAmount, formatQuantity, supplyCategoryText } from '../../../lib/stable-labels';
import { stockTone } from '../care-helpers';

export function SupplyItemSheet({ item, onClose, onEdit }: { item: SupplyItem; onClose: () => void; onEdit?: () => void }) {
  return (
    <Sheet
      open
      onClose={onClose}
      title={item.name}
      description={`${supplyCategoryText[item.category]} · đơn vị ${item.unit}`}
      footer={onEdit && <Button onClick={onEdit}><Pencil size={14} /> Sửa thông tin</Button>}
    >
      <section className={cn('rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-100', item.lowStock && 'shadow-amber-tint')}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">Tồn hiện tại</p>
            <p className="tabular-nums text-3xl font-bold text-gray-900">
              {formatQuantity(item.quantityOnHand)} <span className="text-base font-medium text-gray-500">{item.unit}</span>
            </p>
          </div>
          {item.lowStock && <Pill tone="amber">Sắp hết</Pill>}
        </div>
        <Meter className="mt-3" value={item.quantityOnHand} max={Math.max(item.reorderThreshold * 3, item.quantityOnHand, 1)} tone={stockTone(item)} />
        <p className="mt-2 text-xs text-gray-500">Ngưỡng báo sắp hết: {formatAmount(item.reorderThreshold, item.unit)}</p>
      </section>
      <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-600 ring-1 ring-gray-100">
        Nhập và xuất vật tư do bên thứ ba đảm nhận. Số lượng ở đây chỉ để tra cứu.
      </p>
    </Sheet>
  );
}
