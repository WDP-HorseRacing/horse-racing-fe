// Tab Lịch buổi của lớp: lịch tuần kiểu Google Calendar, tuần tính từ ngày bắt đầu lớp.
// Bên phải là bảng môn của giai đoạn chứa tuần đang xem: kéo môn vào lịch thì hiện khối chờ kèm popover (Lưu buổi,
// Chi tiết, Bỏ) vì BE không xóa được buổi (chỉ hủy, vẫn để lại dòng đã hủy). Bấm môn để xếp vào giờ trống đầu tiên,
// bấm ô trống để thêm buổi. Kéo buổi chưa mở điểm danh để đổi giờ; FE kiểm luật của BE trước (trùng giờ, nghỉ 3 giờ,
// tối đa 2 buổi và 1 buổi Nặng mỗi ngày) nên buổi không bị nhảy về chỗ cũ. Bấm buổi chưa mở điểm danh (30 phút trước
// giờ bắt đầu) để sửa hoặc hủy, buổi khác mở chi tiết buổi.
// "Áp dụng tuần này cho các tuần còn lại của giai đoạn" chép buổi của tuần sang các tuần sau, xem trước rồi lưu theo lô.
// Mở lớp mà lưu buổi dở dang (BE từ chối giữa chừng): hiện câu báo số buổi đã lưu và mở đúng tuần có buổi lỗi.
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CopyPlus, ExternalLink } from 'lucide-react';
import { addSession, cancelSession, updateSession } from '../../../api/training';
import type { TrainingSession, TrainingSubject } from '../../../api/types';
import { Button, ErrorBox, Notice, cn, useToast } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';
import { formatDate } from '../../../lib/format';
import { addDateKey, addMinutes, clubDateKey, clubInstant, clubTime, clubToday, diffDateKeys } from '../../../lib/club-time';
import { now } from '../../../lib/clock';
import { links } from '../../../lib/links';
import { windowOpensAt } from '../../../lib/training-window';
import { intensityText } from '../../../lib/training-labels';
import { ProgressFill } from '../components/motion';
import { ReasonDialog } from '../components/ReasonDialog';
import { SessionEditSheet, draftFromSubject, type SessionDraft } from '../components/SessionEditSheet';
import { SubjectPalette } from '../components/SubjectPalette';
import { ApplyWeekDialog } from '../components/ApplyWeekDialog';
import { WeekCalendar } from '../components/WeekCalendar';
import { draftToInput } from '../class-template';
import { INTENSITY_FILL, classPhaseAt, classWeekStart, formatTotalMinutes, shiftEnd } from '../plan-helpers';
import { problemOf, scheduleIndex, sessionItem, slotText, type PlannedItem, type RuleContext } from '../schedule-rules';
import type { ClassBundle } from './class-bundle';

const shortDate = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;

/** Buổi còn sửa, kéo được: đã lên lịch và chưa tới giờ mở điểm danh (30 phút trước giờ bắt đầu), giống BE. Sau mốc đó muốn đổi thì hủy rồi thêm buổi mới. */
const editable = (session: TrainingSession) => session.status === 'SCHEDULED' && windowOpensAt(session, 'checkIn').getTime() > Date.now();

/** Mở lớp kèm thời khóa biểu mà BE từ chối giữa chừng (trang tạo lớp truyền qua state). */
export interface ScheduleIssue {
  saved: number;
  total: number;
  message: string;
  week?: number;
}

export default function ClassSessionsTab({ bundle, manage, reload }: { bundle: ClassBundle; manage: boolean; reload: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { item, sessions, subjects, classPlan, progress } = bundle;
  const open = item.status === 'ACTIVE';
  const canEdit = manage && open;
  const range = { from: item.startDate, to: item.endDate };
  const totalWeeks = Math.max(1, Math.floor(diffDateKeys(item.startDate, item.endDate) / 7) + 1);
  const issue = (location.state as { scheduleIssue?: ScheduleIssue } | null)?.scheduleIssue;

  const [week, setWeek] = useState(() => issue?.week ?? Math.min(totalWeeks, Math.max(1, Math.floor(diffDateKeys(item.startDate, clubToday()) / 7) + 1)));
  const [editing, setEditing] = useState<{ session?: TrainingSession; initial: SessionDraft } | null>(null);
  const [cancelling, setCancelling] = useState<TrainingSession | null>(null);
  const [incoming, setIncoming] = useState<TrainingSubject | null>(null);
  const [pending, setPending] = useState<{ subject: TrainingSubject; startAt: string; endAt: string } | null>(null);
  const [applying, setApplying] = useState(false);
  // Chỗ mới của buổi vừa kéo, giữ tới khi BE trả lời. Chỉ áp khi giờ gốc của buổi chưa đổi (tải lại xong thì tự bỏ).
  const [moved, setMoved] = useState<Record<string, { from: string; start: string; end: string }>>({});
  const save = useAction();
  const quick = useAction();
  const move = useAction();
  const cancel = useAction();

  const weekStart = classWeekStart(item.startDate, week);
  const weekEnd = addDateKey(weekStart, 6);
  const weekProgress = progress?.weeks.find((entry) => entry.week === week);
  const phase = classPlan ? classPhaseAt(classPlan, weekStart < item.startDate ? item.startDate : weekStart) : undefined;
  const shortWeeks = useMemo(
    () => new Set((progress?.weeks ?? []).filter((entry) => entry.subjects.some((subject) => subject.scheduledSessions < subject.minSessions)).map((entry) => entry.week)),
    [progress],
  );
  const currentWeek = Math.floor(diffDateKeys(item.startDate, clubToday()) / 7) + 1;

  const shown = useMemo(
    () =>
      sessions.map((session) => {
        const override = moved[session.id];
        return override && override.from === session.scheduledStartAt ? { ...session, scheduledStartAt: override.start, scheduledEndAt: override.end } : session;
      }),
    [sessions, moved],
  );
  const live = useMemo(() => sessions.filter((session) => session.status !== 'CANCELLED').map(sessionItem), [sessions]);

  const subjectById = (id: string) => subjects.find((subject) => subject.id === id);
  /** Môn của giai đoạn chứa ngày (đủ thông tin từ danh mục). Không đọc được giáo án của lớp thì cho mọi môn. */
  const subjectsFor = (dateKey: string): TrainingSubject[] => {
    if (!classPlan) return subjects;
    const found = classPhaseAt(classPlan, dateKey);
    return found ? found.subjects.map((entry) => subjectById(entry.subject.id) ?? entry.subject) : [];
  };

  const ctx: RuleContext = {
    range,
    phaseSubjects: classPlan
      ? (dateKey) => {
          const found = classPhaseAt(classPlan, dateKey);
          return found ? { position: found.position, ids: new Set(found.subjects.map((entry) => entry.subject.id)) } : undefined;
        }
      : undefined,
    pastBefore: now(),
  };
  /** Lỗi luật của một buổi so với các buổi chưa hủy khác của lớp (bỏ qua buổi `except`). */
  const problem = (candidate: PlannedItem, except?: string) =>
    problemOf(candidate, scheduleIndex(live.filter((other) => other.key !== except && other.key !== candidate.key)), ctx)?.message;
  const subjectItem = (subject: TrainingSubject, startAt: string): PlannedItem => ({
    key: 'new',
    name: subject.name,
    intensity: subject.intensity,
    startAt,
    endAt: addMinutes(startAt, subject.durationMinutes),
    subjectId: subject.id,
    sessionType: subject.sessionType,
    plannedDistanceM: subject.plannedDistanceM,
  });

  const openAdd = (dateKey: string, time: string, preferred?: TrainingSubject) => {
    const options = subjectsFor(dateKey);
    if (options.length === 0) {
      toast.push('Ngày này không thuộc giai đoạn nào của lớp', 'error');
      return;
    }
    // Ưu tiên môn được chọn, rồi môn còn thiếu buổi trong tuần đó.
    const dayWeek = Math.floor(diffDateKeys(item.startDate, dateKey) / 7) + 1;
    const short = progress?.weeks.find((entry) => entry.week === dayWeek)?.subjects.find((entry) => entry.scheduledSessions < entry.minSessions);
    const subject = options.find((option) => option.id === preferred?.id) ?? options.find((option) => option.id === short?.subjectId) ?? options[0];
    const start = clubInstant(dateKey, time);
    save.clearError();
    setEditing({ initial: draftFromSubject(subject, start, addMinutes(start, subject.durationMinutes)) });
  };

  const openEdit = (session: TrainingSession) => {
    save.clearError();
    setEditing({
      session,
      initial: {
        subjectId: session.subjectId ?? '',
        name: session.name,
        intensity: session.intensity,
        plannedDistanceM: session.plannedDistanceM,
        surface: session.surface ?? '',
        location: session.location ?? '',
        notes: session.notes ?? '',
        targetTimeMs: session.targetTimeMs ?? undefined,
        scheduledStartAt: session.scheduledStartAt,
        scheduledEndAt: session.scheduledEndAt,
      },
    });
  };

  /** Bấm một môn ở bảng môn: giờ trống đầu tiên của tuần (06:00 đến 18:00, bước 30 phút) không vướng luật. */
  const pickSubject = (subject: TrainingSubject) => {
    const firstDay = [clubToday(), weekStart, item.startDate].sort().at(-1)!;
    for (let day = firstDay; day <= weekEnd && day <= item.endDate; day = addDateKey(day, 1)) {
      for (let minutes = 6 * 60; minutes <= 18 * 60; minutes += 30) {
        const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
        if (!problem(subjectItem(subject, clubInstant(day, time)))) {
          openAdd(day, time, subject);
          return;
        }
      }
    }
    toast.push(`Tuần ${week} không còn giờ trống hợp lệ cho ${subject.name}`, 'error');
  };

  const openSession = (session: TrainingSession) => {
    if (canEdit && editable(session)) openEdit(session);
    else navigate(links.session(session.id));
  };

  const submitEdit = (draft: SessionDraft) => {
    const subject = subjectById(draft.subjectId) ?? subjectsFor(clubDateKey(draft.scheduledStartAt)).find((entry) => entry.id === draft.subjectId);
    if (!subject || !editing) return;
    const existing = editing.session;
    void save.run(
      (): Promise<unknown> => (existing ? updateSession(existing.id, draftToInput(draft, subject, 'update')) : addSession(item.id, draftToInput(draft, subject, 'create'))),
      () => {
        toast.push(existing ? 'Đã lưu buổi tập' : 'Đã thêm buổi tập', 'success');
        setEditing(null);
        reload();
      },
    );
  };

  const savePending = () => {
    if (!pending) return;
    const { subject, startAt, endAt } = pending;
    void quick.run(
      () => addSession(item.id, draftToInput(draftFromSubject(subject, startAt, endAt), subject, 'create')),
      () => {
        toast.push(`Đã thêm ${subject.name} ${slotText(startAt)}`, 'success');
        setPending(null);
        reload();
      },
    );
  };

  const moveSession = (session: TrainingSession, startAt: string) => {
    const end = shiftEnd(session, startAt);
    const clash = problem({ ...sessionItem(session), startAt, endAt: end });
    if (clash) {
      toast.push(`${clash}. Buổi giữ chỗ cũ.`, 'error');
      return;
    }
    setMoved((current) => ({ ...current, [session.id]: { from: session.scheduledStartAt, start: startAt, end } }));
    const revert = () =>
      setMoved((current) => {
        const next = { ...current };
        delete next[session.id];
        return next;
      });
    void move.run(
      () => updateSession(session.id, { scheduledStartAt: startAt, scheduledEndAt: end }),
      () => {
        toast.push(`Đã dời ${session.name} sang ${formatDate(startAt)}`, 'success');
        reload();
      },
    ).then((result) => {
      if (result === undefined) {
        revert();
        reload();
      }
    });
  };

  const dismissIssue = () => navigate(location.pathname + location.search, { replace: true, state: null });

  const paletteItems = (phase?.subjects ?? []).map((entry) => ({
    subject: subjectById(entry.subject.id) ?? entry.subject,
    min: entry.minSessionsPerWeek,
    placed: weekProgress?.subjects.find((subject) => subject.subjectId === entry.subject.id)?.scheduledSessions ?? 0,
  }));
  const hasLaterWeek = !!phase && classWeekStart(item.startDate, week + 1) <= phase.endDate;
  const weekHasSessions = sessions.some((session) => session.status !== 'CANCELLED' && session.subjectId && clubDateKey(session.scheduledStartAt) >= weekStart && clubDateKey(session.scheduledStartAt) <= weekEnd);
  const scheduledMinutes = progress?.scheduledMinutes ?? 0;
  const minTotal = progress?.minTotalMinutes ?? classPlan?.minTotalMinutes ?? 0;

  return (
    <div className="space-y-4">
      {issue && (
        <Notice tone="warning">
          <span className="block">
            Lớp đã tạo, đã lưu {issue.saved}/{issue.total} buổi. Phần còn lại chưa lưu: {issue.message}
          </span>
          <span className="mt-1 block">Xếp nốt bằng cách kéo môn vào lịch hoặc dùng Áp dụng tuần này cho các tuần còn lại.</span>
          <button type="button" onClick={dismissIssue} className="mt-1.5 text-sm font-medium underline">
            Đã hiểu
          </button>
        </Notice>
      )}

      {/* Điều hướng tuần */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title="Tuần trước" disabled={week <= 1} onClick={() => setWeek(week - 1)}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="ghost" size="icon" title="Tuần sau" disabled={week >= totalWeeks} onClick={() => setWeek(week + 1)}>
            <ChevronRight size={16} />
          </Button>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">
            Tuần {week}
            {phase && <span className="font-normal text-gray-500"> · Giai đoạn {phase.position}</span>}
          </p>
          <p className="text-xs tabular-nums text-gray-500">
            {shortDate(weekStart)} đến {shortDate(weekEnd > item.endDate ? item.endDate : weekEnd)}
          </p>
        </div>
        {currentWeek >= 1 && currentWeek <= totalWeeks && currentWeek !== week && (
          <Button variant="inline" size="sm" onClick={() => setWeek(currentWeek)}>
            Về tuần này
          </Button>
        )}
        {canEdit && phase && hasLaterWeek && weekHasSessions && (
          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setApplying(true)} title={`Chép các buổi của tuần ${week} sang các tuần sau của giai đoạn ${phase.position}`}>
            <CopyPlus size={14} /> Áp dụng tuần này cho các tuần còn lại
          </Button>
        )}
      </div>

      {/* Chip các tuần: chấm hổ phách khi tuần còn thiếu buổi */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 custom-scrollbar" data-lenis-prevent>
        {Array.from({ length: totalWeeks }, (_, index) => index + 1).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setWeek(value)}
            className={cn(
              'relative shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums transition',
              value === week ? 'bg-emerald-700 text-white' : value === currentWeek ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            T{value}
            {shortWeeks.has(value) && <span aria-label="còn thiếu buổi" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />}
          </button>
        ))}
      </div>

      {(move.error || cancel.error) && <ErrorBox message={move.error ?? cancel.error ?? ''} />}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-9">
          <WeekCalendar
            weekStart={weekStart}
            sessions={shown}
            range={range}
            canAdd={canEdit}
            canMove={(session) => canEdit && editable(session) && !move.pending}
            onAdd={(dateKey, time) => openAdd(dateKey, time)}
            onOpen={openSession}
            onMove={moveSession}
            onBlocked={(message) => toast.push(message, 'error')}
            incoming={incoming}
            checkDrop={(dateKey, time) => (incoming ? problem(subjectItem(incoming, clubInstant(dateKey, time))) : undefined)}
            onDrop={(dateKey, time) => {
              if (!incoming) return;
              const startAt = clubInstant(dateKey, time);
              quick.clearError();
              setPending({ subject: incoming, startAt, endAt: addMinutes(startAt, incoming.durationMinutes) });
            }}
            pending={
              pending && {
                item: { id: 'pending', name: pending.subject.name, sessionType: pending.subject.sessionType, intensity: pending.subject.intensity, scheduledStartAt: pending.startAt, scheduledEndAt: pending.endAt },
                onDismiss: () => !quick.pending && setPending(null),
                content: (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{pending.subject.name}</p>
                      <p className="text-xs tabular-nums text-gray-500">
                        {slotText(pending.startAt)} đến {clubTime(pending.endAt)} · {intensityText[pending.subject.intensity]}
                      </p>
                    </div>
                    {quick.error && <p className="text-xs text-red-700">{quick.error}</p>}
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="ghost" size="sm" disabled={quick.pending} onClick={() => setPending(null)}>
                        Bỏ
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={quick.pending}
                        onClick={() => {
                          save.clearError();
                          setEditing({ initial: draftFromSubject(pending.subject, pending.startAt, pending.endAt) });
                          setPending(null);
                        }}
                      >
                        Chi tiết…
                      </Button>
                      <Button size="sm" autoFocus disabled={quick.pending} onClick={savePending}>
                        {quick.pending ? 'Đang lưu…' : 'Lưu buổi'}
                      </Button>
                    </div>
                  </div>
                ),
              }
            }
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded', INTENSITY_FILL.LIGHT)} /> Nhẹ
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded', INTENSITY_FILL.HEAVY)} /> Nặng
            </span>
            {canEdit && <span>Kéo môn vào lịch hoặc bấm ô trống để thêm buổi. Đổi giờ được tới 30 phút trước giờ tập.</span>}
          </div>
        </div>

        {/* Bảng môn của giai đoạn và tiến độ cả lớp */}
        <aside className="space-y-3 lg:col-span-3">
          <SubjectPalette
            title={`Tuần ${week}`}
            hint={canEdit ? `Môn của giai đoạn ${phase?.position ?? ''}. Kéo vào lịch, hoặc bấm để xếp vào giờ trống đầu tiên.` : undefined}
            items={paletteItems}
            disabled={!canEdit}
            onDragSubject={setIncoming}
            onPick={canEdit ? pickSubject : undefined}
          />

          <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-gray-200/80">
            <p className="text-xs text-gray-500">Cả lớp đã xếp</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">
              {formatTotalMinutes(scheduledMinutes)}
              <span className="text-sm font-normal text-gray-500"> / {formatTotalMinutes(minTotal)}</span>
            </p>
            <ProgressFill ratio={minTotal ? scheduledMinutes / minTotal : 0} tone={scheduledMinutes >= minTotal && minTotal > 0 ? 'green' : 'amber'} className="mt-2" />
            <p className="mt-2 text-xs text-gray-500">{shortWeeks.size ? `${shortWeeks.size} tuần còn thiếu buổi.` : 'Mọi tuần đã đủ số buổi tối thiểu.'}</p>
          </section>
        </aside>
      </div>

      {editing && (
        <SessionEditSheet
          title={editing.session ? 'Sửa buổi tập' : 'Thêm buổi'}
          description={editing.session ? `${editing.session.name}, ${formatDate(editing.session.scheduledStartAt)}` : 'Groom và chủ ngựa thấy lịch ngay khi lưu.'}
          initial={editing.initial}
          subjects={subjects}
          subjectsFor={subjectsFor}
          conflict={(draft) => {
            const subject = subjectById(draft.subjectId);
            return problem(
              { key: editing.session?.id ?? 'new', name: draft.name, intensity: draft.intensity, startAt: draft.scheduledStartAt, endAt: draft.scheduledEndAt, subjectId: draft.subjectId, sessionType: subject?.sessionType, plannedDistanceM: draft.plannedDistanceM },
              editing.session?.id,
            );
          }}
          range={range}
          pending={save.pending}
          error={save.error}
          field={save.field}
          fieldErrors={save.fieldErrors}
          onClearError={save.clearError}
          submitLabel={editing.session ? 'Lưu' : 'Thêm buổi'}
          removeLabel="Hủy buổi"
          onRemove={
            editing.session
              ? () => {
                  setCancelling(editing.session ?? null);
                  setEditing(null);
                }
              : undefined
          }
          extraActions={
            editing.session && (
              <Button variant="inline" onClick={() => navigate(links.session(editing.session!.id))}>
                <ExternalLink size={14} /> Mở buổi
              </Button>
            )
          }
          onClose={() => {
            setEditing(null);
            save.clearError();
          }}
          onSubmit={submitEdit}
        />
      )}
      {applying && classPlan && phase && (
        <ApplyWeekDialog item={item} classPlan={classPlan} sessions={sessions} week={week} phase={phase} onClose={() => setApplying(false)} onDone={reload} />
      )}
      {cancelling && (
        <ReasonDialog
          title="Hủy buổi tập"
          message={
            <>
              Hủy buổi <b>{cancelling.name}</b> ngày {formatDate(cancelling.scheduledStartAt)}. Lượt tập còn mở của buổi bị hủy theo. Không hủy được khi có ngựa đang chạy.
            </>
          }
          label="Lý do hủy buổi"
          suggestions={['Mưa lớn, sân trơn', 'Sân tập bảo trì', 'Đổi sang ngày khác']}
          confirmLabel="Hủy buổi"
          pending={cancel.pending}
          error={cancel.error}
          onClose={() => {
            setCancelling(null);
            cancel.clearError();
          }}
          onConfirm={(reason) =>
            void cancel.run(
              () => cancelSession(cancelling.id, reason),
              () => {
                toast.push('Đã hủy buổi tập', 'success');
                setCancelling(null);
                reload();
              },
            ).then((result) => result === undefined && reload())
          }
        />
      )}
    </div>
  );
}
