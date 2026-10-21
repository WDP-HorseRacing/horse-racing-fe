// Tab Lịch buổi của lớp: lịch tuần kiểu Google Calendar, tuần tính từ ngày bắt đầu lớp.
// HLV bấm ô trống để thêm buổi (môn chỉ trong giai đoạn của ngày đó, giờ kết thúc theo thời lượng môn), có thể lặp lại
// hằng tuần đến hết giai đoạn (lưu một lần, một buổi lỗi thì không buổi nào được lưu). Kéo buổi chưa mở điểm danh để đổi giờ,
// BE từ chối thì buổi về chỗ cũ. Bấm buổi chưa mở điểm danh (30 phút trước giờ bắt đầu) để sửa hoặc hủy, buổi khác mở chi tiết buổi.
// Khung bên cạnh: tiến độ tuần so với số buổi tối thiểu của giáo án (thiếu hổ phách, đủ xanh). Buổi lưu xong có hiệu lực ngay.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Plus } from 'lucide-react';
import { addSession, addSessions, cancelSession, updateSession } from '../../../api/training';
import type { SessionInput, TrainingSession, TrainingSubject } from '../../../api/types';
import { Button, cn, useToast } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';
import { formatDate } from '../../../lib/format';
import { addDateKey, addMinutes, clubDateKey, clubInstant, clubTime, clubToday, diffDateKeys } from '../../../lib/club-time';
import { links } from '../../../lib/links';
import { windowOpensAt } from '../../../lib/training-window';
import { ProgressFill } from '../components/motion';
import { ReasonDialog } from '../components/ReasonDialog';
import { SessionEditSheet, draftFromSubject, type SessionDraft } from '../components/SessionEditSheet';
import { WeekCalendar } from '../components/WeekCalendar';
import { INTENSITY_FILL, classPhaseAt, classWeekStart, formatTotalMinutes, shiftEnd } from '../plan-helpers';
import type { ClassBundle } from './class-bundle';

const shortDate = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;

/** Buổi còn sửa, kéo được: đã lên lịch và chưa tới giờ mở điểm danh (30 phút trước giờ bắt đầu), giống BE. Sau mốc đó muốn đổi thì hủy rồi thêm buổi mới. */
const editable = (session: TrainingSession) => session.status === 'SCHEDULED' && windowOpensAt(session, 'checkIn').getTime() > Date.now();

export default function ClassSessionsTab({ bundle, manage, reload }: { bundle: ClassBundle; manage: boolean; reload: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { item, sessions, subjects, classPlan, progress } = bundle;
  const open = item.status === 'ACTIVE';
  const canEdit = manage && open;
  const range = { from: item.startDate, to: item.endDate };
  const totalWeeks = Math.max(1, Math.floor(diffDateKeys(item.startDate, item.endDate) / 7) + 1);

  const [week, setWeek] = useState(() => Math.min(totalWeeks, Math.max(1, Math.floor(diffDateKeys(item.startDate, clubToday()) / 7) + 1)));
  const [editing, setEditing] = useState<{ session?: TrainingSession; initial: SessionDraft } | null>(null);
  const [cancelling, setCancelling] = useState<TrainingSession | null>(null);
  // Chỗ mới của buổi vừa kéo, giữ tới khi BE trả lời. Chỉ áp khi giờ gốc của buổi chưa đổi (tải lại xong thì tự bỏ).
  const [moved, setMoved] = useState<Record<string, { from: string; start: string; end: string }>>({});
  const save = useAction();
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

  const subjectById = (id: string) => subjects.find((subject) => subject.id === id);
  /** Môn của giai đoạn chứa ngày (đủ thông tin từ danh mục). Không đọc được giáo án của lớp thì cho mọi môn. */
  const subjectsFor = (dateKey: string): TrainingSubject[] => {
    if (!classPlan) return subjects;
    const found = classPhaseAt(classPlan, dateKey);
    return found ? found.subjects.map((entry) => subjectById(entry.subject.id) ?? entry.subject) : [];
  };
  /** Số tuần còn lại của giai đoạn sau ngày này, cùng thứ, vẫn trong giai đoạn. */
  const repeatWeeks = (dateKey: string) => {
    const found = classPlan && classPhaseAt(classPlan, dateKey);
    return found ? Math.floor(diffDateKeys(dateKey, found.endDate) / 7) : 0;
  };

  const openAdd = (dateKey: string, time: string) => {
    const options = subjectsFor(dateKey);
    if (options.length === 0) {
      toast.push('Ngày này không thuộc giai đoạn nào của lớp', 'error');
      return;
    }
    // Ưu tiên môn còn thiếu buổi trong tuần đó.
    const dayWeek = Math.floor(diffDateKeys(item.startDate, dateKey) / 7) + 1;
    const short = progress?.weeks.find((entry) => entry.week === dayWeek)?.subjects.find((entry) => entry.scheduledSessions < entry.minSessions);
    const subject = options.find((option) => option.id === short?.subjectId) ?? options[0];
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

  // Nút Thêm buổi: ngày sớm nhất còn xếp được trong tuần (không ở quá khứ). Hôm nay thì lấy giờ tròn kế tiếp.
  const addFromButton = () => {
    const today = clubToday();
    const firstDay = [today, weekStart, item.startDate].sort().at(-1)!;
    const hour = Number(clubTime(new Date().toISOString()).slice(0, 2)) + 1;
    openAdd(firstDay, firstDay === today && hour > 6 ? `${String(Math.min(hour, 23)).padStart(2, '0')}:00` : '06:00');
  };

  const openSession = (session: TrainingSession) => {
    if (canEdit && editable(session)) openEdit(session);
    else navigate(links.session(session.id));
  };

  const submitEdit = (draft: SessionDraft, repeat: boolean) => {
    const subject = subjectById(draft.subjectId) ?? subjectsFor(clubDateKey(draft.scheduledStartAt)).find((entry) => entry.id === draft.subjectId);
    if (!subject || !editing) return;
    const trial = subject.sessionType === 'TIME_TRIAL';
    const body: SessionInput = {
      name: draft.name.trim(),
      subjectId: subject.id,
      intensity: draft.intensity,
      plannedDistanceM: draft.plannedDistanceM,
      scheduledStartAt: draft.scheduledStartAt,
      scheduledEndAt: draft.scheduledEndAt,
      // Sửa buổi: ô xóa trắng gửi null để BE xóa giá trị cũ. Thêm buổi: bỏ trống thì không gửi.
      location: draft.location.trim() || (editing.session ? null : undefined),
      surface: draft.surface.trim() || (editing.session ? null : undefined),
      notes: draft.notes.trim() || (editing.session ? null : undefined),
    };
    const existing = editing.session;
    if (existing) {
      // Loại buổi theo môn. Môn thường thì BE tự bỏ mục tiêu, không gửi.
      void save.run(
        () => updateSession(existing.id, trial ? { ...body, targetTimeMs: draft.targetTimeMs ?? null } : body),
        () => {
          toast.push('Đã lưu buổi tập', 'success');
          setEditing(null);
          reload();
        },
      );
      return;
    }
    const first: SessionInput = { ...body, sessionType: subject.sessionType, ...(trial ? { targetTimeMs: draft.targetTimeMs ?? null } : {}) };
    const extra = repeat ? repeatWeeks(clubDateKey(draft.scheduledStartAt)) : 0;
    const all = Array.from({ length: extra + 1 }, (_, index) => ({
      ...first,
      scheduledStartAt: addMinutes(first.scheduledStartAt, index * 7 * 24 * 60),
      scheduledEndAt: addMinutes(first.scheduledEndAt, index * 7 * 24 * 60),
    }));
    void save.run(
      (): Promise<unknown> => (all.length > 1 ? addSessions(item.id, all) : addSession(item.id, first)),
      () => {
        toast.push(all.length > 1 ? `Đã thêm ${all.length} buổi, mỗi tuần một buổi` : 'Đã thêm buổi tập', 'success');
        setEditing(null);
        reload();
      },
    );
  };

  const moveSession = (session: TrainingSession, startAt: string) => {
    const end = shiftEnd(session, startAt);
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

  const weekSubjects = weekProgress?.subjects ?? [];
  const weekMet = weekSubjects.filter((subject) => subject.scheduledSessions >= subject.minSessions).length;
  const scheduledMinutes = progress?.scheduledMinutes ?? 0;
  const minTotal = progress?.minTotalMinutes ?? classPlan?.minTotalMinutes ?? 0;


  return (
    <div className="space-y-4">
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
          <p className="font-mono text-xs text-gray-500">
            {shortDate(weekStart)} đến {shortDate(weekEnd > item.endDate ? item.endDate : weekEnd)}
          </p>
        </div>
        {currentWeek >= 1 && currentWeek <= totalWeeks && currentWeek !== week && (
          <Button variant="inline" size="sm" onClick={() => setWeek(currentWeek)}>
            Về tuần này
          </Button>
        )}
        {canEdit && (
          <Button size="sm" className="ml-auto" onClick={addFromButton}>
            <Plus size={14} /> Thêm buổi
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
              'relative shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-semibold transition',
              value === week ? 'bg-emerald-700 text-white' : value === currentWeek ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            T{value}
            {shortWeeks.has(value) && <span aria-label="còn thiếu buổi" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />}
          </button>
        ))}
      </div>

      {(move.error || cancel.error) && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{move.error ?? cancel.error}</p>}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-9">
          <WeekCalendar
            weekStart={weekStart}
            sessions={shown}
            range={range}
            canAdd={canEdit}
            canMove={(session) => canEdit && editable(session) && !move.pending}
            onAdd={openAdd}
            onOpen={openSession}
            onMove={moveSession}
            onBlocked={(message) => toast.push(message, 'error')}
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded', INTENSITY_FILL.LIGHT)} /> Nhẹ
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded', INTENSITY_FILL.HEAVY)} /> Nặng
            </span>
            {canEdit && <span>Bấm ô trống để thêm buổi. Sửa, kéo đổi giờ được tới 30 phút trước giờ bắt đầu (lúc mở điểm danh).</span>}
          </div>
        </div>

        {/* Tiến độ tuần và cả lớp */}
        <aside className="space-y-3 lg:col-span-3">
          <section className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_-16px_rgba(4,120,87,0.35)] ring-1 ring-emerald-900/5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold text-gray-900">Tuần {week}</h3>
              {weekSubjects.length > 0 && (
                <span className={cn('text-xs font-semibold', weekMet === weekSubjects.length ? 'text-emerald-700' : 'text-amber-700')}>
                  {weekMet === weekSubjects.length ? 'Đủ buổi tối thiểu' : `Còn ${weekSubjects.length - weekMet} môn thiếu`}
                </span>
              )}
            </div>
            {weekSubjects.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Chưa có tiến độ của tuần này.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {weekSubjects.map((subject) => {
                  const enough = subject.scheduledSessions >= subject.minSessions;
                  return (
                    <li key={subject.subjectId}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-gray-700">{subject.subjectName}</span>
                        <span className={cn('shrink-0 font-mono text-xs font-semibold', enough ? 'text-emerald-700' : 'text-amber-700')}>
                          {subject.scheduledSessions}/{subject.minSessions}
                        </span>
                      </div>
                      <ProgressFill ratio={subject.minSessions ? subject.scheduledSessions / subject.minSessions : 1} tone={enough ? 'green' : 'amber'} className="mt-1" />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-700/10">
            <p className="text-xs text-emerald-900/70">Cả lớp đã xếp</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-emerald-950">
              {formatTotalMinutes(scheduledMinutes)}
              <span className="text-sm font-normal text-emerald-900/60"> / {formatTotalMinutes(minTotal)}</span>
            </p>
            <ProgressFill ratio={minTotal ? scheduledMinutes / minTotal : 0} tone={scheduledMinutes >= minTotal && minTotal > 0 ? 'green' : 'amber'} className="mt-2" />
            <p className="mt-2 text-xs text-emerald-900/70">
              {shortWeeks.size ? `${shortWeeks.size} tuần còn thiếu buổi. Thiếu không bị chặn, chỉ để nhắc.` : 'Mọi tuần đã đủ số buổi tối thiểu.'}
            </p>
          </section>
        </aside>
      </div>

      {editing && (
        <SessionEditSheet
          title={editing.session ? 'Sửa buổi tập' : 'Thêm buổi'}
          description={editing.session ? `${editing.session.name}, ${formatDate(editing.session.scheduledStartAt)}` : 'Buổi lưu xong có hiệu lực ngay, Groom và chủ ngựa thấy lịch.'}
          initial={editing.initial}
          subjects={subjects}
          subjectsFor={subjectsFor}
          repeatWeeks={editing.session ? undefined : repeatWeeks}
          range={range}
          pending={save.pending}
          error={save.error}
          fieldErrors={save.fieldErrors}
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
