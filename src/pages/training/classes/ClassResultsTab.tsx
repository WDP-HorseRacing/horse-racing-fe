// Tab Kết quả: lưới ngựa theo buổi đã diễn ra. Ô tô đậm nhạt theo điểm đánh giá của HLV,
// buổi chạy thử hiện thời gian tốt nhất và chênh lệch với mục tiêu. Mỗi ngựa một lần gọi lịch tập của ngựa trong lớp.
import { Link } from 'react-router-dom';
import { getTimeTrial, listHorseSessions } from '../../../api/training';
import type { HorseTrainingSession } from '../../../api/types';
import { EmptyState, ErrorBox, Notice, Skeleton, cn } from '../../../components/ui';
import { useService } from '../../../hooks/useService';
import { useStore } from '../../../store/store';
import { formatDate } from '../../../lib/format';
import { formatDelta, formatRaceTime } from '../../../lib/training-format';
import { participantStatusText } from '../../../lib/training-labels';
import { links } from '../../../lib/links';
import { useHorseIndex } from '../hooks';
import type { ClassBundle } from './class-bundle';

const SCORE_FILL = (score: number) =>
  score >= 9 ? 'bg-emerald-700 text-white' : score >= 7 ? 'bg-emerald-500 text-white' : score >= 5 ? 'bg-emerald-200 text-emerald-950' : 'bg-amber-100 text-amber-900';

export default function ClassResultsTab({ bundle }: { bundle: ClassBundle }) {
  const user = useStore((state) => state.currentUser);
  const { item, sessions, enrollments } = bundle;
  const { index } = useHorseIndex();
  const held = sessions.filter((session) => session.status === 'COMPLETED' || session.status === 'IN_PROGRESS').sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt));
  const horseIds = [...new Set(enrollments.map((enrollment) => enrollment.horseId))];
  const groom = user?.role === 'GROOM';

  const data = useService(async () => {
    if (groom || held.length === 0) return { rows: new Map<string, HorseTrainingSession[]>(), targets: new Map<string, number | null>() };
    const [rows, targets] = await Promise.all([
      Promise.all(horseIds.map(async (horseId) => [horseId, (await listHorseSessions(horseId, { classId: item.id, limit: 100 })).items] as const)),
      Promise.all(
        held
          .filter((session) => session.sessionType === 'TIME_TRIAL')
          .map(async (session) => [session.id, (await getTimeTrial(session.id).catch(() => null))?.targetTimeMs ?? null] as const),
      ),
    ]);
    return { rows: new Map(rows), targets: new Map(targets) };
  }, [item.id, horseIds.join(','), held.map((session) => session.id).join(',')]);

  if (groom) return <Notice tone="info">Kết quả và nhận xét của lớp dành cho huấn luyện viên trưởng, bác sĩ, quản lý và chủ ngựa.</Notice>;
  if (held.length === 0) return <EmptyState title="Chưa có buổi nào diễn ra" hint="Kết quả hiện ở đây sau khi ngựa hoàn thành lượt tập." />;
  if (data.loading && !data.data) return <Skeleton rows={4} />;
  if (data.error) return <ErrorBox message={data.error} />;

  return (
    <div className="overflow-x-auto" data-lenis-prevent-wheel>
      <table className="w-full min-w-[40rem] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-1 bg-white px-2 py-1 text-left text-xs font-semibold text-gray-500">Ngựa</th>
            {held.map((session) => (
              <th key={session.id} className="px-1 py-1 text-center text-xs font-medium text-gray-500">
                <Link to={links.session(session.id)} className="hover:text-emerald-800">
                  <span className="block font-mono">{formatDate(session.scheduledStartAt).slice(0, 5)}</span>
                  <span className="block max-w-28 truncate">{session.name}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horseIds.map((horseId) => {
            const list = data.data?.rows.get(horseId) ?? [];
            return (
              <tr key={horseId}>
                <td className="sticky left-0 z-1 bg-white px-2 py-1 font-semibold text-gray-900">
                  <Link to={links.horse(horseId, 'training')} className="hover:text-emerald-800">
                    {index.get(horseId)?.name ?? 'Ngựa'}
                  </Link>
                </td>
                {held.map((session) => {
                  const entry = list.find((row) => row.sessionId === session.id);
                  if (!entry) return <td key={session.id} className="rounded-lg bg-gray-50 text-center text-xs text-gray-300">·</td>;
                  const best = entry.trialResults.length ? Math.min(...entry.trialResults.map((trial) => trial.elapsedMs)) : undefined;
                  const target = data.data?.targets.get(session.id);
                  const score = entry.evaluation?.score;
                  return (
                    <td key={session.id} className="p-0">
                      <Link
                        to={links.participant(entry.participantId, horseId)}
                        title={entry.evaluation?.comment ?? participantStatusText[entry.participantStatus]}
                        className={cn(
                          'flex h-14 min-w-24 flex-col items-center justify-center rounded-lg px-2 text-center transition hover:ring-2 hover:ring-emerald-400',
                          score !== undefined ? SCORE_FILL(score) : entry.participantStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-900' : 'bg-gray-50 text-gray-500',
                        )}
                      >
                        {score !== undefined ? <span className="font-mono text-lg font-bold leading-none">{score}</span> : <span className="text-[11px]">{participantStatusText[entry.participantStatus]}</span>}
                        {best !== undefined && (
                          <span className="mt-0.5 font-mono text-[11px] leading-none">
                            {formatRaceTime(best)}
                            {target ? ` ${formatDelta(best - target).replace(' giây', 's')}` : ''}
                          </span>
                        )}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-gray-500">Số là điểm đánh giá của HLV (1 đến 10). Ô đậm hơn là điểm cao hơn. Bấm ô để xem chi tiết lượt tập.</p>
    </div>
  );
}
