// F4.5 — Danh sách vật tư CLB. Nhập và xuất do bên thứ ba đảm nhận; Quản lý CLB thêm và sửa thông tin.
import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { onRealtime } from '../../api/realtime';
import { listSupplyItems } from '../../api/supplies';
import type { NotificationItem, SupplyCategory, SupplyItem } from '../../api/types';
import { can } from '../../auth/permissions';
import { useCrumbs } from '../../components/Breadcrumb';
import { Button, ChipFilter, EmptyState, ErrorBox, Meter, NotFound, PageHeader, Pill, SearchInput, Skeleton, cn } from '../../components/ui';
import { useService } from '../../hooks/useService';
import { SUPPLY_CATEGORIES, formatAmount, formatQuantity, supplyCategoryText } from '../../lib/stable-labels';
import { useStore } from '../../store/store';
import { stockTone } from './care-helpers';
import { SupplyItemSheet } from './components/SupplyItemSheet';
import { SupplyItemDialog } from './components/supply-dialogs';

type ItemDialog = { item?: SupplyItem };

export default function Supplies() {
  const user = useStore((state) => state.currentUser);
  const [category, setCategory] = useState<SupplyCategory | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ItemDialog | null>(null);

  const canManage = can(user, 'supply.manage');
  const items = useService(() => listSupplyItems(), []);
  const all = useMemo(() => items.data ?? [], [items.data]);
  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return all.filter((item) => (category === 'ALL' || item.category === category) && (!text || item.name.toLowerCase().includes(text)));
  }, [all, category, search]);
  const low = all.filter((item) => item.lowStock);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vật tư"
        description={
          canManage
            ? 'Danh sách vật tư CLB. Quản lý CLB có thể thêm và sửa thông tin; số tồn chỉ xem, nhập và xuất do bên thứ ba đảm nhận.'
            : 'Danh sách vật tư CLB để tra cứu; số tồn chỉ xem. Nhập và xuất do bên thứ ba đảm nhận.'
        }
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
                  <li key={item.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-gray-50/70 sm:flex-nowrap', item.lowStock && 'bg-amber-50/40')}>
                    <button type="button" onClick={() => setOpenId(item.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-gray-900 hover:underline">{item.name}</span>
                        {item.lowStock && <Pill tone="amber">Sắp hết</Pill>}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {supplyCategoryText[item.category]} · báo sắp hết ở {formatAmount(item.reorderThreshold, item.unit)}
                      </span>
                    </button>
                    <div className="w-36 shrink-0">
                      <p className="text-right tabular-nums text-sm font-semibold text-gray-900">
                        {formatQuantity(item.quantityOnHand)} <span className="font-sans text-xs font-normal text-gray-500">{item.unit}</span>
                      </p>
                      <Meter className="mt-1" value={item.quantityOnHand} max={Math.max(item.reorderThreshold * 3, item.quantityOnHand, 1)} tone={stockTone(item)} />
                    </div>
                    {canManage && (
                      <Button variant="ghost" size="icon" title="Sửa vật tư" onClick={() => setDialog({ item })}>
                        <Pencil size={15} />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4">
            <section className={cn('rounded-2xl bg-white p-4 ring-1 ring-gray-200/80', low.length ? 'shadow-amber-tint' : 'shadow-card')}>
              <h2 className="flex items-center justify-between text-sm font-semibold text-gray-900">
                Sắp hết
                <span className={cn('rounded-md px-1.5 text-sm font-semibold tabular-nums', low.length ? 'bg-amber-50 text-amber-800' : 'text-gray-400')}>{low.length}</span>
              </h2>
              {low.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">Chưa có vật tư nào sắp hết.</p>
              ) : (
                <ul className="mt-2">
                  {low.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 border-t border-gray-100 py-2 first:border-t-0">
                      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span className="min-w-0 flex-1">
                        <button type="button" onClick={() => setOpenId(item.id)} className="block max-w-full truncate text-left text-sm font-medium text-gray-900 hover:underline">
                          {item.name}
                        </button>
                        <span className="block text-xs tabular-nums text-gray-500">
                          Còn <span className="font-semibold text-amber-800">{formatAmount(item.quantityOnHand, item.unit)}</span> / ngưỡng {formatAmount(item.reorderThreshold, item.unit)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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
        />
      )}
      {dialog && <SupplyItemDialog item={dialog.item} onClose={() => setDialog(null)} onDone={afterItemChange} />}
    </div>
  );
}
