// Chi tiết danh mục vật tư: nhân viên tra cứu; Quản lý CLB có thể sửa hoặc xóa danh mục.
import { Pencil, Trash2 } from 'lucide-react';
import type { SupplyItem } from '../../../api/types';
import { Button, Sheet } from '../../../components/ui';
import { supplyCategoryText } from '../../../lib/stable-labels';
import { formatDate } from '../../../lib/format';

export function SupplyItemSheet({
  item,
  onClose,
  onEdit,
  onDelete,
}: {
  item: SupplyItem;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Sheet
      open
      onClose={onClose}
      title={item.name}
      description={`${supplyCategoryText[item.category]} · đơn vị ${item.unit}`}
      footer={
        <div className="flex items-center gap-2">
          {onDelete && (
            <Button variant="danger" onClick={onDelete}>
              <Trash2 size={14} /> Xóa vật tư
            </Button>
          )}
          {onEdit && (
            <Button onClick={onEdit}>
              <Pencil size={14} /> Sửa thông tin
            </Button>
          )}
        </div>
      }
    >
      <section className="rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-100">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500">Tên vật tư</p>
            <p className="text-lg font-bold text-gray-900">{item.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-100">
            <div>
              <p className="text-xs text-gray-500">Phân loại</p>
              <p className="text-sm font-semibold text-gray-900">{supplyCategoryText[item.category]}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Đơn vị tính</p>
              <p className="text-sm font-semibold text-gray-900">{item.unit}</p>
            </div>
          </div>
          {item.createdAt && (
            <p className="text-xs text-gray-500 pt-2 border-t border-emerald-100">
              Được tạo ngày: {formatDate(item.createdAt)}
            </p>
          )}
        </div>
      </section>
      <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-600 ring-1 ring-gray-100">
        Danh mục dùng để tra cứu phục vụ chăm sóc và dinh dưỡng cho ngựa. Việc nhập, xuất và quản lý kho do đối tác bên thứ ba phụ trách.
      </p>
    </Sheet>
  );
}
