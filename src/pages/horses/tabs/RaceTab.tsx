import { Trophy } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { getHorseRaceHistory, listRegistrations } from '../../../services/race.service';
import { Card, EmptyState, Pill, SectionTitle, Skeleton } from '../../../components/ui';
import { RegistrationPill } from '../../../components/ui/status';
import { formatDate, formatMoney } from '../../../lib/format';
import { surfaceLabel } from '../../../lib/labels';

export default function RaceTab({ horseId }: { horseId: string }) {
  const results = useService(() => getHorseRaceHistory(horseId), [horseId]);
  const registrations = useService(() => listRegistrations(), []);
  const mine = (registrations.data ?? []).filter((item) => item.horseId === horseId);

  if (results.loading) return <Skeleton rows={3} />;

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={<Trophy size={16} className="text-amber-500" />}>Đăng ký thi đấu</SectionTitle>
        {mine.length === 0 ? (
          <EmptyState title="Chưa có đăng ký nào" />
        ) : (
          <div className="space-y-1">
            {mine.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 py-3 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.raceName}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(item.raceDate)} · {item.distanceM} m
                    {item.cancelReason ? ` · ${item.cancelReason}` : ''}
                  </p>
                </div>
                <RegistrationPill status={item.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Thành tích thi đấu</SectionTitle>
        {(results.data?.length ?? 0) === 0 ? (
          <EmptyState title="Ngựa chưa có kết quả thi đấu nào" />
        ) : (
          <div className="space-y-1">
            {results.data?.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 py-3 last:border-0">
                <div className="flex items-center gap-3">
                  <Pill tone={item.rank <= 3 ? 'green' : 'gray'}>Hạng {item.rank}</Pill>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.raceName}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(item.date)} · {item.distanceM} m
                      {item.surface ? ` · ${surfaceLabel[item.surface]}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">{item.timeSeconds.toFixed(2)} s</p>
                  <p className="text-xs text-emerald-600">{item.prize > 0 ? formatMoney(item.prize) : 'Không có thưởng'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
