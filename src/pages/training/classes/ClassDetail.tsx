// F2.3 — Chi tiết lớp: đầu trang có thời gian của lớp và nút theo trạng thái, thẻ "Việc tiếp theo" dẫn HLV đúng thứ tự BE yêu cầu
// (kích hoạt, ghi danh, công bố, mở sân tập), rồi các tab Lịch buổi, Ngựa, Kết quả, Thông tin (khóa tab qua ?tab=).
import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck2, Check, CheckCircle2, Flag, Megaphone, Play, UserPlus, XCircle } from 'lucide-react';
import { getClass, getPlan, listEnrollments, listSessions, listSubjects, publishSessions, setClassStatus } from '../../../api/training';
import type { TrainingPlan, TrainingSubject } from '../../../api/types';
import { ActionMenu, Button, ConfirmDialog, ErrorBox, Field, Modal, NotFound, Tabs, TabPanel, Tip, cn, useToast } from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { useAction, useService } from '../../../hooks/useService';
import { useStore } from '../../../store/store';
import { useCrumbs } from '../../../components/Breadcrumb';
import { links } from '../../../lib/links';
import { formatDate } from '../../../lib/format';
import { addDateKey, clubDateKey, clubTime, clubToday, diffDateKeys, mondayOf } from '../../../lib/club-time';
import { distanceLabel } from '../../../lib/labels';
import { gsap, useGSAP } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { ClassStatusPill, WeekRibbon, planSegments } from '../components/bits';
import { ProgressFill } from '../components/motion';
import { ReasonDialog } from '../components/ReasonDialog';
import { useUserNames } from '../hooks';
import ClassSessionsTab from './ClassSessionsTab';
import ClassHorsesTab from './ClassHorsesTab';
import ClassResultsTab from './ClassResultsTab';
import ClassInfoTab from './ClassInfoTab';
import type { ClassBundle } from './class-bundle';


export default function ClassDetail() {
  const { id = '' } = useParams();
  const user = useStore((state) => state.currentUser);
  const [params, setParams] = useSearchParams();
  const data = useService(async (): Promise<ClassBundle> => {
    const item = await getClass(id);
    const [sessions, enrollments, plan, subjects] = await Promise.all([
      listSessions(id),
      listEnrollments(id),
      getPlan(item.planId).catch(() => undefined as TrainingPlan | undefined),
      listSubjects().catch(() => [] as TrainingSubject[]),
    ]);
    return { item, sessions, enrollments, plan, subjects };
  }, [id]);
  const users = useUserNames(user?.role === 'CLUB_MANAGER');
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
  const { item, sessions, enrollments, plan } = bundle;
  const scope = useRef<HTMLDivElement>(null);
  const status = useAction();
  const publish = useAction();
  const [confirm, setConfirm] = useState<'activate' | 'complete' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [published, setPublished] = useState<string[]>([]);
  const [pastWarning, setPastWarning] = useState<{ from?: string; to?: string } | null>(null);

  const today = clubToday();
  const totalDays = diffDateKeys(item.startDate, item.endDate) + 1;
  const elapsed = Math.min(totalDays, Math.max(0, diffDateKeys(item.startDate, today) + 1));
  const counted = sessions.filter((session) => session.status !== 'CANCELLED');
  const done = counted.filter((session) => session.status === 'COMPLETED').length;
  const drafts = sessions.filter((session) => session.status === 'DRAFT');
  const unfinished = sessions.filter((session) => session.status === 'DRAFT' || session.status === 'SCHEDULED' || session.status === 'IN_PROGRESS').length;
  const activeHorses = enrollments.filter((enrollment) => enrollment.status === 'ACTIVE').length;
  const open = item.status === 'DRAFT' || item.status === 'ACTIVE';
  const now = new Date().toISOString();
  const nextSession = sessions
    .filter((session) => session.status === 'IN_PROGRESS' || (session.status === 'SCHEDULED' && session.scheduledEndAt >= now))
    .sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt))[0];
  const started = sessions.some((session) => session.status === 'IN_PROGRESS' || session.status === 'COMPLETED');

  // Đầu trang: thanh thời gian chạy tới hôm nay, các ô số hiện dần.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from('[data-class-fact]', { opacity: 0, y: 12, duration: 0.4, stagger: 0.05, ease: 'power3.out', clearProps: 'all' });
      gsap.from('[data-next-step]', { opacity: 0, x: -10, duration: 0.35, stagger: 0.06, delay: 0.2, ease: 'power3.out', clearProps: 'all' });
    },
    { scope },
  );

  const changeStatus = (next: 'ACTIVE' | 'COMPLETED' | 'CANCELLED', reason?: string) =>
    void status.run(
      () => setClassStatus(item.id, next, reason),
      () => {
        toast.push(next === 'ACTIVE' ? 'Đã kích hoạt lớp. Giờ ghi danh ngựa và công bố buổi.' : next === 'COMPLETED' ? 'Lớp đã hoàn thành' : 'Đã hủy lớp', 'success');
        setConfirm(null);
        setCancelOpen(false);
        reload();
      },
    );

  // Buổi nháp đã qua giờ bắt đầu: công bố thì ngựa ghi danh sau giờ đó không có lượt (BE chỉ lấy ngựa vào lớp trước giờ buổi).
  const pastDrafts = (range: { from?: string; to?: string }) =>
    drafts.filter((session) => {
      const day = clubDateKey(session.scheduledStartAt);
      return session.scheduledStartAt < new Date().toISOString() && (!range.from || day >= range.from) && (!range.to || day <= range.to);
    });
  const requestPublish = (range: { from?: string; to?: string }) => {
    if (pastDrafts(range).length > 0) setPastWarning(range);
    else runPublish(range);
  };

  const runPublish = (range: { from?: string; to?: string }) =>
    void publish.run(
      () => publishSessions(item.id, range),
      (result) => {
        setRangeOpen(false);
        if (result.length === 0) toast.push('Không có buổi nháp nào trong khoảng này', 'info');
        else toast.push(`Đã công bố ${result.length} buổi. Lượt tập đã tạo cho từng ngựa đang học.`, 'success');
        setPublished(result.map((session) => session.id));
        reload();
        onTab('sessions');
      },
    );

  const weekFrom = mondayOf(today) < item.startDate ? item.startDate : mondayOf(today);
  const weekTo = addDateKey(mondayOf(today), 6);

  const steps = [
    { key: 'activate', label: 'Kích hoạt lớp', done: item.status !== 'DRAFT' },
    { key: 'enroll', label: 'Ghi danh ngựa thuộc khu của bạn', done: activeHorses > 0 },
    { key: 'publish', label: 'Công bố buổi để tạo lượt tập cho ngựa', done: sessions.some((session) => session.status !== 'DRAFT' && session.status !== 'CANCELLED') },
    { key: 'run', label: 'Mở sân tập buổi đầu tiên', done: started },
  ];
  const currentStep = steps.find((step) => !step.done)?.key;

  return (
    <div ref={scope} className="space-y-5">
      <Link to={links.classes} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900">
        <ArrowLeft size={15} /> Lớp huấn luyện
      </Link>

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
              {item.status === 'DRAFT' && (
                <Button onClick={() => setConfirm('activate')}>
                  <Play size={15} /> Kích hoạt lớp
                </Button>
              )}
              {item.status === 'ACTIVE' && (
                <>
                  <Button variant="secondary" onClick={() => setEnrollOpen(true)}>
                    <UserPlus size={15} /> Ghi danh ngựa
                  </Button>
                  <ActionMenu
                    trigger={
                      <Button disabled={drafts.length === 0 || publish.pending}>
                        <Megaphone size={15} /> {publish.pending ? 'Đang công bố…' : `Công bố buổi${drafts.length ? ` (${drafts.length} nháp)` : ''}`}
                      </Button>
                    }
                    items={[
                      { label: 'Các buổi nháp tuần này', icon: <CalendarCheck2 size={14} />, onSelect: () => requestPublish({ from: weekFrom, to: weekTo }) },
                      { label: 'Chọn khoảng ngày…', icon: <CalendarCheck2 size={14} />, onSelect: () => setRangeOpen(true) },
                      { label: 'Tất cả buổi nháp', icon: <Megaphone size={14} />, onSelect: () => requestPublish({}) },
                    ]}
                  />
                  <Tip content={unfinished ? `Còn ${unfinished} buổi chưa kết thúc` : 'Kết thúc lớp, ngựa rời lớp'}>
                    <span>
                      <Button variant="secondary" disabled={unfinished > 0} onClick={() => setConfirm('complete')}>
                        <CheckCircle2 size={15} /> Hoàn thành lớp
                      </Button>
                    </span>
                  </Tip>
                </>
              )}
              <Button variant="inlineDanger" onClick={() => setCancelOpen(true)}>
                <XCircle size={15} /> Hủy lớp
              </Button>
            </div>
          )}
        </div>

        {publish.error && (
          <div className="mt-4">
            <ErrorBox message={publish.error} />
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-12">
          <div data-class-fact className="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-900/10 sm:col-span-6">
            <div className="flex justify-between font-mono text-xs text-gray-500">
              <span>{formatDate(item.startDate)}</span>
              <span>
                ngày {Math.max(0, elapsed)} trên {totalDays}
              </span>
              <span>{formatDate(item.endDate)}</span>
            </div>
            <ProgressFill ratio={totalDays ? elapsed / totalDays : 0} tone={item.status === 'ACTIVE' ? 'green' : 'gray'} className="mt-2" />
            {plan && <WeekRibbon segments={planSegments(plan)} size="sm" className="mt-3" highlightWeek={Math.floor(Math.max(0, elapsed - 1) / 7) + 1} />}
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
          <div data-class-fact className="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-900/10 sm:col-span-2">
            <p className="text-xs text-gray-500">Buổi kế tiếp</p>
            {nextSession ? (
              <Link to={links.session(nextSession.id)} className="block hover:text-emerald-800">
                <p className="font-mono text-sm font-semibold">
                  {formatDate(nextSession.scheduledStartAt).slice(0, 5)} {clubTime(nextSession.scheduledStartAt)}
                </p>
                <p className="truncate text-xs text-gray-600">{nextSession.name}</p>
              </Link>
            ) : (
              <p className="text-sm text-gray-400">Chưa có</p>
            )}
          </div>
        </div>
      </section>

      {manage && open && !started && (
        <section className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200/80 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h3 className="font-semibold text-gray-900">Việc tiếp theo</h3>
            <p className="mt-1 text-sm text-gray-500">Đi theo thứ tự này để ngựa có lượt tập ở các buổi sắp tới.</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:col-span-8">
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
                {step.key === currentStep && step.key === 'activate' && (
                  <Button size="sm" onClick={() => setConfirm('activate')}>
                    Kích hoạt
                  </Button>
                )}
                {step.key === currentStep && step.key === 'enroll' && (
                  <Button size="sm" onClick={() => setEnrollOpen(true)}>
                    Ghi danh
                  </Button>
                )}
                {step.key === currentStep && step.key === 'publish' && (
                  <Button size="sm" disabled={drafts.length === 0} onClick={() => requestPublish({ from: weekFrom, to: weekTo })}>
                    Tuần này
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
            { key: 'sessions', label: 'Lịch buổi', count: sessions.length },
            { key: 'horses', label: 'Ngựa trong lớp', count: activeHorses },
            { key: 'results', label: 'Kết quả' },
            { key: 'info', label: 'Thông tin' },
          ]}
        />
        <TabPanel className="p-4 sm:p-5">
          {tab === 'sessions' && <ClassSessionsTab bundle={bundle} manage={manage} reload={reload} justPublished={published} />}
          {tab === 'horses' && <ClassHorsesTab bundle={bundle} manage={manage} reload={reload} enrollOpen={enrollOpen} setEnrollOpen={setEnrollOpen} />}
          {tab === 'results' && <ClassResultsTab bundle={bundle} />}
          {tab === 'info' && <ClassInfoTab bundle={bundle} manage={manage} reload={reload} />}
        </TabPanel>
      </div>

      {/* Ghi danh mở được từ đầu trang khi đang ở tab khác */}
      {tab !== 'horses' && enrollOpen && <ClassHorsesTab bundle={bundle} manage={manage} reload={reload} enrollOpen setEnrollOpen={setEnrollOpen} sheetOnly />}

      <ConfirmDialog
        open={confirm === 'activate'}
        title="Kích hoạt lớp"
        danger={false}
        confirmLabel="Kích hoạt"
        pending={status.pending}
        message={
          <>
            Lớp <b>{item.code}</b> chuyển sang đang chạy. Sau đó bạn ghi danh ngựa thuộc khu của mình và công bố buổi để tạo lượt tập cho từng ngựa.
            {status.error && <div className="mt-3"><ErrorBox message={status.error} /></div>}
          </>
        }
        onClose={() => {
          setConfirm(null);
          status.clearError();
        }}
        onConfirm={() => changeStatus('ACTIVE')}
      />
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
      {pastWarning && (
        <ConfirmDialog
          open
          title="Có buổi đã qua giờ bắt đầu"
          danger={false}
          confirmLabel="Vẫn công bố"
          pending={publish.pending}
          message={
            <>
              Ngựa ghi danh sau giờ bắt đầu của buổi sẽ không có lượt ở buổi đó. Nên hủy hoặc sửa giờ các buổi này trước khi công bố.
              <ul className="mt-3 space-y-1">
                {pastDrafts(pastWarning).map((session) => (
                  <li key={session.id} className="font-mono text-xs text-gray-700">
                    {formatDate(session.scheduledStartAt)} {clubTime(session.scheduledStartAt)} · {session.name}
                  </li>
                ))}
              </ul>
            </>
          }
          onClose={() => setPastWarning(null)}
          onConfirm={() => {
            const range = pastWarning;
            setPastWarning(null);
            runPublish(range);
          }}
        />
      )}
      {rangeOpen && <PublishRangeDialog min={item.startDate} max={item.endDate} pending={publish.pending} error={publish.error} onClose={() => setRangeOpen(false)} onPublish={(range) => { setRangeOpen(false); requestPublish(range); }} defaultFrom={weekFrom} />}
    </div>
  );
}

function PublishRangeDialog({
  min,
  max,
  defaultFrom,
  pending,
  error,
  onClose,
  onPublish,
}: {
  min: string;
  max: string;
  defaultFrom: string;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onPublish: (range: { from: string; to: string }) => void;
}) {
  const [from, setFrom] = useState(defaultFrom < min ? min : defaultFrom);
  const [to, setTo] = useState(() => {
    const end = addDateKey(defaultFrom, 13);
    return end > max ? max : end;
  });
  const wrong = !from || !to || from > to;
  return (
    <Modal
      open
      onClose={onClose}
      title="Công bố buổi theo khoảng ngày"
      description="Công bố mọi buổi nháp có ngày (lịch câu lạc bộ) trong khoảng. Một buổi lỗi thì không buổi nào được công bố."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={wrong || pending} onClick={() => onPublish({ from, to })}>
            {pending ? 'Đang công bố…' : 'Công bố'}
          </Button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Từ ngày">
          <DatePicker value={from} onChange={setFrom} min={min} max={max} clearable={false} />
        </Field>
        <Field label="Đến ngày" error={from && to && from > to ? 'Phải sau ngày bắt đầu' : undefined}>
          <DatePicker value={to} onChange={setTo} min={min} max={max} clearable={false} />
        </Field>
      </div>
    </Modal>
  );
}

