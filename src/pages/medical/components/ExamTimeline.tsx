// Dòng thời gian các buổi khám — thẻ chỉ đọc, không có nút sửa/xóa.
import { Link } from 'react-router-dom';
import { CalendarClock, FilePenLine, FolderOpen, Link2 } from 'lucide-react';
import { Button, Pill, cn } from '../../../components/ui';
import { UrgencyPill } from '../../../components/ui/status';
import { formatDate, formatDateTime, formatNumber } from '../../../lib/format';
import { links } from '../../../lib/links';
import type { ExamCard } from '../../../services/medical.service';
import { HealthShift, HorseChip } from './parts';
import { healthSwatch } from './utils';

function metricValue(value: number, type: string): string {
  if (type === 'TEMPERATURE') return formatNumber(value, 1);
  return Number.isInteger(value) ? String(value) : formatNumber(value, 1);
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
    <article
      className={cn(
        'rounded-2xl bg-white p-5 ring-1 transition',
        exam.opensCase ? 'shadow-amber ring-amber-100' : 'shadow-grass ring-emerald-950/[0.05]',
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900 tabular-nums">{formatDateTime(exam.examinedAt)}</span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-600">BS. {exam.vetName}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Pill tone={exam.kind === 'PERIODIC' ? 'blue' : 'amber'}>{exam.kindLabel}</Pill>
            {exam.opensCase && <Pill tone="orange">Buổi mở bệnh án</Pill>}
            {showCase && exam.caseId && (
              <Link
                to={links.case(exam.caseId)}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-100 hover:bg-amber-100"
              >
                <FolderOpen size={11} /> {exam.caseTitle}
              </Link>
            )}
          </div>
        </div>
        {showHorse ? <HorseChip horse={exam.horse} size={32} /> : <HealthShift from={exam.healthStatusBefore} to={exam.healthStatusAfter} />}
      </header>

      {exam.metrics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {exam.metrics.map((metric) => (
            <span
              key={metric.type}
              className={cn(
                'inline-flex items-baseline gap-1.5 rounded-lg px-2.5 py-1 text-xs ring-1',
                metric.abnormal ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-gray-50 text-gray-600 ring-gray-100',
              )}
              title={metric.abnormal ? 'Ngoài khoảng bình thường' : undefined}
            >
              {metric.label}
              <span className="font-semibold tabular-nums text-gray-900">
                {metricValue(metric.value, metric.type)} {metric.unit}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium text-gray-400">Chẩn đoán và hướng điều trị</p>
        <p className={cn('mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-800', compact && 'line-clamp-3')}>
          {exam.diagnosisAndTreatment}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
        {showHorse && <HealthShift from={exam.healthStatusBefore} to={exam.healthStatusAfter} />}
        {exam.nextAppointment && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={13} className="text-emerald-600" /> Hẹn khám tiếp {formatDate(exam.nextAppointment)}
          </span>
        )}
      </div>

      {!compact && exam.linkedRequests.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-dashed border-gray-100 pt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
            <Link2 size={12} /> Yêu cầu khám được gắn ({exam.linkedRequests.length})
          </p>
          {exam.linkedRequests.map((request) => (
            <div key={request.id} className="flex flex-wrap items-start gap-2 text-xs text-gray-600">
              <UrgencyPill urgency={request.urgency} />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-gray-700">{request.sourceLabel}</span> · {request.createdByName} ·{' '}
                {formatDateTime(request.createdAt)}
                <span className="block whitespace-pre-line text-gray-500">{request.description}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {exam.corrections.length > 0 && (
        <div className="mt-4 space-y-2">
          {exam.corrections.map((item, index) => (
            <div key={index} className="rounded-xl bg-amber-50/70 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-100">
              <p className="text-[11px] font-medium text-amber-700">
                Ghi chú đính chính · {item.byName} · {formatDateTime(item.at)}
              </p>
              <p className="mt-0.5 whitespace-pre-line">{item.note}</p>
            </div>
          ))}
        </div>
      )}

      {onCorrect && exam.canCorrect && (
        <div className="mt-4 flex justify-end">
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
    <ol className="relative space-y-4 pl-6 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-emerald-950/10">
      {exams.map((exam) => (
        <li key={exam.id} className="relative">
          <span
            className={cn(
              'absolute -left-6 top-6 h-[15px] w-[15px] rounded-full border-[3px] border-canvas',
              healthSwatch[exam.healthStatusAfter].dot,
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
      ))}
    </ol>
  );
}
