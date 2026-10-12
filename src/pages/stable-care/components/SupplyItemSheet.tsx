// Ngăn chi tiết một vật tư: tồn so với ngưỡng, lần kiểm kê gần nhất, các nút thao tác theo vai trò và sổ nhập xuất.
// Sổ chỉ thêm, không sửa: mỗi lần kiểm kê hoặc cấp theo đề xuất một dòng (chênh lệch, tồn sau, người làm).
import { useState } from 'react';
import { ClipboardCheck, PackagePlus, Pencil } from 'lucide-react';
import { listSupplyMovements } from '../../../api/supplies';
import type { SupplyItem, SupplyMovement } from '../../../api/types';
import { Button, EmptyState, ErrorBox, Meter, Pill, Sheet, Skeleton, cn } from '../../../components/ui';
import { useService } from '../../../hooks/useService';
import { now } from '../../../lib/clock';
import { formatDateTime, formatRelative } from '../../../lib/format';
import { formatAmount, formatQuantity, movementTypeText, supplyCategoryText } from '../../../lib/stable-labels';
import { stockTone } from '../care-helpers';

export function SupplyItemSheet({
  item,
  onClose,
  onCount,
  onRequest,
  onEdit,
}: {
  item: SupplyItem;
  onClose: () => void;
  onCount?: () => void;
  onRequest?: () => void;
  onEdit?: () => void;
}) {
  const [pages, setPages] = useState(1);
  // Đổi tồn (kiểm kê vừa lưu) thì tải lại sổ.
  const ledger = useService(async () => {
    const results = await Promise.all(Array.from({ length: pages }, (_, index) => listSupplyMovements(item.id, index + 1, 20)));
    return { items: results.flatMap((page) => page.items), total: results[0]?.meta.total ?? 0 };
  }, [item.id, item.quantityOnHand, pages]);
  const rows: SupplyMovement[] = ledger.data?.items ?? [];

  return (
    <Sheet
      open
      onClose={onClose}
      title={item.name}
      description={`${supplyCategoryText[item.category]} · đơn vị ${item.unit}`}
      footer={
        <>
          {onEdit && (
            <Button variant="ghost" onClick={onEdit}>
              <Pencil size={14} /> Sửa
            </Button>
          )}
          {onCount && (
            <Button variant="secondary" onClick={onCount}>
              <ClipboardCheck size={15} /> Kiểm kê
            </Button>
          )}
          {onRequest && (
            <Button onClick={onRequest}>
              <PackagePlus size={15} /> Đề xuất bổ sung
            </Button>
          )}
        </>
      }
    >
      <section className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-4 ring-1 ring-emerald-100">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">Đang có</p>
            <p className="font-mono text-3xl font-bold tabular-nums text-gray-900">
              {formatQuantity(item.quantityOnHand)} <span className="text-base font-medium text-gray-500">{item.unit}</span>
            </p>
          </div>
          {item.lowStock && <Pill tone="red">Sắp hết</Pill>}
        </div>
        <Meter className="mt-3" value={item.quantityOnHand} max={Math.max(item.reorderThreshold * 3, item.quantityOnHand, 1)} tone={stockTone(item)} />
        <p className="mt-2 text-xs text-gray-500">Báo thiếu khi còn {formatAmount(item.reorderThreshold, item.unit)} hoặc ít hơn.</p>
        <p className="mt-1 text-xs text-gray-500">
          {item.lastCountedAt ? `Kiểm kê ${formatRelative(item.lastCountedAt, now())} bởi ${item.lastCounter?.fullName ?? 'nhân viên'}` : 'Chưa kiểm kê lần nào'}
        </p>
      </section>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-gray-900">Sổ nhập xuất</h3>
      {ledger.loading && !ledger.data ? (
        <Skeleton rows={4} />
      ) : ledger.error ? (
        <ErrorBox message={ledger.error} />
      ) : rows.length === 0 ? (
        <EmptyState title="Chưa có dòng nào" hint="Mỗi lần kiểm kê hoặc cấp theo đề xuất sẽ ghi một dòng." className="py-6" />
      ) : (
        <>
          <ol className="relative space-y-3 border-l border-gray-200 pl-4">
            {rows.map((row) => (
              <li key={row.id} className="relative">
                <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', row.type === 'RESTOCK' ? 'bg-emerald-600' : 'bg-gray-400')} aria-hidden />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {movementTypeText[row.type]}{' '}
                    <span className={cn('font-mono tabular-nums', row.delta > 0 ? 'text-emerald-700' : row.delta < 0 ? 'text-amber-700' : 'text-gray-500')}>
                      {row.delta > 0 ? '+' : row.delta < 0 ? '−' : '±'}
                      {formatQuantity(Math.abs(row.delta))}
                    </span>
                  </p>
                  <span className="text-xs text-gray-500">còn {formatAmount(row.balanceAfter, item.unit)}</span>
                </div>
                <p className="text-xs text-gray-500" title={formatDateTime(row.createdAt)}>
                  {row.creator.fullName} · {formatRelative(row.createdAt, now())}
                </p>
                {row.note && <p className="mt-0.5 text-xs text-gray-600">{row.note}</p>}
              </li>
            ))}
          </ol>
          {rows.length < (ledger.data?.total ?? 0) && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setPages((count) => count + 1)} disabled={ledger.loading}>
              Xem thêm
            </Button>
          )}
        </>
      )}
    </Sheet>
  );
}
