// Bước "Thời khóa biểu" khi mở lớp: mỗi giai đoạn xếp một tuần mẫu bằng cách kéo môn của giai đoạn vào lịch tuần
// (hoặc bấm môn, bấm ô trống). Lúc tạo lớp, tuần mẫu được nhân ra mọi tuần của giai đoạn đó.
// Thả hoặc dời một buổi thì nhân thử ra mọi tuần và kiểm với toàn bộ buổi của mọi giai đoạn theo luật BE (trùng giờ,
// nghỉ 3 giờ kể cả qua nửa đêm và chỗ nối hai tuần, tối đa 2 buổi và 1 buổi Nặng mỗi ngày): vướng thì không thả được.
// Buổi đã qua giờ (lớp bắt đầu hôm nay) và buổi trùng lịch lớp khác của HLV chỉ bị bỏ, có cảnh báo trên khối.
import { useState, type ReactNode } from 'react';
import { CopyPlus, Eraser } from 'lucide-react';
import type { TrainingPlan, TrainingSubject } from '../../../api/types';
import { Button, ConfirmDialog, cn, useToast } from '../../../components/ui';
import { addDateKey, classEndDate, clubDateKey, clubTime, isoWeekdayOf } from '../../../lib/club-time';
import { formatDate } from '../../../lib/format';
import { weekdayShort } from '../../../lib/training-labels';
import { SessionEditSheet, type SessionDraft } from '../components/SessionEditSheet';
import { SubjectPalette } from '../components/SubjectPalette';
import { WeekCalendar, type CalendarItem } from '../components/WeekCalendar';
import { copyPhase, draftToSlot, expandTemplates, newSlotId, phaseLookup, phaseRanges, slotFromSubject, slotToDraft, slotWindow, type Submission, type TemplateSlot, type Templates } from '../class-template';
import { formatTotalMinutes, INTENSITY_FILL } from '../plan-helpers';
import { BLOCKING, problemOf, scheduleIndex, type RuleContext } from '../schedule-rules';

const shortDate = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function ClassScheduleStep({
  plan,
  startDate,
  templates,
  onChange,
  submission,
  actions,
}: {
  plan: TrainingPlan;
  startDate: string;
  templates: Templates;
  onChange: (next: Templates) => void;
  submission: Submission;
  /** Nút ở chân trang (Tạo lớp). */
  actions: ReactNode;
}) {
  const toast = useToast();
  const ranges = phaseRanges(plan, startDate);
  const [position, setPosition] = useState(plan.phases[0]?.position ?? 1);
  const [incoming, setIncoming] = useState<TrainingSubject | null>(null);
  const [editing, setEditing] = useState<{ slot?: TemplateSlot; initial: SessionDraft } | null>(null);
  const [confirm, setConfirm] = useState<'copy' | 'clear' | null>(null);

  const active = ranges.find((range) => range.phase.position === position) ?? ranges[0];
  const weekStart = active.from;
  const days = Array.from({ length: 7 }, (_, index) => addDateKey(weekStart, index));
  const calendarRange = { from: weekStart, to: addDateKey(weekStart, 6) };
  const slots = templates[position] ?? [];
  const subjects = active.phase.subjects.map((entry) => entry.subject);
  const subjectMap = new Map(plan.phases.flatMap((phase) => phase.subjects.map((entry) => [entry.subject.id, entry.subject] as const)));
  const ctx: RuleContext = { range: { from: startDate, to: classEndDate(startDate, plan.totalWeeks) }, phaseSubjects: phaseLookup(ranges) };

  /** Lỗi chặn của một slot khi nhân ra mọi tuần, so với mọi buổi khác của mọi giai đoạn (bỏ slot `except`). */
  const check = (slot: TemplateSlot, except?: string) => {
    const next = { ...templates, [position]: [...slots.filter((other) => other.id !== except && other.id !== slot.id), slot] };
    const all = expandTemplates(plan, startDate, next, subjectMap);
    const index = scheduleIndex(all.filter((item) => item.slot.id !== slot.id));
    for (const item of all) {
      if (item.slot.id !== slot.id) continue;
      const problem = problemOf(item, index, ctx);
      if (problem && BLOCKING.has(problem.kind)) return problem.message;
    }
    return undefined;
  };
  const save = (next: TemplateSlot[]) => onChange({ ...templates, [position]: next });
  const slotAt = (subject: TrainingSubject, dateKey: string, time: string) => slotFromSubject(subject, isoWeekdayOf(dateKey), time);

  const pick = (subject: TrainingSubject) => {
    for (const day of days) {
      for (let minutes = 6 * 60; minutes <= 18 * 60; minutes += 30) {
        const slot = slotAt(subject, day, clock(minutes));
        if (!check(slot)) {
          save([...slots, slot]);
          toast.push(`Đã xếp ${subject.name} vào ${weekdayShort[slot.weekday]} ${slot.start}`, 'success');
          return;
        }
      }
    }
    toast.push(`Tuần mẫu không còn giờ trống hợp lệ cho ${subject.name}`, 'error');
  };

  const openNew = (dateKey: string, time: string) => {
    const short = active.phase.subjects.find((entry) => slots.filter((slot) => slot.subjectId === entry.subject.id).length < entry.minSessionsPerWeek);
    const subject = short?.subject ?? subjects[0];
    if (!subject) return;
    setEditing({ initial: slotToDraft(slotAt(subject, dateKey, time), weekStart) });
  };

  const items: CalendarItem[] = slots.map((slot) => {
    const { startAt, endAt } = slotWindow(slot, weekStart);
    const error = submission.errors.get(slot.id);
    const warning = submission.warnings.get(slot.id);
    return {
      id: slot.id,
      name: slot.name,
      sessionType: subjectMap.get(slot.subjectId)?.sessionType ?? 'REGULAR',
      intensity: slot.intensity,
      scheduledStartAt: startAt,
      scheduledEndAt: endAt,
      flag: error ? { tone: 'error', message: error.message } : warning ? { tone: 'warning', message: warning } : undefined,
    };
  });

  const phaseState = (pos: number) => {
    const list = templates[pos] ?? [];
    if (list.some((slot) => submission.errors.has(slot.id))) return { dot: 'bg-red-500', label: 'có lỗi cần sửa' };
    if (list.length === 0) return { dot: 'bg-gray-300', label: 'chưa xếp' };
    if (submission.short.some((entry) => entry.phase === pos)) return { dot: 'bg-amber-500', label: 'còn thiếu buổi' };
    return { dot: 'bg-emerald-600', label: 'đủ buổi tối thiểu' };
  };
  const previous = templates[position - 1] ?? [];
  const problems = slots.flatMap((slot) => {
    const error = submission.errors.get(slot.id);
    return error ? [{ slot, message: error.message }] : [];
  });
  const totalWeeks = new Set(submission.accepted.map((item) => item.week)).size;
  const weekdayTime = (slot: TemplateSlot) => `${weekdayShort[slot.weekday]} ${slot.start}`;

  return (
    <div className="space-y-4 pb-24">
      {/* Các giai đoạn */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 custom-scrollbar" data-lenis-prevent>
        {ranges.map(({ phase, from, to }) => {
          const state = phaseState(phase.position);
          const selected = phase.position === position;
          return (
            <button
              key={phase.position}
              type="button"
              onClick={() => {
                setPosition(phase.position);
                setEditing(null);
              }}
              className={cn(
                'shrink-0 rounded-xl px-3.5 py-2 text-left ring-1 transition',
                selected ? 'bg-emerald-50 ring-2 ring-emerald-600' : 'bg-white ring-gray-200 hover:ring-emerald-300',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <span aria-label={state.label} title={state.label} className={cn('h-2 w-2 rounded-full', state.dot)} />
                Giai đoạn {phase.position}
              </span>
              <span className="block text-xs tabular-nums text-gray-500">
                {phase.weeks > 1 ? `Tuần ${phase.startWeek} đến ${phase.startWeek + phase.weeks - 1}` : `Tuần ${phase.startWeek}`} · {shortDate(from)} đến {shortDate(to)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-gray-600">
          Tuần mẫu của giai đoạn {position}, lặp lại <span className="font-semibold text-gray-900">{active.phase.weeks} tuần</span> ({formatDate(active.from)} đến {formatDate(active.to)}).
        </p>
        {position > 1 && previous.length > 0 && (
          <Button variant="inline" size="sm" onClick={() => (slots.length ? setConfirm('copy') : copyFromPrevious())}>
            <CopyPlus size={14} /> Chép tuần mẫu của giai đoạn {position - 1}
          </Button>
        )}
        {slots.length > 0 && (
          <Button variant="inline" size="sm" onClick={() => setConfirm('clear')}>
            <Eraser size={14} /> Xóa tuần mẫu
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-2 lg:col-span-9">
          <WeekCalendar
            template
            weekStart={weekStart}
            sessions={items}
            range={calendarRange}
            canAdd
            canMove={() => true}
            onAdd={openNew}
            onOpen={(item) => {
              const slot = slots.find((entry) => entry.id === item.id);
              if (slot) setEditing({ slot, initial: slotToDraft(slot, weekStart) });
            }}
            onMove={(item, startAt) => {
              const slot = slots.find((entry) => entry.id === item.id);
              if (!slot) return;
              const next = { ...slot, weekday: isoWeekdayOf(clubDateKey(startAt)), start: clubTime(startAt) };
              const clash = check(next, slot.id);
              if (clash) toast.push(`${clash}. Buổi giữ chỗ cũ.`, 'error');
              else save(slots.map((entry) => (entry.id === slot.id ? next : entry)));
            }}
            onBlocked={(message) => toast.push(message, 'error')}
            incoming={incoming}
            checkDrop={(dateKey, time) => (incoming ? check(slotAt(incoming, dateKey, time)) : undefined)}
            onDrop={(dateKey, time) => incoming && save([...slots, slotAt(incoming, dateKey, time)])}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded', INTENSITY_FILL.LIGHT)} /> Nhẹ
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded', INTENSITY_FILL.HEAVY)} /> Nặng
            </span>
            <span>Kéo môn vào lịch, kéo khối để đổi giờ, bấm khối để sửa hoặc bỏ. Mỗi ngày tối đa 2 buổi, 1 buổi Nặng, nghỉ ít nhất 3 giờ.</span>
          </div>
          {problems.length > 0 && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-100">
              <p className="font-medium">Cần sửa</p>
              <ul className="mt-1 space-y-0.5">
                {problems.map(({ slot, message }) => (
                  <li key={slot.id}>
                    {slot.name} {weekdayTime(slot)}: {message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="lg:col-span-3">
          <SubjectPalette
            title={`Môn của giai đoạn ${position}`}
            hint="Kéo vào lịch, hoặc bấm để xếp vào giờ trống đầu tiên."
            items={active.phase.subjects.map((entry) => ({ subject: entry.subject, min: entry.minSessionsPerWeek, placed: slots.filter((slot) => slot.subjectId === entry.subject.id).length }))}
            onDragSubject={setIncoming}
            onPick={pick}
          />
        </aside>
      </div>

      {/* Tóm tắt và nút tạo lớp, dính dưới đáy */}
      <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white/95 px-4 py-3 shadow-float ring-1 ring-gray-200 backdrop-blur">
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-gray-700">
            Lớp sẽ có <span className="font-semibold tabular-nums text-gray-900">{submission.accepted.length}</span> buổi trong{' '}
            <span className="font-semibold tabular-nums text-gray-900">{totalWeeks}</span> tuần,{' '}
            <span className="tabular-nums">
              {formatTotalMinutes(submission.minutes)} / tối thiểu {formatTotalMinutes(plan.minTotalMinutes)}
            </span>
          </p>
          <p className="text-xs text-gray-500">
            {[
              submission.past.length ? `bỏ ${submission.past.length} buổi đã qua giờ` : '',
              submission.busySkipped.length ? `bỏ ${submission.busySkipped.length} buổi trùng lịch lớp khác của bạn` : '',
            ]
              .filter(Boolean)
              .join(', ')}
            {submission.short.length > 0 && (
              <span className="text-amber-700">
                {submission.past.length || submission.busySkipped.length ? '. ' : ''}
                Còn thiếu: {submission.short.map((entry) => `${entry.subjectName} ${entry.placed}/${entry.min} (giai đoạn ${entry.phase})`).join(', ')}
              </span>
            )}
            {submission.errors.size > 0 && <span className="text-red-700"> · {submission.errors.size} buổi cần sửa trước khi tạo lớp</span>}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">{actions}</div>
      </div>

      {editing && (
        <SessionEditSheet
          title={editing.slot ? 'Sửa buổi trong tuần mẫu' : 'Thêm buổi vào tuần mẫu'}
          description={`Giai đoạn ${position}, lặp lại ${active.phase.weeks} tuần.`}
          initial={editing.initial}
          subjects={subjects}
          days={days}
          range={calendarRange}
          conflict={(draft) => check(draftToSlot(draft, editing.slot?.id ?? 'candidate'), editing.slot?.id)}
          submitLabel={editing.slot ? 'Xong' : 'Thêm vào tuần mẫu'}
          removeLabel="Bỏ khỏi tuần mẫu"
          onRemove={
            editing.slot
              ? () => {
                  save(slots.filter((slot) => slot.id !== editing.slot?.id));
                  setEditing(null);
                }
              : undefined
          }
          onClose={() => setEditing(null)}
          onSubmit={(draft) => {
            const slot = draftToSlot(draft, editing.slot?.id ?? newSlotId());
            save(editing.slot ? slots.map((entry) => (entry.id === slot.id ? slot : entry)) : [...slots, slot]);
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        danger={confirm === 'clear'}
        title={confirm === 'copy' ? `Chép tuần mẫu của giai đoạn ${position - 1}` : `Xóa tuần mẫu giai đoạn ${position}`}
        message={confirm === 'copy' ? `Tuần mẫu đang có của giai đoạn ${position} sẽ được thay bằng bản chép.` : `Bỏ ${slots.length} buổi đã xếp trong tuần mẫu.`}
        confirmLabel={confirm === 'copy' ? 'Chép' : 'Xóa'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === 'copy') copyFromPrevious();
          else save([]);
          setConfirm(null);
        }}
      />
    </div>
  );

  function copyFromPrevious() {
    const { kept, dropped } = copyPhase(previous, new Set(subjects.map((subject) => subject.id)));
    save(kept);
    const names = [...new Set(dropped.map((slot) => slot.name))];
    toast.push(
      `Đã chép ${kept.length} buổi${names.length ? `, bỏ ${dropped.length} buổi môn ${names.join(', ')} (không có trong giai đoạn ${position})` : ''}`,
      kept.length ? 'success' : 'error',
    );
  }
}
