// Ngăn chi tiết một vật tư: tồn so với ngưỡng, các lô hàng (lô cũ dùng trước), nút thao tác theo vai trò và sổ nhập xuất.
// Sổ chỉ thêm, không sửa: tồn ban đầu, nhập hàng, cấp theo đề xuất, xuất dùng, hủy lần xuất. Một lần xuất trừ nhiều lô thì BE ghi
// mỗi lô một dòng (chung mã lần xuất), ở đây gộp lại thành một dòng. Tiền (đơn giá, thành tiền, giá trị tồn) chỉ hiện khi showPrice.
// Hủy lần xuất ghi nhầm: người xuất trong 24 giờ, Quản lý CLB bất kỳ lúc nào. Lần đã hủy gạch ngang, dòng hoàn trả ghi lý do.
import { useMemo, useState } from 'react';
import { ArrowDownToLine, PackageMinus, PackagePlus, Pencil, Undo2 } from 'lucide-react';
import { cancelSupplyUsage, listSupplyLots, listSupplyMovements } from '../../../api/supplies';
import type { SupplyItem, SupplyLot, SupplyMovement } from '../../../api/types';
import { Button, EmptyState, ErrorBox, Meter, Pill, Sheet, Skeleton, cn, useToast } from '../../../components/ui';
import { useAction, useService } from '../../../hooks/useService';
import { useStore } from '../../../store/store';
import { ReasonDialog } from '../../training/components/ReasonDialog';
import { now } from '../../../lib/clock';
import { formatDate, formatDateTime, formatMoney, formatRelative } from '../../../lib/format';
import { formatAmount, formatQuantity, movementTypeText, supplyCategoryText } from '../../../lib/stable-labels';
import { stockTone } from '../care-helpers';

/** Một dòng sổ đã gộp: nhiều dòng xuất dùng của cùng một lần lấy (khác lô) thành một. */
interface LedgerRow extends SupplyMovement {
  lots: number;
}

const USAGE_CANCEL_MS = 24 * 60 * 60 * 1000;

/**
 * Gộp các dòng của một lần lấy trừ nhiều lô: cùng mã lần xuất (cả dòng xuất và dòng hủy).
 * Dòng cũ chưa có mã: liền nhau cùng người, cùng ghi chú, cách nhau dưới 2 giây.
 */
function groupUsages(rows: SupplyMovement[]): LedgerRow[] {
  const grouped: LedgerRow[] = [];
  for (const row of rows) {
    const last = grouped.at(-1);
    const sameUsage =
      last &&
      last.type === row.type &&
      (row.type === 'USAGE' || row.type === 'USAGE_REVERSAL') &&
      (row.usageId || last.usageId
        ? last.usageId === row.usageId
        : last.creator.id === row.creator.id &&
          (last.note ?? '') === (row.note ?? '') &&
          Math.abs(new Date(last.createdAt).getTime() - new Date(row.createdAt).getTime()) < 2000);
    if (sameUsage) {
      last.delta = Math.round((last.delta + row.delta) * 100) / 100;
      // Sổ mới nhất trước: dòng đầu nhóm có tồn sau cùng, giữ nguyên.
      last.amount = last.amount === null || row.amount === null ? null : last.amount + row.amount;
      last.unitPrice = last.unitPrice === row.unitPrice ? last.unitPrice : null;
      last.lots += 1;
    } else {
      grouped.push({ ...row, lots: 1 });
    }
  }
  return grouped;
}

const DOT: Record<SupplyMovement['type'], string> = {
  RESTOCK: 'bg-emerald-600',
  USAGE: 'bg-amber-500',
  USAGE_REVERSAL: 'bg-sky-500',
  OPENING: 'bg-gray-400',
  COUNT_ADJUST: 'bg-gray-300',
};

export function SupplyItemSheet({
  item,
  showPrice,
  onClose,
  onReceive,
  onUse,
  onRequest,
  onEdit,
  onChanged,
}: {
  item: SupplyItem;
  /** Quản lý CLB: hiện đơn giá, thành tiền, giá trị tồn. */
  showPrice: boolean;
  onClose: () => void;
  onReceive?: () => void;
  onUse?: () => void;
  onRequest?: () => void;
  onEdit?: () => void;
  /** Tồn đổi do hủy lần xuất: nơi dùng tải lại danh sách vật tư. */
  onChanged?: () => void;
}) {
  const toast = useToast();
  const user = useStore((state) => state.currentUser);
  const manager = user?.role === 'CLUB_MANAGER';
  const [cancelling, setCancelling] = useState<LedgerRow | null>(null);
  const cancel = useAction();
  const [pages, setPages] = useState(1);
  const [showEmptyLots, setShowEmptyLots] = useState(false);
  // Đổi tồn (nhập, xuất, cấp vừa lưu) thì tải lại sổ và lô.
  const ledger = useService(async () => {
    const results = await Promise.all(Array.from({ length: pages }, (_, index) => listSupplyMovements(item.id, index + 1, 20)));
    return { items: results.flatMap((page) => page.items), total: results[0]?.meta.total ?? 0 };
  }, [item.id, item.quantityOnHand, pages, cancel.pending]);
  const lots = useService(() => listSupplyLots(item.id), [item.id, item.quantityOnHand]);
  const rows = useMemo(() => groupUsages(ledger.data?.items ?? []), [ledger.data]);

  const allLots: SupplyLot[] = lots.data ?? [];
  const openLots = allLots.filter((lot) => lot.remaining > 0);
  const emptyLots = allLots.filter((lot) => lot.remaining <= 0);
  const stockValue = openLots.reduce((sum, lot) => sum + lot.remaining * lot.unitPrice, 0);
  const unpriced = openLots.some((lot) => lot.unitPrice === 0);
  /** Hủy được: lần xuất có mã, chưa hủy; người khác Quản lý CLB chỉ hủy lần mình xuất trong 24 giờ. */
  const cancellable = (row: LedgerRow) =>
    row.type === 'USAGE' &&
    !!row.usageId &&
    !row.cancelled &&
    (manager || (row.creator.id === user?.id && now().getTime() - new Date(row.createdAt).getTime() < USAGE_CANCEL_MS));

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
          {onUse && (
            <Button variant="secondary" onClick={onUse}>
              <PackageMinus size={15} /> Xuất dùng
            </Button>
          )}
          {onReceive && (
            <Button onClick={onReceive}>
              <ArrowDownToLine size={15} /> Nhập hàng
            </Button>
          )}
          {onRequest && (
            <Button onClick={onRequest}>
              <PackagePlus size={15} /> Đề xuất thêm
            </Button>
          )}
        </>
      }
    >
      <section className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-4 ring-1 ring-emerald-100">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">Còn</p>
            <p className="font-mono text-3xl font-bold tabular-nums text-gray-900">
              {formatQuantity(item.quantityOnHand)} <span className="text-base font-medium text-gray-500">{item.unit}</span>
            </p>
          </div>
          {item.lowStock && <Pill tone="red">Sắp hết</Pill>}
        </div>
        <Meter className="mt-3" value={item.quantityOnHand} max={Math.max(item.reorderThreshold * 3, item.quantityOnHand, 1)} tone={stockTone(item)} />
        <p className="mt-2 text-xs text-gray-500">Báo thiếu khi còn {formatAmount(item.reorderThreshold, item.unit)} hoặc ít hơn.</p>
        {showPrice && lots.data && openLots.length > 0 && (
          <p className="mt-2 text-sm text-gray-700">
            Giá trị tồn <span className="font-semibold tabular-nums text-gray-900">{formatMoney(Math.round(stockValue))}</span>
            {unpriced && <span className="text-xs text-gray-500"> (có lô chưa có giá)</span>}
          </p>
        )}
      </section>

      <h3 className="mb-2 mt-6 flex items-baseline justify-between text-sm font-semibold text-gray-900">
        Lô hàng
        <span className="text-xs font-normal text-gray-500">Lô nhập trước dùng trước</span>
      </h3>
      {lots.loading && !lots.data ? (
        <Skeleton rows={2} />
      ) : lots.error ? (
        <ErrorBox message={lots.error} />
      ) : allLots.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có lô nào.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {[...openLots, ...(showEmptyLots ? emptyLots : [])].map((lot) => (
              <LotRow key={lot.id} lot={lot} unit={item.unit} next={lot.id === openLots[0]?.id} showPrice={showPrice} />
            ))}
          </ul>
          {openLots.length === 0 && !showEmptyLots && <p className="text-sm text-gray-500">Các lô đều đã dùng hết.</p>}
          {emptyLots.length > 0 && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowEmptyLots((value) => !value)}>
              {showEmptyLots ? 'Ẩn lô đã hết' : `Xem lô đã hết (${emptyLots.length})`}
            </Button>
          )}
        </>
      )}

      <h3 className="mb-2 mt-6 text-sm font-semibold text-gray-900">Sổ nhập xuất</h3>
      {ledger.loading && !ledger.data ? (
        <Skeleton rows={4} />
      ) : ledger.error ? (
        <ErrorBox message={ledger.error} />
      ) : rows.length === 0 ? (
        <EmptyState title="Chưa có lần nhập xuất nào" className="py-6" />
      ) : (
        <>
          <ol className="relative space-y-3 border-l border-gray-200 pl-4">
            {rows.map((row) => (
              <li key={row.id} className="relative">
                <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', row.cancelled ? 'bg-gray-300' : DOT[row.type])} aria-hidden />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className={cn('text-sm font-medium text-gray-900', row.cancelled && 'text-gray-400 line-through decoration-gray-400')}>
                    {row.type === 'RESTOCK' && row.requestId ? 'Cấp hàng' : movementTypeText[row.type]}{' '}
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
                {showPrice && row.amount !== null && (
                  <p className="text-xs tabular-nums text-gray-600">
                    {row.lots > 1 ? `Trừ ${row.lots} lô` : row.unitPrice !== null ? `${formatMoney(row.unitPrice)}/${item.unit}` : ''}
                    {' · '}
                    <span className={row.amount < 0 ? 'text-amber-800' : 'text-emerald-800'}>
                      {row.amount < 0 ? '−' : '+'}
                      {formatMoney(Math.abs(row.amount))}
                    </span>
                  </p>
                )}
                {row.note && <p className="mt-0.5 text-xs text-gray-600">{row.type === 'USAGE_REVERSAL' ? `Lý do hủy: ${row.note}` : row.note}</p>}
                {row.cancelled && <p className="mt-0.5 text-xs font-medium text-gray-500">Lần xuất này đã hủy, số lượng đã cộng trả vào kho.</p>}
                {cancellable(row) && (
                  <Button variant="inline" size="sm" className="mt-1" onClick={() => setCancelling(row)}>
                    <Undo2 size={13} /> Hủy lần xuất
                  </Button>
                )}
              </li>
            ))}
          </ol>
          {(ledger.data?.items.length ?? 0) < (ledger.data?.total ?? 0) && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setPages((count) => count + 1)} disabled={ledger.loading}>
              Xem thêm
            </Button>
          )}
        </>
      )}
      {cancelling && cancelling.usageId && (
        <ReasonDialog
          title="Hủy lần xuất"
          message={
            <>
              Cộng trả <b>{formatAmount(Math.abs(cancelling.delta), item.unit)}</b> vào đúng các lô đã trừ. Lần xuất bị gạch trong sổ và không tính vào giá trị đã dùng. Muốn sửa số lượng thì hủy rồi xuất lại số đúng.
            </>
          }
          label="Lý do hủy"
          suggestions={['Ghi nhầm số lượng', 'Ghi nhầm vật tư', 'Bấm trùng hai lần']}
          confirmLabel="Hủy lần xuất"
          pending={cancel.pending}
          error={cancel.error}
          onClose={() => {
            setCancelling(null);
            cancel.clearError();
          }}
          onConfirm={(reason) =>
            void cancel.run(
              () => cancelSupplyUsage(cancelling.usageId!, reason),
              () => {
                toast.push('Đã hủy lần xuất, tồn đã cộng trả', 'success');
                setCancelling(null);
                onChanged?.();
              },
            )
          }
        />
      )}
    </Sheet>
  );
}

function LotRow({ lot, unit, next, showPrice }: { lot: SupplyLot; unit: string; next: boolean; showPrice: boolean }) {
  const empty = lot.remaining <= 0;
  return (
    <li className={cn('rounded-xl px-3 py-2 ring-1', empty ? 'bg-gray-50 opacity-60 ring-gray-100' : next ? 'bg-white shadow-grass-tint ring-emerald-200' : 'bg-white ring-gray-200/80')}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm text-gray-900">
          <span className="font-medium">Nhập {formatDate(lot.createdAt)}</span>
          {next && <span className="ml-2 text-xs text-emerald-700">dùng trước</span>}
        </p>
        <p className="font-mono text-sm tabular-nums text-gray-900">
          {formatQuantity(lot.remaining)}
          <span className="text-xs text-gray-500">
            {' '}
            / {formatQuantity(lot.quantity)} {unit}
          </span>
        </p>
      </div>
      {showPrice && <p className="text-xs text-gray-500">{lot.unitPrice > 0 ? `${formatMoney(lot.unitPrice)}/${unit}` : 'Chưa có giá'}</p>}
      <Meter className="mt-1.5" value={lot.remaining} max={Math.max(lot.quantity, 0.01)} tone="green" />
    </li>
  );
}
