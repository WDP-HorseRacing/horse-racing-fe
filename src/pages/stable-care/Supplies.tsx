// F4.5 — Danh sách danh mục vật tư CLB. Tồn kho và nhập/xuất do bên thứ ba đảm nhận; Quản lý CLB thêm, sửa và xóa danh mục.
import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Box } from 'lucide-react';
import { onRealtime } from '../../api/realtime';
import { deleteSupplyItem, listSupplyItems } from '../../api/supplies';
import type { NotificationItem, SupplyCategory, SupplyItem } from '../../api/types';
import { can } from '../../auth/permissions';
import { useCrumbs } from '../../components/Breadcrumb';
import { Button, ChipFilter, ConfirmDialog, EmptyState, ErrorBox, NotFound, PageHeader, Pill, SearchInput, Skeleton, cn, useToast } from '../../components/ui';
import { useAction, useService } from '../../hooks/useService';
import { SUPPLY_CATEGORIES, supplyCategoryText } from '../../lib/stable-labels';
import { useStore } from '../../store/store';
import { SupplyItemSheet } from './components/SupplyItemSheet';
import { SupplyItemDialog } from './components/supply-dialogs';

type ItemDialog = { item?: SupplyItem };

export default function Supplies() {
  const toast = useToast();
  const deleteAction = useAction();
  const user = useStore((state) => state.currentUser);
  const [category, setCategory] = useState<SupplyCategory | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ItemDialog | null>(null);
  const [deletingItem, setDeletingItem] = useState<SupplyItem | null>(null);

  const canManage = can(user, 'supply.manage');
  const items = useService(() => listSupplyItems(), []);
  const all = useMemo(() => items.data ?? [], [items.data]);
  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return all.filter((item) => (category === 'ALL' || item.category === category) && (!text || item.name.toLowerCase().includes(text)));
  }, [all, category, search]);
  const opened = openId ? all.find((item) => item.id === openId) : undefined;
  useCrumbs([{ label: 'Vật tư' }]);

  const reloadItems = items.reload;
  useEffect(
    () =>
      onRealtime<NotificationItem>('notification.created', (notification) => {
        if (notification.category === 'SUPPLY') reloadItems();
      }),
    [reloadItems],
  );

  if (!can(user, 'supply.view')) return <NotFound message="Trang này dành cho nhân viên câu lạc bộ." />;

  const afterItemChange = () => items.reload();

  const handleDelete = (item: SupplyItem) => {
    void deleteAction.run(
      () => deleteSupplyItem(item.id),
      () => {
        toast.push(`Đã xóa vật tư ${item.name}`, 'success');
        setDeletingItem(null);
        if (openId === item.id) setOpenId(null);
        items.reload();
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vật tư"
        description="Danh mục vật tư phục vụ công tác chăm sóc và dinh dưỡng tại chuồng."
        actions={canManage && <Button onClick={() => setDialog({})}><Plus size={16} /> Thêm vật tư</Button>}
      />

      {items.loading && !items.data ? (
        <Skeleton rows={6} />
      ) : items.error ? (
        <ErrorBox message={items.error} />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-12">
          <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-200/80 lg:col-span-8">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
              <ChipFilter
                value={category}
                onChange={setCategory}
                options={[
                  { value: 'ALL' as const, label: 'Tất cả', count: all.length },
                  ...SUPPLY_CATEGORIES.map((value) => ({
                    value,
                    label: supplyCategoryText[value],
                    count: all.filter((item) => item.category === value).length,
                  })),
                ]}
              />
              <SearchInput value={search} onChange={setSearch} placeholder="Tìm vật tư" className="ml-auto w-full sm:w-56" />
            </div>
            {visible.length === 0 ? (
              <EmptyState
                title={all.length === 0 ? 'Danh sách vật tư đang trống' : 'Không có vật tư phù hợp'}
                hint={all.length === 0 ? (canManage ? 'Thêm vật tư để nhân viên CLB tra cứu.' : 'Quản lý CLB chưa thêm vật tư vào danh sách.') : undefined}
                action={all.length === 0 && canManage && <Button onClick={() => setDialog({})}><Plus size={15} /> Thêm vật tư</Button>}
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {visible.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-gray-50/70 sm:flex-nowrap">
                    <button type="button" onClick={() => setOpenId(item.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-gray-900 hover:underline">{item.name}</span>
                        <Pill tone="gray">{supplyCategoryText[item.category]}</Pill>
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Đơn vị tính: <span className="font-medium text-gray-700">{item.unit}</span>
                      </span>
                    </button>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" title="Sửa vật tư" onClick={() => setDialog({ item })}>
                          <Pencil size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" title="Xóa vật tư" onClick={() => setDeletingItem(item)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4">
            <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 shadow-card">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Box size={16} className="text-emerald-700" />
                Tổng quan danh mục
              </h2>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                Các loại vật tư đăng ký trong hệ thống để lập khẩu phần ăn và báo cáo chăm sóc chuồng trại.
              </p>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">Tổng số mặt hàng:</span>
                <span className="font-bold text-gray-900 text-sm tabular-nums">{all.length}</span>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2">
              {SUPPLY_CATEGORIES.map((value, index) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(category === value ? 'ALL' : value)}
                  className={cn(
                    'rounded-2xl bg-white p-3 text-left ring-1 transition hover:ring-emerald-300',
                    index === 0 ? 'col-span-2 shadow-grass-tint' : 'shadow-card',
                    category === value ? 'ring-2 ring-emerald-600' : 'ring-gray-200/80',
                  )}
                >
                  <p className="text-xs text-gray-500">{supplyCategoryText[value]}</p>
                  <p className="tabular-nums text-xl font-bold text-gray-900">{all.filter((item) => item.category === value).length}</p>
                </button>
              ))}
            </section>
          </aside>
        </div>
      )}

      {opened && (
        <SupplyItemSheet
          item={opened}
          onClose={() => setOpenId(null)}
          onEdit={canManage ? () => {
            setOpenId(null);
            setDialog({ item: opened });
          } : undefined}
          onDelete={canManage ? () => {
            setDeletingItem(opened);
          } : undefined}
        />
      )}

      {dialog && <SupplyItemDialog item={dialog.item} onClose={() => setDialog(null)} onDone={afterItemChange} />}

      {deletingItem && (
        <ConfirmDialog
          open
          title={`Xóa vật tư: ${deletingItem.name}`}
          message={`Bạn có chắc muốn xóa "${deletingItem.name}" khỏi danh mục vật tư CLB? Thao tác này sẽ ẩn vật tư khỏi danh sách tra cứu.`}
          confirmLabel={deleteAction.pending ? 'Đang xóa…' : 'Xóa vật tư'}
          danger
          pending={deleteAction.pending}
          onClose={() => setDeletingItem(null)}
          onConfirm={() => handleDelete(deletingItem)}
        />
      )}
    </div>
  );
}
