// Lịch sử ngưỡng nhịp tim tối đa của một ngựa — panel trượt phải.
import { EmptyState, ErrorBox, Pill, Sheet, Skeleton } from '../../../components/ui';
import { useService } from '../../../hooks/useService';
import { getMaxHeartRate } from '../../../services/session.service';
import { formatDateTime } from '../../../lib/format';

export default function MaxHeartRateHistory({
  horseId,
  onClose,
}: {
  horseId?: string;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!horseId} onClose={onClose} title="Lịch sử nhịp tim tối đa" width="max-w-lg">
      {horseId && <HistoryBody horseId={horseId} />}
    </Sheet>
  );
}

function HistoryBody({ horseId }: { horseId: string }) {
  const { data, loading, error } = useService(() => getMaxHeartRate(horseId), [horseId]);
  if (loading && !data) return <Skeleton rows={3} />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được lịch sử'} />;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-emerald-50/60 p-5">
        <p className="text-sm text-gray-500">{data.horseName} · đang áp dụng</p>
        {data.current !== undefined ? (
          <p className="mt-1 text-4xl font-bold tabular-nums text-gray-900">
            {data.current}
            <span className="ml-1 text-sm font-medium text-gray-400">nhịp/phút</span>
          </p>
        ) : (
          <p className="mt-1 text-lg font-semibold text-amber-700">Chưa đặt — R1 không chạy</p>
        )}
      </div>
      {data.history.length === 0 ? (
        <EmptyState title="Chưa từng đặt ngưỡng" hint="Bác sĩ chưa đặt nhịp tim tối đa cho ngựa này." />
      ) : (
        <ol className="relative space-y-4 border-l border-emerald-900/10 pl-5">
          {data.history.map((item) => (
            <li key={item.id} className="relative">
              <span
                className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ${item.active ? 'bg-emerald-500' : 'bg-gray-300'}`}
              />
              <p className="flex items-center gap-2 text-sm font-semibold tabular-nums text-gray-900">
                {item.value} nhịp/phút {item.active && <Pill tone="green">Đang áp dụng</Pill>}
              </p>
              <p className="text-sm text-gray-600">{item.reason}</p>
              <p className="text-xs font-light text-gray-400">
                {item.createdByName} · {formatDateTime(item.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs font-light text-gray-400">
        Lần xóa ngưỡng được ghi trong nhật ký thao tác kèm lý do.
      </p>
    </div>
  );
}
