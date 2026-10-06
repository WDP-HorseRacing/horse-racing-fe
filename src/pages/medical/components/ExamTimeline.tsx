// Dòng thời gian buổi khám — thẻ chỉ đọc. Buổi đã hủy vẫn hiện (mờ, kèm lý do hủy).
// Chấm mốc xám; chỉ buổi để ngựa ở Chấn thương / Cách ly mới có chấm đỏ.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Bandage, CalendarClock, FolderOpen, NotebookPen, Pill as PillIcon, RotateCcw } from 'lucide-react';
import { Button, Pill, cn } from '../../../components/ui';
import { HealthPill } from '../../../components/ui/status';
import { bodyRegionLabel, conclusionLabel, injuryTypeLabel, recoveryLabel, visitKindLabel } from '../../../lib/api-labels';
import { formatDate, formatDateTime } from '../../../lib/format';
import { links } from '../../../lib/links';
import type { Injury, InjuryTimelineItem, MedicalRecord } from '../../../api/types';
import type { People } from './people';
import { isSevere } from './utils';

export function InjuryLine({ injury }: { injury: Pick<Injury, 'bodyRegion' | 'injuryType' | 'recoveryStatus' | 'notes'> }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-700">
      <span className="font-medium text-gray-900">{bodyRegionLabel[injury.bodyRegion]}</span>
      <span>· {injuryTypeLabel[injury.injuryType]}</span>
      <RecoveryTag status={injury.recoveryStatus} />
      {injury.notes && <span className="w-full text-xs text-gray-500">{injury.notes}</span>}
    </span>
  );
}

export function RecoveryTag({ status }: { status: Injury['recoveryStatus'] }) {
  if (status === 'HEALED') return <Pill tone="green">{recoveryLabel[status]}</Pill>;
  if (status === 'ACUTE') return <Pill tone="amber">{recoveryLabel[status]}</Pill>;
  return <Pill tone="gray">{recoveryLabel[status]}</Pill>;
}

export function VisitCard({
  record,
  people,
  caseLabel,
  onVoid,
  compact = false,
}: {
  record: MedicalRecord;
  people: People;
  /** Hiện liên kết bệnh án (dùng ở danh sách buổi khám của ngựa). */
  caseLabel?: string;
  onVoid?: () => void;
  compact?: boolean;
}) {
  const voided = !!record.voidedAt;
  const opening = !!record.caseId && record.conclusion === 'ISSUE';
  return (
    <article className={cn('rounded-2xl bg-white p-5 ring-1', voided ? 'ring-gray-200/60' : 'shadow-card ring-gray-200/80')}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className={cn('min-w-0', voided && 'opacity-60')}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className={cn('font-semibold tabular-nums text-gray-900', voided && 'line-through decoration-gray-400')}>{formatDateTime(record.examDate)}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">{people.name(record.vetId, 'vet')}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
            <span>{visitKindLabel[record.kind]}</span>
            {record.conclusion && (
              <>
                <span className="text-gray-400">·</span>
                <span className={cn(record.conclusion === 'ISSUE' && 'font-medium text-gray-700')}>
                  {opening ? 'Có vấn đề, mở bệnh án' : conclusionLabel[record.conclusion]}
                </span>
              </>
            )}
            {caseLabel && record.caseId && (
              <>
                <span className="text-gray-400">·</span>
                <Link to={links.case(record.caseId)} className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline">
                  <FolderOpen size={12} /> {caseLabel}
                </Link>
              </>
            )}
            {record.replacesRecordId && (
              <>
                <span className="text-gray-400">·</span>
                <span className="inline-flex items-center gap-1">
                  <RotateCcw size={11} /> ghi thay buổi đã hủy
                </span>
              </>
            )}
          </p>
        </div>
        {voided ? (
          <Pill tone="gray">
            <Ban size={11} /> Đã hủy
          </Pill>
        ) : (
          <HealthPill status={record.resultingStatus} />
        )}
      </header>

      {voided && (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Hủy {formatDateTime(record.voidedAt)} · {record.voidReason}
        </p>
      )}

      <div className={cn(voided && 'opacity-60')}>
        {record.diagnosis && (
          <div className="mt-4">
            <p className="text-xs text-gray-500">Chẩn đoán và hướng điều trị</p>
            <p className={cn('mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-800', compact && 'line-clamp-3')}>{record.diagnosis}</p>
          </div>
        )}

        {!compact && record.careInstructions && (
          <div className="mt-3 border-l-2 border-emerald-200 pl-3">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <NotebookPen size={12} className="text-gray-400" /> Ghi chú chăm sóc
            </p>
            <p className="mt-0.5 whitespace-pre-line text-sm text-gray-700">{record.careInstructions}</p>
          </div>
        )}

        {!compact && record.prescriptions.length > 0 && (
          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <PillIcon size={12} className="text-gray-400" /> Đơn thuốc
            </p>
            <ul className="mt-1.5 space-y-1">
              {record.prescriptions.map((item) => (
                <li key={item.id} className="text-sm text-gray-700">
                  <span className="font-medium text-gray-900">{item.medicine}</span>
                  {item.dosage && <span> · {item.dosage}</span>}
                  {item.frequency && <span> · {item.frequency}</span>}
                  <span className="text-xs text-gray-500">
                    {' '}
                    · {formatDate(item.startDate)}
                    {item.endDate ? ` → ${formatDate(item.endDate)}` : ' trở đi'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!compact && record.injuries.length > 0 && (
          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <Bandage size={12} className="text-gray-400" /> Chấn thương
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {record.injuries.map((injury) => (
                <li key={injury.id}>
                  <InjuryLine injury={injury} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {compact && (record.prescriptions.length > 0 || record.injuries.length > 0) && (
          <p className="mt-3 text-xs text-gray-500">
            {[record.prescriptions.length && `${record.prescriptions.length} thuốc`, record.injuries.length && `${record.injuries.length} chấn thương`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {record.nextVisitAt && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarClock size={13} className="text-gray-400" /> Hẹn tái khám {formatDateTime(record.nextVisitAt)}
          </p>
        )}
      </div>

      {onVoid && !voided && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="inlineDanger" onClick={onVoid}>
            <Ban size={14} /> Hủy buổi khám
          </Button>
        </div>
      )}
    </article>
  );
}

/** Danh sách buổi khám dạng trục thời gian dọc (mới nhất trên cùng). */
export function VisitTimeline({
  records,
  people,
  caseLabel,
  onVoid,
  compact,
}: {
  records: MedicalRecord[];
  people: People;
  caseLabel?: (record: MedicalRecord) => string | undefined;
  onVoid?: (record: MedicalRecord) => void;
  compact?: boolean;
}) {
  return (
    <ol className="relative space-y-4 pl-6 before:absolute before:bottom-3 before:left-1.25 before:top-3 before:w-px before:bg-gray-200">
      {records.map((record) => {
        const severe = !record.voidedAt && isSevere(record.resultingStatus);
        return (
          <li key={record.id} className="relative">
            <span
              title={severe ? 'Sau buổi khám ngựa ở trạng thái Chấn thương hoặc Cách ly' : undefined}
              className={cn(
                'absolute -left-6 top-6 h-2.75 w-2.75 rounded-full ring-[3px] ring-canvas',
                record.voidedAt ? 'bg-white ring-gray-200' : severe ? 'bg-red-500' : 'bg-gray-300',
              )}
            />
            <VisitCard
              record={record}
              people={people}
              caseLabel={caseLabel?.(record)}
              compact={compact}
              onVoid={onVoid ? () => onVoid(record) : undefined}
            />
          </li>
        );
      })}
    </ol>
  );
}

/** Gom các dòng chấn thương theo (vùng, loại) để thấy diễn biến qua từng buổi khám. */
export function InjuryProgress({ items }: { items: InjuryTimelineItem[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, InjuryTimelineItem[]>();
    items.forEach((item) => {
      const key = `${item.caseId ?? ''}:${item.bodyRegion}:${item.injuryType}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return [...map.values()];
  }, [items]);
  if (groups.length === 0) return <p className="text-sm text-gray-500">Chưa ghi chấn thương nào.</p>;
  return (
    <ul className="space-y-3">
      {groups.map((steps) => (
        <li key={steps[0].id}>
          <p className="text-sm font-semibold text-gray-900">
            {bodyRegionLabel[steps[0].bodyRegion]} <span className="font-normal text-gray-500">· {injuryTypeLabel[steps[0].injuryType]}</span>
          </p>
          <ol className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-xs text-gray-500">
            {steps.map((step, index) => (
              <li key={step.id} className="inline-flex items-center gap-1.5" title={step.notes ?? undefined}>
                {index > 0 && <span className="text-gray-300">→</span>}
                <RecoveryTag status={step.recoveryStatus} />
                <span className="tabular-nums">{formatDate(step.examDate)}</span>
              </li>
            ))}
          </ol>
          {steps[steps.length - 1].notes && <p className="mt-1 text-xs text-gray-500">{steps[steps.length - 1].notes}</p>}
        </li>
      ))}
    </ul>
  );
}
