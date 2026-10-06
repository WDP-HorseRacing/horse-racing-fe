// Tab "Kết quả": ma trận ngựa × buổi đã qua (chỉ đọc).
import { Link } from 'react-router-dom';
import type { ClassResults } from '../../../services/training.service';
import { Avatar, Card, cn, EmptyState, Tip } from '../../../components/ui';
import { IntensityMeter } from '../../../components/ui/status';
import { absenceLabel, intensityLabel } from '../../../lib/labels';
import { formatDateShort, formatNumber, formatPercent } from '../../../lib/format';
import { links } from '../../../lib/links';

/** Điểm bình thường để chữ mực; chỉ điểm thấp (≤ 5) mới tô hổ phách để HT chú ý. */
function scoreTone(score: number) {
  return score <= 5 ? 'bg-amber-50 text-amber-800' : 'text-gray-900';
}

export function ClassResultsTab({ results, ownerFiltered }: { results?: ClassResults; ownerFiltered: boolean }) {
  if (!results) {
    return <EmptyState title="Bạn không xem được kết quả buổi tập" hint="Kết quả và nhận xét chỉ dành cho HT, bác sĩ, quản lý và chủ ngựa." />;
  }
  if (results.sessions.length === 0) {
    return <EmptyState title="Chưa có buổi nào diễn ra" hint="Kết quả sẽ hiện sau buổi học đầu tiên của lớp." />;
  }
  if (results.rows.length === 0) {
    return <EmptyState title="Chưa có ngựa nào" hint={ownerFiltered ? 'Không có ngựa của bạn trong lớp này.' : undefined} />;
  }

  return (
    <Card className="p-0 sm:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-sm text-gray-600">
          {results.sessions.length} buổi đã qua · ô là điểm đánh giá (thang 10); "Vắng" rê chuột để xem lý do
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-3 w-3 rounded bg-amber-100" /> điểm ≤ 5
        </span>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-gray-200">
              <th className="sticky left-0 z-10 min-w-[180px] bg-white px-5 py-2.5 text-left text-xs font-medium text-gray-500">Ngựa</th>
              {results.sessions.map((session) => (
                <th key={session.id} className="min-w-[64px] px-1.5 py-2 text-center align-bottom">
                  <Tip content={`${session.subjectName} · ${intensityLabel[session.intensity]}`}>
                    <Link to={links.session(session.id)} className="inline-flex flex-col items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-emerald-700">
                      <IntensityMeter intensity={session.intensity} showLabel={false} />
                      <span className="tabular-nums">{formatDateShort(session.date)}</span>
                    </Link>
                  </Tip>
                </th>
              ))}
              <th className="min-w-[90px] px-3 py-2.5 text-right text-xs font-medium text-gray-500">Có mặt</th>
              <th className="min-w-[90px] px-5 py-2.5 text-right text-xs font-medium text-gray-500">Điểm TB</th>
            </tr>
          </thead>
          <tbody>
            {results.rows.map((row) => (
              <tr key={row.horseId} className="border-b border-gray-100 last:border-0">
                <td className="sticky left-0 z-10 bg-white px-5 py-2.5">
                  <Link to={links.horse(row.horseId, 'training')} className="flex items-center gap-2.5">
                    <Avatar src={row.horseAvatar} name={row.horseName} size={30} />
                    <span className={cn('font-medium', row.withdrawn ? 'text-gray-400' : 'text-gray-900')}>{row.horseName}</span>
                    {row.withdrawn && <span className="text-[11px] text-gray-500">đã rút</span>}
                  </Link>
                </td>
                {results.sessions.map((session) => {
                  const cell = row.cells[session.id];
                  if (!cell) {
                    return (
                      <td key={session.id} className="px-1.5 py-2 text-center text-gray-200">
                        ·
                      </td>
                    );
                  }
                  if (cell.status === 'ABSENT') {
                    return (
                      <td key={session.id} className="px-1.5 py-2 text-center">
                        <Tip
                          content={
                            <span>
                              Vắng{cell.absenceReason ? `: ${absenceLabel[cell.absenceReason]}` : ''}
                              {cell.absenceNote ? `. ${cell.absenceNote}` : ''}
                            </span>
                          }
                        >
                          <span className="inline-flex h-7 min-w-[44px] cursor-help items-center justify-center rounded-md bg-amber-50 px-1.5 text-[11px] font-medium text-amber-800">
                            Vắng
                          </span>
                        </Tip>
                      </td>
                    );
                  }
                  return (
                    <td key={session.id} className="px-1.5 py-2 text-center">
                      {cell.score !== undefined ? (
                        <span
                          className={cn(
                            'inline-flex h-7 w-9 items-center justify-center rounded-md text-sm font-semibold tabular-nums',
                            scoreTone(cell.score),
                          )}
                        >
                          {cell.score}
                        </span>
                      ) : (
                        <Tip content={session.status === 'AWAITING_REVIEW' ? 'Có mặt, chờ HT đánh giá' : 'Có mặt, chưa có điểm'}>
                          <span className="inline-flex h-7 w-9 cursor-help items-center justify-center rounded-md text-[11px] text-gray-400">
                            ✓
                          </span>
                        </Tip>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.attendanceRate !== undefined ? (
                    <span className={cn('font-semibold', row.attendanceRate < 0.8 ? 'text-amber-700' : 'text-gray-800')}>
                      {formatPercent(row.attendanceRate)}
                    </span>
                  ) : (
                    '—'
                  )}
                  <span className="block text-[11px] text-gray-500">
                    {row.presentCount}/{row.presentCount + row.absentCount} buổi
                  </span>
                </td>
                <td className="px-5 py-2 text-right text-base font-bold text-gray-900 tabular-nums">
                  {row.avgScore !== undefined ? formatNumber(row.avgScore, 1) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
