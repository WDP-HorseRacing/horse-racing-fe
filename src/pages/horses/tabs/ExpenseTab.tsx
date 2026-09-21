import { Wallet } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { getHorseExpenses } from '../../../services/race.service';
import { useStore } from '../../../store/store';
import { Card, EmptyState, Pill, SectionTitle, Skeleton } from '../../../components/ui';
import { expenseCategoryLabel } from '../../../lib/labels';
import { formatDate, formatMoney } from '../../../lib/format';

export default function ExpenseTab({ horseId }: { horseId: string }) {
  const currentUser = useStore((state) => state.currentUser);
  const isOwner = currentUser?.role === 'HORSE_OWNER';
  const { data, loading } = useService(() => getHorseExpenses(horseId), [horseId]);

  if (loading) return <Skeleton rows={3} />;
  if (!data) return <EmptyState title="Chưa có dữ liệu chi phí" />;

  const total = data.expenses.reduce((sum, item) => sum + item.amount, 0) + data.boardingThisMonth;
  const totalPrize = data.prizes.reduce((sum, item) => sum + item.prize, 0);

  return (
    <div className="space-y-5">
      {isOwner && (
        <Card tone="success">
          <p className="text-sm text-gray-700">
            Bạn sở hữu <strong>{data.percent}%</strong> con ngựa này. Cột &ldquo;phần của tôi&rdquo; đã nhân theo tỉ lệ
            sở hữu và chỉ tính các khoản phát sinh trong thời gian bạn sở hữu.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-gray-400">Phí nuôi dưỡng</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatMoney(data.dailyRate)}</p>
          <p className="text-[11px] text-gray-400">mỗi ngày</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Nuôi dưỡng tháng này</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatMoney(data.boardingThisMonth)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Tổng chi phí</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatMoney(total)}</p>
        </Card>
        <Card tone="success">
          <p className="text-xs text-gray-400">Tiền thưởng</p>
          <p className="mt-1 text-lg font-bold text-emerald-700">{formatMoney(totalPrize)}</p>
        </Card>
      </div>

      <Card>
        <SectionTitle icon={<Wallet size={16} className="text-emerald-600" />}>Các khoản chi phí</SectionTitle>
        {data.expenses.length === 0 ? (
          <EmptyState title="Chưa có khoản chi phí nào" />
        ) : (
          <div className="max-h-96 space-y-1 overflow-y-auto custom-scrollbar">
            {data.expenses.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Pill tone="gray">{expenseCategoryLabel[item.category]}</Pill>
                    <span className="truncate">{item.note ?? ''}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{formatDate(item.date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatMoney(item.amount)}</p>
                  {isOwner && <p className="text-xs text-gray-400">phần của tôi {formatMoney(item.myAmount)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {data.prizes.length > 0 && (
        <Card>
          <SectionTitle>Tiền thưởng</SectionTitle>
          <div className="space-y-1">
            {data.prizes.map((item, index) => (
              <div key={index} className="flex items-center justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.raceName}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(item.date)} · hạng {item.rank}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-700 tabular-nums">{formatMoney(item.prize)}</p>
                  {isOwner && <p className="text-xs text-gray-400">phần của tôi {formatMoney(item.myPrize)}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
