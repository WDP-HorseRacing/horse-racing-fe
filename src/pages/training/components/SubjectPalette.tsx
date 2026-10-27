// Bảng môn của một giai đoạn cạnh lịch tuần: kéo môn vào lịch để xếp buổi (kéo thả HTML5, như trình lập giáo án),
// hoặc bấm môn để xếp vào giờ trống đầu tiên (bàn phím, màn cảm ứng). Mỗi môn ghi số buổi đã xếp so với tối thiểu.
import type { ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import type { TrainingSubject } from '../../../api/types';
import { cn } from '../../../components/ui';
import { IntensityBars, TrialBadge } from './bits';
import { ProgressFill } from './motion';
import { INTENSITY_FILL } from '../plan-helpers';

export interface PaletteItem {
  subject: TrainingSubject;
  min: number;
  placed: number;
}

export function SubjectPalette({
  title,
  hint,
  items,
  disabled = false,
  onDragSubject,
  onPick,
  footer,
}: {
  title: ReactNode;
  hint?: ReactNode;
  items: PaletteItem[];
  disabled?: boolean;
  onDragSubject: (subject: TrainingSubject | null) => void;
  onPick?: (subject: TrainingSubject) => void;
  footer?: ReactNode;
}) {
  const met = items.filter((item) => item.placed >= item.min).length;
  return (
    <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-gray-200/80">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {items.length > 0 && (
          <span className={cn('text-xs font-semibold', met === items.length ? 'text-emerald-700' : 'text-amber-700')}>
            {met === items.length ? 'Đủ buổi tối thiểu' : `Còn ${items.length - met} môn thiếu`}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">Tuần này không thuộc giai đoạn nào của lớp.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map(({ subject, min, placed }) => {
            const enough = placed >= min;
            return (
              <li key={subject.id}>
                <button
                  type="button"
                  draggable={!disabled}
                  disabled={disabled}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/subject', subject.id);
                    event.dataTransfer.effectAllowed = 'copy';
                    onDragSubject(subject);
                  }}
                  onDragEnd={() => onDragSubject(null)}
                  onClick={() => onPick?.(subject)}
                  title={disabled ? undefined : 'Kéo vào lịch, hoặc bấm để xếp vào giờ trống đầu tiên'}
                  className={cn(
                    'group relative flex w-full items-start gap-2 overflow-hidden rounded-xl bg-white py-2.5 pl-3.5 pr-3 text-left ring-1 ring-gray-200 transition',
                    disabled ? 'cursor-default opacity-60' : 'cursor-grab hover:ring-emerald-300 hover:shadow-raised active:cursor-grabbing',
                  )}
                >
                  <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', INTENSITY_FILL[subject.intensity].split(' ')[0])} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-gray-900">{subject.name}</span>
                      <TrialBadge type={subject.sessionType} />
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                      <IntensityBars intensity={subject.intensity} />
                      <span className="tabular-nums">{subject.durationMinutes} phút</span>
                      <span className={cn('ml-auto shrink-0 font-semibold tabular-nums', enough ? 'text-emerald-700' : 'text-amber-700')}>
                        {placed}/{min} buổi
                      </span>
                    </span>
                    <ProgressFill ratio={min ? placed / min : 1} tone={enough ? 'green' : 'amber'} className="mt-1.5" />
                  </span>
                  {!disabled && <GripVertical size={14} className="mt-0.5 shrink-0 text-gray-300 group-hover:text-gray-400" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {footer && <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">{footer}</div>}
    </section>
  );
}
