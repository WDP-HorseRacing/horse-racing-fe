// Tab Lịch buổi của lớp: gom theo tuần của lớp, tuần hiện tại mở sẵn. Buổi nháp viền nét đứt, sửa được.
// HLV công bố từng buổi, thêm buổi, hủy buổi (cần lý do). Buổi vừa công bố được "đổ mực" từ trái sang.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Clock3, MapPin, Megaphone, Pencil, Plus, XCircle } from 'lucide-react';
import { addSession, cancelSession, createTimeTrial, getTimeTrial, publishSession, updateSession, updateTimeTrial } from '../../../api/training';
import type { TrainingSession } from '../../../api/types';
import { Button, EmptyState, cn, useToast } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';
import { formatDate } from '../../../lib/format';
import { addMinutes, clubDateKey, clubInstant, clubTime, clubToday, diffDateKeys, isoWeekdayOf } from '../../../lib/club-time';
import { formatMeters } from '../../../lib/training-format';
import { weekdayShort } from '../../../lib/training-labels';
import { gsap } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { IntensityBars, SessionStatusPill, TrialBadge } from '../components/bits';
import { ReasonDialog } from '../components/ReasonDialog';
import { SessionEditSheet, draftFromSubject, type SessionDraft } from '../components/SessionEditSheet';
import { links } from '../../../lib/links';
import type { ClassBundle } from './class-bundle';

export default function ClassSessionsTab({ bundle, manage, reload, justPublished }: { bundle: ClassBundle; manage: boolean; reload: () => void; justPublished: string[] }) {
  const toast = useToast();
  const { item, sessions, subjects } = bundle;
  const open = item.status === 'DRAFT' || item.status === 'ACTIVE';
  const listRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<{ session?: TrainingSession; initial: SessionDraft } | null>(null);
  const [cancelling, setCancelling] = useState<TrainingSession | null>(null);
  const [publishedNow, setPublishedNow] = useState<string[]>([]);
  const save = useAction();
  const publish = useAction();
  const cancel = useAction();
  const animated = useRef(new Set<string>());

  const weekOf = (session: TrainingSession) => Math.floor(diffDateKeys(item.startDate, clubDateKey(session.scheduledStartAt)) / 7) + 1;
  const weeks = useMemo(() => {
    const map = new Map<number, TrainingSession[]>();
    [...sessions]
      .sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt))
      .forEach((session) => {
        const week = weekOf(session);
        map.set(week, [...(map.get(week) ?? []), session]);
      });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, item.startDate]);
  const currentWeek = Math.floor(diffDateKeys(item.startDate, clubToday()) / 7) + 1;
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([Math.max(1, currentWeek), currentWeek + 1]));

  // Buổi vừa công bố: lớp màu xanh nhạt quét từ trái sang rồi tan, khi dòng đã đổi sang trạng thái đã công bố.
  const targets = [...justPublished, ...publishedNow];
  useEffect(() => {
    if (!listRef.current || prefersReducedMotion()) return;
    const ready = targets.filter((id) => !animated.current.has(id) && sessions.find((session) => session.id === id)?.status === 'SCHEDULED');
    if (ready.length === 0) return;
    ready.forEach((id) => animated.current.add(id));
    const inks = ready.map((id) => listRef.current?.querySelector(`[data-session-row="${id}"] [data-ink]`)).filter(Boolean) as Element[];
    gsap
      .timeline()
      .fromTo(inks, { opacity: 1, clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.55, stagger: 0.08, ease: 'power2.inOut' })
      .to(inks, { opacity: 0, duration: 0.6, stagger: 0.05 }, '+=0.15');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, targets.join(',')]);

  const subjectOf = (session: TrainingSession) => subjects.find((subject) => subject.id === session.subjectId);

  const openEdit = async (session: TrainingSession) => {
    const subject = subjectOf(session);
    let targetTimeMs: number | undefined;
    if (session.sessionType === 'TIME_TRIAL') {
      try {
        targetTimeMs = (await getTimeTrial(session.id)).targetTimeMs ?? undefined;
      } catch {
        targetTimeMs = subject?.targetTimeMs ?? undefined;
      }
    }
    setEditing({
      session,
      initial: {
        subjectId: session.subjectId ?? subject?.id ?? '',
        name: session.name,
        intensity: session.intensity,
        plannedDistanceM: session.plannedDistanceM,
        surface: session.surface ?? '',
        location: session.location ?? '',
        notes: session.notes ?? '',
        targetTimeMs,
        scheduledStartAt: session.scheduledStartAt,
        scheduledEndAt: session.scheduledEndAt,
      },
    });
  };

  const openAdd = () => {
    const today = clubToday();
    const day = today >= item.startDate && today <= item.endDate ? today : item.startDate;
    const subject = bundle.plan?.subjects.find((entry) => {
      const week = Math.floor(diffDateKeys(item.startDate, day) / 7) + 1;
      return week >= entry.startWeek && week < entry.startWeek + entry.weeks;
    })?.subject ?? subjects[0];
    if (!subject) {
      toast.push('Chưa có môn học nào để thêm buổi', 'error');
      return;
    }
    const start = clubInstant(day, '06:00');
    setEditing({ initial: draftFromSubject(subject, start, addMinutes(start, 60)) });
  };

  const submitEdit = (draft: SessionDraft) => {
    const subject = subjects.find((entry) => entry.id === draft.subjectId);
    if (!subject || !editing) return;
    const trial = subject.sessionType === 'TIME_TRIAL';
    const body = {
      name: draft.name.trim(),
      subjectId: subject.id,
      sessionType: subject.sessionType,
      intensity: draft.intensity,
      plannedDistanceM: draft.plannedDistanceM,
      scheduledStartAt: draft.scheduledStartAt,
      scheduledEndAt: draft.scheduledEndAt,
      location: draft.location.trim() || undefined,
      surface: draft.surface.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    };
    void save.run(
      async () => {
        if (editing.session) {
          const wasTrial = editing.session.sessionType === 'TIME_TRIAL';
          const saved = await updateSession(editing.session.id, body);
          if (trial && wasTrial) await updateTimeTrial(saved.id, { distanceM: draft.plannedDistanceM, targetTimeMs: draft.targetTimeMs ?? null });
          if (trial && !wasTrial) await createTimeTrial(saved.id, { distanceM: draft.plannedDistanceM, targetTimeMs: draft.targetTimeMs });
          return saved;
        }
        const created = await addSession(item.id, body);
        // Buổi chạy thử thêm lẻ chưa có cấu hình chạy thử: tạo luôn để công bố được.
        if (trial) await createTimeTrial(created.id, { distanceM: draft.plannedDistanceM, targetTimeMs: draft.targetTimeMs });
        return created;
      },
      () => {
        toast.push(editing.session ? 'Đã lưu buổi tập' : 'Đã thêm buổi nháp', 'success');
        setEditing(null);
        reload();
      },
    );
  };

  const runPublish = (session: TrainingSession) =>
    void publish.run(
      () => publishSession(session.id),
      () => {
        toast.push(`Đã công bố buổi ${session.name}`, 'success');
        setPublishedNow((current) => [...current, session.id]);
        reload();
      },
    );

  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Lớp chưa có buổi tập"
        action={
          manage &&
          open && (
            <Button onClick={openAdd}>
              <Plus size={15} /> Thêm buổi
            </Button>
          )
        }
      />
    );
  }

  // Buổi chạy thử đã có cấu hình chạy thử thì không đổi về buổi thường được (BE chặn): chỉ cho chọn môn chạy thử.
  const editSubjects = editing?.session?.sessionType === 'TIME_TRIAL' ? subjects.filter((subject) => subject.sessionType === 'TIME_TRIAL') : subjects;

  return (
    <div ref={listRef} className="space-y-3">
      {(publish.error || cancel.error) && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{publish.error ?? cancel.error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          Buổi nháp chỉ HLV thấy. Công bố buổi thì mỗi ngựa đang học có một lượt tập, Groom thấy lịch dắt ngựa.
        </p>
        {manage && open && (
          <Button variant="inline" size="sm" onClick={openAdd}>
            <Plus size={14} /> Thêm buổi
          </Button>
        )}
      </div>

      {weeks.map(([week, list]) => {
        const isOpen = expanded.has(week);
        const planSubject = bundle.plan?.subjects.find((entry) => week >= entry.startWeek && week < entry.startWeek + entry.weeks)?.subject;
        const done = list.filter((session) => session.status === 'COMPLETED').length;
        const drafts = list.filter((session) => session.status === 'DRAFT').length;
        return (
          <section key={week} className="overflow-hidden rounded-2xl ring-1 ring-gray-200/80">
            <button
              type="button"
              onClick={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(week)) next.delete(week);
                  else next.add(week);
                  return next;
                })
              }
              className={cn('flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition', week === currentWeek ? 'bg-emerald-50/70' : 'bg-gray-50/70 hover:bg-gray-50')}
            >
              <span className="font-mono text-sm font-semibold text-gray-900">Tuần {week}</span>
              {planSubject && <span className="text-sm text-gray-600">{planSubject.name}</span>}
              {week === currentWeek && <span className="rounded-md bg-emerald-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">Tuần này</span>}
              <span className="ml-auto text-xs text-gray-500">
                {list.length} buổi · {done} đã xong{drafts ? ` · ${drafts} nháp` : ''}
              </span>
              <ChevronDown size={16} className={cn('text-gray-400 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <ul className="divide-y divide-gray-100 bg-white">
                {list.map((session) => {
                  const day = clubDateKey(session.scheduledStartAt);
                  const draft = session.status === 'DRAFT';
                  const finished = session.status === 'COMPLETED' || session.status === 'CANCELLED';
                  return (
                    <li key={session.id} data-session-row={session.id} className="relative">
                      <span data-ink aria-hidden className="pointer-events-none absolute inset-0 bg-emerald-100/80 opacity-0" />
                      <div className={cn('relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', draft && 'm-2 rounded-xl session-draft bg-gray-50/40')}>
                        <div className="w-14 shrink-0 text-center">
                          <p className="text-xs font-semibold text-gray-500">{weekdayShort[isoWeekdayOf(day)]}</p>
                          <p className="font-mono text-sm font-semibold text-gray-900">{formatDate(session.scheduledStartAt).slice(0, 5)}</p>
                        </div>
                        <div className="min-w-0 flex-1 basis-56">
                          <div className="flex items-center gap-2">
                            <p className={cn('truncate font-semibold', session.status === 'CANCELLED' ? 'text-gray-400 line-through' : 'text-gray-900')}>{session.name}</p>
                            <TrialBadge type={session.sessionType} />
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Clock3 size={11} /> {clubTime(session.scheduledStartAt)} đến {clubTime(session.scheduledEndAt)}
                            </span>
                            <IntensityBars intensity={session.intensity} />
                            <span className="font-mono">{formatMeters(session.plannedDistanceM)}</span>
                            {session.surface && <span>{session.surface}</span>}
                            {session.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} /> {session.location}
                              </span>
                            )}
                          </div>
                          {session.cancelReason && <p className="mt-0.5 text-xs text-red-700">Lý do hủy: {session.cancelReason}</p>}
                        </div>
                        <SessionStatusPill status={session.status} />
                        <div className="flex flex-wrap items-center gap-1.5">
                          {manage && open && draft && (
                            <Button variant="inline" size="sm" onClick={() => void openEdit(session)}>
                              <Pencil size={13} /> Sửa
                            </Button>
                          )}
                          {manage && item.status === 'ACTIVE' && draft && (
                            <Button size="sm" disabled={publish.pending} onClick={() => runPublish(session)}>
                              <Megaphone size={13} /> Công bố
                            </Button>
                          )}
                          {!draft && (
                            <Link to={links.session(session.id)}>
                              <Button variant={session.status === 'IN_PROGRESS' ? 'primary' : 'secondary'} size="sm">
                                {session.status === 'IN_PROGRESS' ? 'Vào sân tập' : 'Mở buổi'}
                              </Button>
                            </Link>
                          )}
                          {manage && open && !finished && (
                            <Button variant="ghost" size="icon" title="Hủy buổi" onClick={() => setCancelling(session)}>
                              <XCircle size={15} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {editing && (
        <SessionEditSheet
          title={editing.session ? 'Sửa buổi nháp' : 'Thêm buổi'}
          description={editing.session ? 'Chỉ sửa được buổi chưa công bố.' : 'Buổi mới ở trạng thái nháp, công bố sau.'}
          initial={editing.initial}
          subjects={editSubjects}
          range={{ from: item.startDate, to: item.endDate }}
          pending={save.pending}
          error={save.error}
          submitLabel={editing.session ? 'Lưu buổi' : 'Thêm buổi'}
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
            )
          }
        />
      )}
    </div>
  );
}
