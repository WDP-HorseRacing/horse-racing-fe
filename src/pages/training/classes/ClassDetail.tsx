// F2.3 — Chi tiết lớp: đầu trang có thời gian của lớp, số phút đã xếp so với tối thiểu của giáo án và nút theo trạng thái,
// thẻ "Việc tiếp theo" (xếp lịch, ghi danh, mở sân tập), rồi các tab Lịch buổi, Ngựa, Kết quả, Thông tin (khóa tab qua ?tab=).
// Lớp chạy ngay khi tạo: không còn kích hoạt hay công bố, buổi lưu xong có hiệu lực ngay.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, CheckCircle2, Flag, UserPlus, XCircle } from 'lucide-react';
import { getClass, getClassPlan, getClassProgress, getPlan, listEnrollments, listSessions, listSubjects, setClassStatus } from '../../../api/training';
import type { ClassPlan, ClassProgress, TrainingPlan, TrainingSubject } from '../../../api/types';
import { Button, ConfirmDialog, ErrorBox, NotFound, Tabs, TabPanel, Tip, cn, useToast } from '../../../components/ui';
import { useAction, useService } from '../../../hooks/useService';
import { useStore } from '../../../store/store';
import { can } from '../../../auth/permissions';
import { useCrumbs } from '../../../components/Breadcrumb';
import { links } from '../../../lib/links';
import { formatDate } from '../../../lib/format';
import { clubTime, clubToday, diffDateKeys } from '../../../lib/club-time';
import { distanceLabel } from '../../../lib/labels';
import { gsap, useGSAP } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { ClassStatusPill, WeekRibbon } from '../components/bits';
import { formatTotalMinutes, planPhases } from '../plan-helpers';
import { ProgressFill } from '../components/motion';
import { ReasonDialog } from '../components/ReasonDialog';
import { useUserNames } from '../hooks';
import ClassSessionsTab from './ClassSessionsTab';
import ClassHorsesTab from './ClassHorsesTab';
import ClassResultsTab from './ClassResultsTab';
import ClassInfoTab from './ClassInfoTab';
import type { ClassBundle } from './class-bundle';
import { BackLink } from '../../../components/BackLink';


export default function ClassDetail() {
  const { id = '' } = useParams();
  const user = useStore((state) => state.currentUser);
  const [params, setParams] = useSearchParams();
  const data = useService(async (): Promise<ClassBundle> => {
    const item = await getClass(id);
    const [sessions, enrollments, plan, classPlan, progress, subjects] = await Promise.all([
      listSessions(id),
      listEnrollments(id),
      // Giáo án mẫu và danh mục môn chỉ gọi khi vai trò được đọc (bác sĩ, Groom, chủ ngựa không có quyền: BE trả 403).
      can(user, 'plan.view') ? getPlan(item.planId).catch(() => undefined as TrainingPlan | undefined) : Promise.resolve(undefined),
      getClassPlan(id).catch(() => undefined as ClassPlan | undefined),
      getClassProgress(id).catch(() => undefined as ClassProgress | undefined),
      can(user, 'subject.view') ? listSubjects().catch(() => [] as TrainingSubject[]) : Promise.resolve([] as TrainingSubject[]),
    ]);
    return { item, sessions, enrollments, plan, classPlan, progress, subjects };
  }, [id, user?.id]);
  const users = useUserNames(user?.role === 'CLUB_MANAGER');
  // Lớp quá ngày kết thúc có thể tự hoàn thành mà không ai bấm: quay lại tab thì tải lại lớp.
  const { reload: reloadClass } = data;
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) reloadClass();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reloadClass]);
  useCrumbs(data.data ? [{ label: data.data.item.name }] : null, [{ label: 'Lớp huấn luyện', to: links.classes }]);

  if (data.loading && !data.data) return <ClassSkeleton />;
  if (data.error || !data.data) return <NotFound message={data.error} />;
  const bundle = data.data;
  const manage = user?.role === 'HEAD_TRAINER' && bundle.item.headTrainerId === user.id;
  const tab = ['sessions', 'horses', 'results', 'info'].includes(params.get('tab') ?? '') ? (params.get('tab') as string) : 'sessions';

  return (
    <ClassView
      bundle={bundle}
      manage={manage}
      trainerName={bundle.item.headTrainerId ? users.get(bundle.item.headTrainerId)?.fullName : undefined}
      tab={tab}
      onTab={(key) => setParams(key === 'sessions' ? {} : { tab: key }, { replace: true })}
      reload={data.reload}
      refreshing={data.refreshing}
    />
  );
}

function ClassSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-40 w-full rounded-3xl" />
      <div className="skeleton h-72 w-full rounded-2xl" />
    </div>
  );
}

function ClassView({
  bundle,
  manage,
  trainerName,
  tab,
  onTab,
  reload,
}: {
  bundle: ClassBundle;
  manage: boolean;
  trainerName?: string;
  tab: string;
  onTab: (key: string) => void;
  reload: () => void;
  refreshing: boolean;
}) {
  const toast = useToast();
  const { item, sessions, enrollments, plan, classPlan, progress } = bundle;
  const scope = useRef<HTMLDivElement>(null);
  const status = useAction();
  const [confirm, setConfirm] = useState<'complete' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const today = clubToday();
  const totalDays = diffDateKeys(item.startDate, item.endDate) + 1;
  const elapsed = Math.min(totalDays, Math.max(0, diffDateKeys(item.startDate, today) + 1));
  const counted = sessions.filter((session) => session.status !== 'CANCELLED');
  const done = counted.filter((session) => session.status === 'COMPLETED').length;
  const unfinished = sessions.filter((session) => session.status === 'SCHEDULED' || session.status === 'IN_PROGRESS').length;
  const activeHorses = enrollments.filter((enrollment) => enrollment.status === 'ACTIVE').length;
  const open = item.status === 'ACTIVE';
  const now = new Date().toISOString();
  const nextSession = sessions
    .filter((session) => session.status === 'IN_PROGRESS' || (session.status === 'SCHEDULED' && session.scheduledEndAt >= now))
    .sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt))[0];
  const started = sessions.some((session) => session.status === 'IN_PROGRESS' || session.status === 'COMPLETED');
  const scheduled = progress?.scheduledMinutes ?? 0;
  const minimum = progress?.minTotalMinutes ?? classPlan?.minTotalMinutes ?? 0;
  // Tuần còn thiếu buổi so với tối thiểu (không chặn, chỉ nhắc).
  const shortWeeks = (progress?.weeks ?? []).filter((week) => week.endDate >= today && week.subjects.some((subject) => subject.scheduledSessions < subject.minSessions)).length;

  // Đầu trang: thanh thời gian chạy tới hôm nay, các ô số hiện dần.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from('[data-class-fact]', { opacity: 0, y: 12, duration: 0.4, stagger: 0.05, ease: 'power3.out', clearProps: 'all' });
      gsap.from('[data-next-step]', { opacity: 0, x: -10, duration: 0.35, stagger: 0.06, delay: 0.2, ease: 'power3.out', clearProps: 'all' });
    },
    { scope },
  );

  const changeStatus = (next: 'COMPLETED' | 'CANCELLED', reason?: string) =>
    void status.run(
      () => setClassStatus(item.id, next, reason),
      () => {
        toast.push(next === 'COMPLETED' ? 'Lớp đã hoàn thành' : 'Đã hủy lớp', 'success');
        setConfirm(null);
        setCancelOpen(false);
        reload();
      },
    ).then((result) => result === undefined && reload());

  const steps = [
    { key: 'schedule', label: 'Xếp lịch buổi', done: counted.length > 0 },
    { key: 'enroll', label: 'Ghi danh ngựa', done: activeHorses > 0 },
    { key: 'run', label: 'Mở sân tập buổi đầu tiên', done: started },
  ];
  const currentStep = steps.find((step) => !step.done)?.key;

  return (
    <div ref={scope} className="space-y-5">
      <BackLink fallback={links.classes} />

      <section className="turf-soft rounded-3xl p-5 shadow-grass-tint ring-1 ring-emerald-900/10 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-sm text-gray-500">{item.code}</p>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">{item.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
              <ClassStatusPill status={item.status} />
              {plan && (
                <Link to={links.plan(plan.id)} className="font-medium text-emerald-800 hover:underline">
                  {plan.name}
                </Link>
              )}
              {trainerName && <span>HLV {trainerName}</span>}
              {item.raceAptitude && <span>Sở trường {distanceLabel[item.raceAptitude].toLowerCase()}</span>}
            </div>
            {item.description && <p className="mt-2 max-w-2xl text-sm text-gray-600">{item.description}</p>}
            {item.cancelReason && <p className="mt-2 text-sm text-red-700">Lý do hủy: {item.cancelReason}</p>}
          </div>
          {manage && open && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => setEnrollOpen(true)}>
                <UserPlus size={15} /> Ghi danh ngựa
              </Button>
              {tab !== 'sessions' && (
                <Button onClick={() => onTab('sessions')}>
                  <CalendarDays size={15} /> Xếp lịch
                </Button>
              )}
              <Tip content={unfinished ? `Còn ${unfinished} buổi chưa kết thúc` : 'Kết thúc lớp, ngựa rời lớp'}>
                <span>
                  <Button variant="secondary" disabled={unfinished > 0} onClick={() => setConfirm('complete')}>
                    <CheckCircle2 size={15} /> Hoàn thành lớp
                  </Button>
                </span>
              </Tip>
              <Button variant="inlineDanger" onClick={() => setCancelOpen(true)}>
                <XCircle size={15} /> Hủy lớp
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-12 [&>*]:min-w-0">
          <div data-class-fact className="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-900/10 sm:col-span-5">
            <div className="flex justify-between font-mono text-xs text-gray-500">
              <span>{formatDate(item.startDate)}</span>
              <span>
                ngày {Math.max(0, elapsed)} trên {totalDays}
              </span>
              <span>{formatDate(item.endDate)}</span>
            </div>
            <ProgressFill ratio={totalDays ? elapsed / totalDays : 0} tone={item.status === 'ACTIVE' ? 'green' : 'gray'} className="mt-2" />
            {classPlan && <WeekRibbon phases={planPhases(classPlan)} size="sm" className="mt-3" highlightWeek={Math.floor(Math.max(0, elapsed - 1) / 7) + 1} />}
            <p className="mt-3 truncate text-xs text-gray-600">
              Buổi kế tiếp:{' '}
              {nextSession ? (
                <Link to={links.session(nextSession.id)} className="font-medium text-gray-900 hover:text-emerald-800">
                  <span className="font-mono">
                    {formatDate(nextSession.scheduledStartAt).slice(0, 5)} {clubTime(nextSession.scheduledStartAt)}
                  </span>{' '}
                  {nextSession.name}
                </Link>
              ) : (
                <span className="text-gray-400">chưa có</span>
              )}
            </p>
          </div>
          <div data-class-fact className="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-900/10 sm:col-span-3">
            <p className="text-xs text-gray-500">Đã xếp so với tối thiểu</p>
            <p className="font-mono text-lg font-bold tabular-nums">
              {formatTotalMinutes(scheduled)}
              <span className="text-sm font-medium text-gray-400"> / {formatTotalMinutes(minimum)}</span>
            </p>
            <ProgressFill ratio={minimum ? Math.min(1, scheduled / minimum) : 0} tone={scheduled >= minimum && minimum > 0 ? 'green' : 'gray'} className="mt-2" />
            {shortWeeks > 0 && <p className="mt-1.5 text-xs text-amber-800">{shortWeeks} tuần còn thiếu buổi</p>}
          </div>
          <div data-class-fact className="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-900/10 sm:col-span-2">
            <p className="text-xs text-gray-500">Buổi đã xong</p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {done}
              <span className="text-base text-gray-400">/{counted.length}</span>
            </p>
          </div>
          <div data-class-fact className="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-900/10 sm:col-span-2">
            <p className="text-xs text-gray-500">Ngựa đang học</p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {activeHorses}
              <span className="text-base text-gray-400">/{item.maxHorses}</span>
            </p>
          </div>
        </div>
      </section>

      {manage && open && !started && (
        <section className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200/80 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <h3 className="font-semibold text-gray-900">Việc tiếp theo</h3>
          </div>
          <ul className="grid gap-2 sm:grid-cols-3 lg:col-span-9">
            {steps.map((step) => (
              <li
                key={step.key}
                data-next-step
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm ring-1',
                  step.done ? 'bg-emerald-50/60 text-emerald-900 ring-emerald-100' : step.key === currentStep ? 'bg-white font-semibold text-gray-900 ring-2 ring-emerald-500/60' : 'bg-gray-50 text-gray-500 ring-gray-100',
                )}
              >
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', step.done ? 'bg-emerald-600 text-white' : step.key === currentStep ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-400')}>
                  {step.done ? <Check size={14} strokeWidth={3} /> : step.key === 'run' ? <Flag size={12} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <span className="min-w-0 flex-1">{step.label}</span>
                {step.key === currentStep && step.key === 'schedule' && tab !== 'sessions' && (
                  <Button size="sm" onClick={() => onTab('sessions')}>
                    Mở lịch
                  </Button>
                )}
                {step.key === currentStep && step.key === 'enroll' && (
                  <Button size="sm" onClick={() => setEnrollOpen(true)}>
                    Ghi danh
                  </Button>
                )}
                {step.key === currentStep && step.key === 'run' && nextSession && (
                  <Link to={links.session(nextSession.id)}>
                    <Button size="sm">Mở sân tập</Button>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <Tabs
          active={tab}
          onChange={onTab}
          tabs={[
            { key: 'sessions', label: 'Lịch buổi', count: counted.length },
            { key: 'horses', label: 'Ngựa trong lớp', count: activeHorses },
            { key: 'results', label: 'Kết quả' },
            { key: 'info', label: 'Thông tin' },
          ]}
        />
        <TabPanel className="p-4 sm:p-5">
          {tab === 'sessions' && <ClassSessionsTab bundle={bundle} manage={manage} reload={reload} />}
          {tab === 'horses' && <ClassHorsesTab bundle={bundle} manage={manage} reload={reload} enrollOpen={enrollOpen} setEnrollOpen={setEnrollOpen} />}
          {tab === 'results' && <ClassResultsTab bundle={bundle} />}
          {tab === 'info' && <ClassInfoTab bundle={bundle} manage={manage} reload={reload} />}
        </TabPanel>
      </div>

      {/* Ghi danh mở được từ đầu trang khi đang ở tab khác */}
      {tab !== 'horses' && enrollOpen && <ClassHorsesTab bundle={bundle} manage={manage} reload={reload} enrollOpen setEnrollOpen={setEnrollOpen} sheetOnly />}

      <ConfirmDialog
        open={confirm === 'complete'}
        title="Hoàn thành lớp"
        danger={false}
        confirmLabel="Hoàn thành lớp"
        pending={status.pending}
        consequences={['Mọi ngựa đang học rời lớp', 'Lớp chỉ còn xem, không thêm buổi hay ghi danh được nữa']}
        message={
          <>
            Kết thúc lớp <b>{item.code}</b>.
            {status.error && <div className="mt-3"><ErrorBox message={status.error} /></div>}
          </>
        }
        onClose={() => {
          setConfirm(null);
          status.clearError();
        }}
        onConfirm={() => changeStatus('COMPLETED')}
      />
      {cancelOpen && (
        <ReasonDialog
          title="Hủy lớp"
          message={
            <>
              Hủy lớp <b>{item.code}</b>. Các buổi chưa diễn ra bị hủy, lượt tập còn mở bị hủy, ngựa rời lớp. Không hủy được khi còn ngựa đang chạy.
            </>
          }
          label="Lý do hủy lớp"
          suggestions={['Giáo án không còn phù hợp', 'Mở nhầm lớp', 'Sân tập bảo trì dài ngày']}
          confirmLabel="Hủy lớp"
          pending={status.pending}
          error={status.error}
          onClose={() => {
            setCancelOpen(false);
            status.clearError();
          }}
          onConfirm={(reason) => changeStatus('CANCELLED', reason)}
        />
      )}
    </div>
  );
}

