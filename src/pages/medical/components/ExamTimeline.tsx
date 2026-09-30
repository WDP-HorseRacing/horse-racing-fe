// Dòng thời gian các buổi khám — thẻ chỉ đọc, không có nút sửa/xóa.
// Thẻ trắng viền xám; chấm mốc xám, chỉ buổi chuyển ngựa sang Chấn thương / Cách ly mới có chấm đỏ.
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, FilePenLine, FolderOpen, Link2 } from 'lucide-react';
import { Button, cn } from '../../../components/ui';
import { UrgencyPill } from '../../../components/ui/status';
import { formatDate, formatDateTime, formatNumber } from '../../../lib/format';
import { links } from '../../../lib/links';
import type { ExamCard } from '../../../services/medical.service';
import { HealthShift, HorseChip } from './parts';

function metricValue(value: number, type: string): string {
  if (type === 'TEMPERATURE') return formatNumber(value, 1);
  return Number.isInteger(value) ? String(value) : formatNumber(value, 1);
}

/** Buổi khám chuyển ngựa sang trạng thái nghiêm trọng (Chấn thương / Cách ly). */
function turnsSevere(exam: ExamCard): boolean {
  const severe = (status: string) => status === 'INJURED' || status === 'QUARANTINED';
  return severe(exam.healthStatusAfter) && !severe(exam.healthStatusBefore);
}

export function ExamCardView({
  exam,
  showHorse = false,
  showCase = false,
  onCorrect,
  compact = false,
}: {
  exam: ExamCard;
  showHorse?: boolean;
  showCase?: boolean;
  onCorrect?: () => void;
  compact?: boolean;
}) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-semibold text-gray-900 tabular-nums">{formatDateTime(exam.examinedAt)}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">BS. {exam.vetName}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
            <span>{exam.kindLabel}</span>
            {exam.opensCase && (
              <>
                <span className="text-gray-400">·</span>
                <span>buổi mở bệnh án</span>
              </>
            )}
            {showCase && exam.caseId && (
              <>
                <span className="text-gray-400">·</span>
                <Link to={links.case(exam.caseId)} className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline">
                  <FolderOpen size={12} /> {exam.caseTitle}
                </Link>
              </>
            )}
          </p>
        </div>
        {showHorse ? <HorseChip horse={exam.horse} size={32} /> : <HealthShift from={exam.healthStatusBefore} to={exam.healthStatusAfter} />}
      </header>

      {exam.metrics.length > 0 && (
        <p className="mt-3 text-sm text-gray-600">
          {exam.metrics.map((metric, index) => (
            <Fragment key={metric.type}>
              {index > 0 && <span className="text-gray-400"> · </span>}
              <span
                className={cn(metric.abnormal && 'font-medium text-amber-800')}
                title={metric.abnormal ? 'Ngoài khoảng bình thường' : undefined}
              >
                {metric.label}{' '}
                <span className={cn('font-medium tabular-nums', metric.abnormal ? 'text-amber-800' : 'text-gray-900')}>
                  {metricValue(metric.value, metric.type)} {metric.unit}
                </span>
                {metric.abnormal && ' (bất thường)'}
              </span>
            </Fragment>
          ))}
        </p>
      )}

      <div className="mt-4">
        <p className="text-xs text-gray-500">Chẩn đoán và hướng điều trị</p>
        <p className={cn('mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-800', compact && 'line-clamp-3')}>
          {exam.diagnosisAndTreatment}
        </p>
      </div>

      {(showHorse || exam.nextAppointment) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
          {showHorse && <HealthShift from={exam.healthStatusBefore} to={exam.healthStatusAfter} />}
          {exam.nextAppointment && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={13} className="text-gray-400" /> Hẹn khám tiếp {formatDate(exam.nextAppointment)}
            </span>
          )}
        </div>
      )}

      {!compact && exam.linkedRequests.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Link2 size={12} className="text-gray-400" /> Yêu cầu khám được gắn ({exam.linkedRequests.length})
          </p>
          {exam.linkedRequests.map((request) => (
            <div key={request.id} className="flex flex-wrap items-start gap-2 text-xs text-gray-500">
              {request.urgency === 'URGENT' && <UrgencyPill urgency={request.urgency} />}
              <span className="min-w-0 flex-1">
                <span className="font-medium text-gray-700">{request.sourceLabel}</span> · {request.createdByName} ·{' '}
                {formatDateTime(request.createdAt)}
                <span className="block whitespace-pre-line text-gray-600">{request.description}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {exam.corrections.length > 0 && (
        <div className="mt-4 space-y-2">
          {exam.corrections.map((item, index) => (
            <div key={index} className="border-l-2 border-gray-300 pl-3 text-sm italic text-gray-600">
              <p className="text-xs not-italic text-gray-500">
                Ghi chú đính chính · {item.byName} · {formatDateTime(item.at)}
              </p>
              <p className="mt-0.5 whitespace-pre-line">{item.note}</p>
            </div>
          ))}
        </div>
      )}

      {onCorrect && exam.canCorrect && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" onClick={onCorrect}>
            <FilePenLine size={14} /> Thêm ghi chú đính chính
          </Button>
        </div>
      )}
    </article>
  );
}

/** Danh sách buổi khám dạng trục thời gian dọc. */
export function ExamTimeline({
  exams,
  showHorse,
  showCase,
  onCorrect,
  compact,
}: {
  exams: ExamCard[];
  showHorse?: boolean;
  showCase?: boolean;
  onCorrect?: (exam: ExamCard) => void;
  compact?: boolean;
}) {
  return (
    <ol className="relative space-y-4 pl-6 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-gray-200">
      {exams.map((exam) => {
        const severe = turnsSevere(exam);
        return (
          <li key={exam.id} className="relative">
            <span
              title={severe ? 'Buổi khám chuyển ngựa sang trạng thái nghiêm trọng' : undefined}
              className={cn(
                'absolute -left-6 top-6 h-[11px] w-[11px] rounded-full ring-[3px] ring-canvas',
                severe ? 'bg-red-500' : 'bg-gray-300',
              )}
            />
            <ExamCardView
              exam={exam}
              showHorse={showHorse}
              showCase={showCase}
              compact={compact}
              onCorrect={onCorrect ? () => onCorrect(exam) : undefined}
            />
          </li>
        );
      })}
    </ol>
  );
}
