// F4.5 — Vật tư: kho chung của câu lạc bộ (không chia theo khu), quản lý theo lô.
// Quản lý CLB: thêm, sửa, xóa vật tư, nhập hàng kèm đơn giá, duyệt hoặc từ chối đề xuất rồi cấp hàng (kèm đơn giá).
// HLV, Groom: theo dõi tồn, xuất dùng (trừ thuốc), đề xuất bổ sung và theo dõi đề xuất của mình. Bác sĩ: xem kho, xuất dùng cả thuốc.
// Mọi lần xuất bắt buộc ghi chú.
// Hệ thống không tự trừ tồn theo khẩu phần hay đơn thuốc: ai lấy hàng thì bấm Xuất dùng, lô nhập trước trừ trước.
// Tiền (đơn giá, thành tiền, giá trị tồn) chỉ Quản lý CLB thấy.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, PackageMinus, PackagePlus, Plus } from 'lucide-react';
import { onRealtime } from '../../api/realtime';
import { deleteSupplyItem, listSupplyItems, listSupplyRequests, reviewSupplyRequest } from '../../api/supplies';
import type { NotificationItem, SupplyCategory, SupplyItem, SupplyRequest, SupplyRequestStatus } from '../../api/types';
import { can } from '../../auth/permissions';
import { useCrumbs } from '../../components/Breadcrumb';
import {
  ActionMenu,
  Button,
  ChipFilter,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Meter,
  NotFound,
  PageHeader,
  Pill,
  SearchInput,
  Skeleton,
  TabPanel,
  Tabs,
  cn,
  useToast,
} from '../../components/ui';
import { useAction, useService } from '../../hooks/useService';
import { now } from '../../lib/clock';
import { formatDateTime, formatRelative } from '../../lib/format';
import { SUPPLY_CATEGORIES, formatAmount, formatQuantity, supplyCategoryText, supplyRequestStatusText } from '../../lib/stable-labels';
import { useStore } from '../../store/store';
import { stockTone } from './care-helpers';
import { SupplyItemSheet } from './components/SupplyItemSheet';
import { FulfillRequestDialog, ReceiveDialog, RejectRequestDialog, SupplyItemDialog, SupplyRequestDialog, UsageDialog } from './components/supply-dialogs';

type Dialog =
  | { kind: 'item'; item?: SupplyItem }
  | { kind: 'receive'; item: SupplyItem }
  | { kind: 'use'; item: SupplyItem }
  | { kind: 'request'; item?: SupplyItem; request?: SupplyRequest }
  | { kind: 'delete'; item: SupplyItem }
  | { kind: 'reject'; request: SupplyRequest }
  | { kind: 'fulfill'; request: SupplyRequest };

const REQUEST_TONE: Record<SupplyRequestStatus, 'amber' | 'green' | 'gray' | 'red'> = { PENDING: 'amber', APPROVED: 'green', FULFILLED: 'gray', REJECTED: 'red' };

export default function Supplies() {
  const user = useStore((state) => state.currentUser);
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState<SupplyCategory | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // Tăng để bảng đề xuất tải lại sau khi gửi, sửa, từ chối, cấp.
  const [requestsVersion, setRequestsVersion] = useState(0);
  const reloadRequests = () => setRequestsVersion((version) => version + 1);
  const remove = useAction();

  const canManage = can(user, 'supply.manage');
  const canReceive = can(user, 'supply.receive');
  const canUseAny = can(user, 'supply.use');
  const canUseMedicine = can(user, 'supply.useMedicine');
  // Thuốc chỉ Quản lý CLB và bác sĩ xuất (BE trả 403 với HLV, Groom).
  const canUse = (item: SupplyItem) => canUseAny && (item.category !== 'MEDICINE' || canUseMedicine);
  const showPrice = can(user, 'supply.price');
  const canRequest = can(user, 'supplyRequest.create');
  const canViewRequests = can(user, 'supplyRequest.view');
  const tab = canViewRequests && params.get('tab') === 'requests' ? 'requests' : 'stock';

  const items = useService(() => listSupplyItems(), []);
  const all = useMemo(() => items.data ?? [], [items.data]);
  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return all.filter((item) => (category === 'ALL' || item.category === category) && (!text || item.name.toLowerCase().includes(text)));
  }, [all, category, search]);
  const low = all.filter((item) => item.lowStock);
  const opened = openId ? all.find((item) => item.id === openId) : undefined;
  useCrumbs([{ label: 'Vật tư' }]);

  // Thông báo vật tư (đề xuất mới, đã duyệt, đã cấp, sắp hết): tải lại kho và đề xuất.
  const reloadItems = items.reload;
  useEffect(
    () =>
      onRealtime<NotificationItem>('notification.created', (item) => {
        if (item.category !== 'SUPPLY') return;
        reloadItems();
        setRequestsVersion((version) => version + 1);
      }),
    [reloadItems],
  );

  if (!can(user, 'supply.view')) return <NotFound message="Trang này dành cho nhân viên câu lạc bộ." />;

  const setTab = (next: string) => {
    if (next === 'requests') params.set('tab', 'requests');
    else params.delete('tab');
    setParams(params, { replace: true });
  };

  const afterItemChange = () => items.reload();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vật tư"
        description={
          canManage
            ? 'Thức ăn, thuốc và dụng cụ dùng chung của CLB.'
            : canRequest
              ? `Lấy hàng ra dùng thì bấm Xuất dùng, ghi rõ lấy cho việc gì${canUseMedicine ? '' : ' (thuốc do bác sĩ xuất)'}. Sắp hết thì đề xuất thêm.`
              : 'Lấy hàng ra dùng thì bấm Xuất dùng.'
        }
        actions={
          <>
            {canRequest && (
              <Button variant={canManage ? 'secondary' : 'primary'} onClick={() => setDialog({ kind: 'request' })}>
                <PackagePlus size={16} /> Đề xuất thêm
              </Button>
            )}
            {canManage && (
              <Button onClick={() => setDialog({ kind: 'item' })}>
                <Plus size={16} /> Thêm vật tư
              </Button>
            )}
          </>
        }
      />

      {canViewRequests && (
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'stock', label: 'Kho', count: all.length },
            { key: 'requests', label: canManage ? 'Đề xuất' : 'Đề xuất của tôi' },
          ]}
        />
      )}

      {tab === 'requests' ? (
        <RequestsPanel manager={can(user, 'supplyRequest.review')} version={requestsVersion} onDialog={setDialog} />
      ) : items.loading && !items.data ? (
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
                  ...SUPPLY_CATEGORIES.map((value) => ({ value, label: supplyCategoryText[value], count: all.filter((item) => item.category === value).length })),
                ]}
              />
              <SearchInput value={search} onChange={setSearch} placeholder="Tìm vật tư" className="ml-auto w-full sm:w-56" />
            </div>
            {visible.length === 0 ? (
              <EmptyState
                title={all.length === 0 ? 'Kho chưa có vật tư nào' : 'Không có vật tư phù hợp'}
                hint={all.length === 0 ? (canManage ? 'Thêm thức ăn và thực phẩm bổ sung để HLV lập được khẩu phần.' : 'Quản lý CLB chưa thêm vật tư vào kho.') : undefined}
                action={
                  all.length === 0 &&
                  canManage && (
                    <Button onClick={() => setDialog({ kind: 'item' })}>
                      <Plus size={15} /> Thêm vật tư
                    </Button>
                  )
                }
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {visible.map((item) => (
                  <li key={item.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-gray-50/70 sm:flex-nowrap', item.lowStock && 'bg-red-50/30')}>
                    <button type="button" onClick={() => setOpenId(item.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-gray-900 hover:underline">{item.name}</span>
                        {item.lowStock && <Pill tone="red">Sắp hết</Pill>}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {supplyCategoryText[item.category]} · báo sắp hết ở {formatAmount(item.reorderThreshold, item.unit)}
                      </span>
                    </button>
                    <div className="w-36 shrink-0">
                      <p className="text-right font-mono text-sm font-semibold tabular-nums text-gray-900">
                        {formatQuantity(item.quantityOnHand)} <span className="font-sans text-xs font-normal text-gray-500">{item.unit}</span>
                      </p>
                      <Meter className="mt-1" value={item.quantityOnHand} max={Math.max(item.reorderThreshold * 3, item.quantityOnHand, 1)} tone={stockTone(item)} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {canUse(item) && (
                        <Button variant="ghost" size="icon" title={item.quantityOnHand > 0 ? 'Xuất dùng' : 'Hết hàng'} disabled={item.quantityOnHand <= 0} onClick={() => setDialog({ kind: 'use', item })}>
                          <PackageMinus size={16} />
                        </Button>
                      )}
                      {canReceive && (
                        <Button variant="ghost" size="icon" title="Nhập hàng" onClick={() => setDialog({ kind: 'receive', item })}>
                          <ArrowDownToLine size={16} />
                        </Button>
                      )}
                      {canRequest && (
                        <Button variant="ghost" size="icon" title="Đề xuất thêm" onClick={() => setDialog({ kind: 'request', item })}>
                          <PackagePlus size={16} />
                        </Button>
                      )}
                      {canManage && (
                        <ActionMenu
                          items={[
                            { label: 'Sửa', onSelect: () => setDialog({ kind: 'item', item }) },
                            { label: 'Xóa', danger: true, onSelect: () => setDialog({ kind: 'delete', item }) },
                          ]}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4">
            <section className={cn('rounded-2xl p-4 ring-1', low.length ? 'bg-red-50/70 shadow-[0_18px_40px_-28px_rgba(185,28,28,0.55)] ring-red-100' : 'bg-white shadow-card ring-gray-200/80')}>
              <h2 className="flex items-center justify-between text-sm font-semibold text-gray-900">
                Sắp hết <span className={cn('font-mono text-lg', low.length ? 'text-red-700' : 'text-gray-400')}>{low.length}</span>
              </h2>
              {low.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">Chưa có vật tư nào sắp hết.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {low.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-red-100">
                      <button type="button" onClick={() => setOpenId(item.id)} className="min-w-0 truncate text-left text-sm font-medium text-gray-900 hover:underline">
                        {item.name}
                      </button>
                      <span className="shrink-0 font-mono text-xs text-red-700">{formatAmount(item.quantityOnHand, item.unit)}</span>
                      {canRequest && (
                        <Button variant="inline" size="sm" onClick={() => setDialog({ kind: 'request', item })}>
                          Đề xuất thêm
                        </Button>
                      )}
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
                  <p className="font-mono text-xl font-bold text-gray-900">{all.filter((item) => item.category === value).length}</p>
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
          showPrice={showPrice}
          onReceive={canReceive ? () => setDialog({ kind: 'receive', item: opened }) : undefined}
          onUse={canUse(opened) && opened.quantityOnHand > 0 ? () => setDialog({ kind: 'use', item: opened }) : undefined}
          onRequest={canRequest ? () => setDialog({ kind: 'request', item: opened }) : undefined}
          onEdit={canManage ? () => setDialog({ kind: 'item', item: opened }) : undefined}
          onChanged={afterItemChange}
        />
      )}

      {dialog?.kind === 'item' && <SupplyItemDialog item={dialog.item} onClose={() => setDialog(null)} onDone={afterItemChange} />}
      {dialog?.kind === 'receive' && <ReceiveDialog item={dialog.item} onClose={() => setDialog(null)} onDone={afterItemChange} />}
      {dialog?.kind === 'use' && <UsageDialog item={dialog.item} onClose={() => setDialog(null)} onDone={afterItemChange} />}
      {dialog?.kind === 'request' && (
        <SupplyRequestDialog
          items={all}
          item={dialog.item}
          request={dialog.request}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            reloadRequests();
          }}
        />
      )}
      {dialog?.kind === 'reject' && <RejectRequestDialog request={dialog.request} onClose={() => setDialog(null)} onDone={reloadRequests} />}
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title={dialog?.kind === 'delete' ? `Xóa ${dialog.item.name}` : 'Xóa vật tư'}
        message="Vật tư sẽ ẩn khỏi kho. Khẩu phần và đề xuất cũ không bị ảnh hưởng."
        confirmLabel="Xóa"
        pending={remove.pending}
        onClose={() => {
          remove.clearError();
          setDialog(null);
        }}
        onConfirm={() =>
          dialog?.kind === 'delete' &&
          void remove.run(
            () => deleteSupplyItem(dialog.item.id),
            () => {
              toast.push(`Đã xóa ${dialog.item.name}`, 'success');
              if (openId === dialog.item.id) setOpenId(null);
              setDialog(null);
              afterItemChange();
            },
          )
        }
      >
        {remove.error && <ErrorBox message={remove.error} />}
      </ConfirmDialog>
      {dialog?.kind === 'fulfill' && (
        <FulfillRequestDialog
          request={dialog.request}
          onClose={() => setDialog(null)}
          onDone={() => {
            reloadRequests();
            afterItemChange();
          }}
        />
      )}
    </div>
  );
}

/* ===== Đề xuất ===== */

function RequestsPanel({ manager, version, onDialog }: { manager: boolean; version: number; onDialog: (dialog: Dialog) => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<SupplyRequestStatus | 'ALL'>(manager ? 'PENDING' : 'ALL');
  const [approved, setApproved] = useState(0);
  const list = useService(() => listSupplyRequests(status === 'ALL' ? undefined : status), [status, version, approved]);
  const approve = useAction();
  const rows = list.data ?? [];

  return (
    <TabPanel className="space-y-3 bg-gray-50/60 p-4">
      <ChipFilter
        value={status}
        onChange={setStatus}
        options={[
          ...(manager ? (['PENDING', 'APPROVED', 'FULFILLED', 'REJECTED'] as const) : []).map((value) => ({ value, label: supplyRequestStatusText[value] })),
          { value: 'ALL' as const, label: 'Tất cả' },
        ]}
      />
      {approve.error && <ErrorBox message={approve.error} />}
      {list.loading && !list.data ? (
        <Skeleton rows={3} />
      ) : list.error ? (
        <ErrorBox message={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState title={status === 'PENDING' ? 'Không có đề xuất nào chờ duyệt' : 'Chưa có đề xuất nào'} hint={manager ? undefined : 'Đề xuất bạn gửi hiện ở đây kèm kết quả duyệt.'} />
      ) : (
        rows.map((request) => (
          <article key={request.id} className={cn('rounded-2xl bg-white p-4 ring-1 ring-gray-200/80', request.status === 'PENDING' ? 'shadow-[inset_3px_0_0_0_#f59e0b]' : 'shadow-card')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  {request.item.name} <span className="font-mono text-emerald-800">+{formatAmount(request.quantity, request.item.unit)}</span>
                </p>
                <p className="text-xs text-gray-500" title={formatDateTime(request.createdAt)}>
                  {manager ? `${request.requester.fullName} · ` : ''}
                  {formatRelative(request.createdAt, now())} · kho đang còn {formatAmount(request.item.quantityOnHand, request.item.unit)}
                  {request.item.deletedAt ? ' · vật tư đã xóa' : ''}
                </p>
              </div>
              <Pill tone={REQUEST_TONE[request.status]}>{supplyRequestStatusText[request.status]}</Pill>
            </div>
            {request.note && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{request.note}</p>}
            {request.status === 'REJECTED' && request.rejectionReason && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
                Lý do từ chối: {request.rejectionReason}
                {request.reviewer && <span className="text-xs text-red-700/80"> · {request.reviewer.fullName}</span>}
              </p>
            )}
            {request.status === 'APPROVED' && request.reviewer && <p className="mt-2 text-xs text-gray-500">{request.reviewer.fullName} đã duyệt, chờ cấp</p>}
            {request.status === 'FULFILLED' && (
              <p className="mt-2 text-xs text-gray-500">
                {request.fulfiller ? `${request.fulfiller.fullName} đã cấp` : 'Đã cấp'} {request.fulfilledAt ? formatRelative(request.fulfilledAt, now()) : ''}
              </p>
            )}
            {(manager || request.status === 'PENDING') && request.status !== 'REJECTED' && request.status !== 'FULFILLED' && (
              <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                {manager && request.status === 'PENDING' && (
                  <>
                    <Button variant="inlineDanger" size="sm" onClick={() => onDialog({ kind: 'reject', request })}>
                      Từ chối
                    </Button>
                    <Button
                      size="sm"
                      disabled={approve.pending}
                      onClick={() =>
                        void approve.run(
                          () => reviewSupplyRequest(request.id, 'APPROVED'),
                          () => {
                            toast.push(`Đã duyệt đề xuất ${request.item.name}`, 'success');
                            setApproved((key) => key + 1);
                          },
                        )
                      }
                    >
                      Duyệt
                    </Button>
                  </>
                )}
                {manager && request.status === 'APPROVED' && (
                  <Button size="sm" onClick={() => onDialog({ kind: 'fulfill', request })}>
                    Cấp hàng
                  </Button>
                )}
                {!manager && request.status === 'PENDING' && (
                  <Button variant="secondary" size="sm" onClick={() => onDialog({ kind: 'request', request })}>
                    Sửa
                  </Button>
                )}
              </div>
            )}
          </article>
        ))
      )}
    </TabPanel>
  );
}
