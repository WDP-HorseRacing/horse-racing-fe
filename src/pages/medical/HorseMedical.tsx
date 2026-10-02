// F3.10 — Hồ sơ y tế của một con ngựa: màn riêng của Flow 3, tách khỏi hồ sơ ngựa (Flow 1).
// CM, HT, VET, OWNER xem đủ; GROOM chỉ thấy ghi chú chăm sóc và lịch chăm sóc được giao cho mình.
// HT không có chi phí; OWNER không thấy liều thuốc (backend lọc), không xem yêu cầu khám.
// Mọi thao tác ghi do backend kiểm lại; ngựa đã chuyển nhượng chỉ xem.
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Bandage,
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  FolderOpen,
  HeartPulse,
  History,
  Lock,
  NotebookPen,
  Send,
  Stethoscope,
  Unlock,
  Wallet,
} from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getHorse, getPermissions, getPhotoUrl } from '../../api/horses';
import {
  getCareInstructions,
  getHealthHistory,
  getInjuries,
  listCheckups,
  listHorseCases,
  listHorseExamRequests,
  listHorseLocks,
  listHorseRecords,
} from '../../api/medical';
import type { HorseDetail, HorsePermissions, MedicalRecord, TrainingLock } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { useCrumbs, type Crumb } from '../../components/Breadcrumb';
import { ActionMenu, Button, Card, Dot, EmptyState, ErrorBox, NotFound, Reveal, SectionTitle, Skeleton, Tabs, cn } from '../../components/ui';
import { HorseDetailSkeleton } from '../../components/skeletons';
import { HorseMedia } from '../horses/components/HorseMedia';
import { CaseStatusPill, LockPill, RequestPill, healthDot } from '../../components/ui/status';
import { healthHint, healthLabel } from '../../lib/labels';
import { healthChangeSource } from '../../lib/api-labels';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import { links } from '../../lib/links';
import { InjuryProgress, VisitTimeline } from './components/ExamTimeline';
import { CareScheduleSection } from './components/care';
import { CreateRequestModal, HealthChangeModal, PlaceLockModal, ReleaseLockModal, RequestRow, VoidVisitModal } from './components/modals';
import { usePeople } from './components/people';
import { CheckupDue, HealthShift } from './components/parts';
import { healthText } from './components/utils';

type Dialog =
  | { kind: 'health' }
  | { kind: 'lock' }
  | { kind: 'release'; lock: TrainingLock }
  | { kind: 'request' }
  | { kind: 'void'; record: MedicalRecord }
  | null;

const TABS = [
  { key: 'timeline', label: 'Dòng thời gian khám' },
  { key: 'cases', label: 'Bệnh án' },
  { key: 'injuries', label: 'Chấn thương' },
  { key: 'health', label: 'Lịch sử sức khỏe' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/** Gốc đường dẫn trên header theo vai trò (trang nằm ngoài menu). */
function useRootCrumbs(): Crumb[] {
  const role = useStore((state) => state.currentUser?.role);
  if (role === 'HORSE_OWNER') return [{ label: 'Bệnh án', to: links.cases }];
  if (role === 'GROOM') return [{ label: 'Ngựa', to: links.horses }];
  return [{ label: 'Y tế', to: links.medicalBoard }];
}

export default function HorseMedical() {
  const { id = '' } = useParams();
  const user = useStore((state) => state.currentUser);
  const base = useService(async () => {
    const [horse, permissions] = await Promise.all([getHorse(id), getPermissions(id)]);
    return { horse, permissions };
  }, [id]);
  // Ảnh tải riêng: không chặn phần y tế.
  const mediaId = base.data?.horse.mediaId;
  const photo = useService(() => (mediaId ? getPhotoUrl(id).then((result) => result.url) : Promise.resolve(undefined)), [id, mediaId], { silent: true });
  const root = useRootCrumbs();
  const horse = base.data?.horse;
  useCrumbs(horse ? [{ label: horse.name, to: links.horse(horse.id) }, { label: 'Hồ sơ y tế' }] : null, root);

  if (base.loading && !base.data) return <HorseDetailSkeleton />;
  if (base.error || !base.data || !horse) return <NotFound message={base.error && !base.error.startsWith('Không tìm thấy') ? base.error : undefined} />;
  const { permissions } = base.data;
  const isHorseGroom = !!horse.groom && horse.groom.id === user?.id;
  if (!permissions.canViewMedicalTab && !isHorseGroom) {
    return <NotFound message="Hồ sơ y tế của ngựa này không hiển thị với vai trò của bạn." />;
  }

  return (
    <Reveal className="space-y-5">
      <Header horse={horse} photo={photo.data} photoLoading={!!mediaId && photo.loading && !photo.data} onPhotoExpired={() => photo.reload()} />
      <div data-reveal className="space-y-5">{permissions.canViewMedicalTab ? <FullView horse={horse} permissions={permissions} onChanged={base.reload} /> : <GroomView horse={horse} />}</div>
    </Reveal>
  );
}

/* ===== Đầu trang ===== */

const HEALTH_SURFACE: Record<HorseDetail['healthStatus'], string> = {
  ELIGIBLE: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60',
  UNDER_OBSERVATION: 'bg-amber-50 text-amber-700 ring-amber-200/60',
  INJURED: 'bg-red-50 text-red-700 ring-red-200/60',
  QUARANTINED: 'bg-red-50 text-red-700 ring-red-200/60',
};

/** Dải hero xanh rừng: ảnh ngựa, tên, trạng thái sức khỏe nổi bật, khóa huấn luyện, chỗ ở và người phụ trách. */
function Header({ horse, photo, photoLoading, onPhotoExpired }: { horse: HorseDetail; photo?: string; photoLoading?: boolean; onPhotoExpired?: () => void }) {
  const place = [horse.location.barn?.name, horse.location.stall?.code].filter(Boolean).join(' · ');
  const facts = [
    { label: 'Chỗ ở', value: place || 'Chưa xếp chỗ' },
    { label: 'Groom', value: horse.groom?.fullName ?? 'Chưa có Groom' },
    { label: 'Chủ', value: horse.owner?.fullName ?? 'Chưa có chủ' },
  ];
  return (
    <section data-reveal className="turf-soft relative overflow-hidden rounded-3xl p-3 ring-1 ring-emerald-900/6 sm:p-4">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch">
        <HorseMedia src={photo} name={horse.name} loading={photoLoading} onExpired={onPhotoExpired} className="aspect-[4/3] w-full shrink-0 sm:aspect-auto sm:h-auto sm:w-64 lg:w-72" />
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-2 sm:py-3 sm:pr-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Hồ sơ y tế</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="truncate text-4xl font-bold tracking-tight text-gray-900">{horse.name}</h2>
              <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1', HEALTH_SURFACE[horse.healthStatus])}>
                <Dot tone={healthDot[horse.healthStatus]} hollow={horse.healthStatus === 'QUARANTINED'} />
                {healthLabel[horse.healthStatus]}
              </span>
              {horse.activeTrainingLock && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700 ring-1 ring-red-200/60">
                  <Lock size={13} /> Đang khóa huấn luyện
                </span>
              )}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">{healthHint[horse.healthStatus]}</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-3">
              {facts.map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <dt className="text-xs text-gray-500">{fact.label}</dt>
                  <dd className="truncate text-sm font-semibold text-gray-900">{fact.value}</dd>
                </div>
              ))}
            </dl>
            <Link to={links.horse(horse.id)} className="inline-flex items-center gap-1 rounded-xl bg-white/85 px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200/80 transition hover:bg-white hover:text-gray-900">
              Hồ sơ ngựa <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Ghi chú chăm sóc đang hiệu lực (buổi khám chưa hủy gần nhất). */
function CareNote({ note, empty }: { note: { careInstructions: string; examDate: string } | null | undefined; empty?: string }) {
  if (!note) return <p className="text-sm text-gray-500">{empty ?? 'Chưa có ghi chú chăm sóc từ bác sĩ.'}</p>;
  return (
    <div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">{note.careInstructions}</p>
      <p className="mt-1.5 text-xs text-gray-500">Từ buổi khám {formatDateTime(note.examDate)}</p>
    </div>
  );
}

/* ===== Groom: chỉ phần chăm sóc ===== */

function GroomView({ horse }: { horse: HorseDetail }) {
  const user = useStore((state) => state.currentUser);
  const note = useService(() => getCareInstructions(horse.id).catch(() => null), [horse.id]);
  const [requesting, setRequesting] = useState(false);
  const canRequest = can(user, 'examRequest.create') && horse.lifecycleStatus !== 'TRANSFERRED';
  return (
    <div className="grid items-start gap-5 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-7">
        <Card>
          <SectionTitle
            icon={<NotebookPen size={16} />}
            action={
              canRequest && (
                <Button size="sm" variant="secondary" onClick={() => setRequesting(true)}>
                  <Send size={14} /> Gửi yêu cầu khám
                </Button>
              )
            }
          >
            Bác sĩ dặn
          </SectionTitle>
          {note.loading && !note.data ? <Skeleton rows={1} /> : <CareNote note={note.data?.current} />}
        </Card>
        <p className="px-1 text-xs text-gray-500">Bệnh án, buổi khám và chẩn đoán không hiển thị với vai trò của bạn.</p>
      </div>
      <div className="lg:col-span-5">
        <CareScheduleSection horse={{ id: horse.id, name: horse.name, groom: horse.groom }} readOnly={horse.lifecycleStatus === 'TRANSFERRED'} />
      </div>
      <CreateRequestModal open={requesting} onClose={() => setRequesting(false)} horse={{ id: horse.id, name: horse.name }} />
    </div>
  );
}

/* ===== Nhân viên y tế, quản lý, HT, chủ ngựa ===== */

/** Một ô trong dải "Tình trạng hôm nay". */
function Tile({ icon, label, children, className = '', tone = 'default' }: { icon: ReactNode; label: string; children: ReactNode; className?: string; tone?: 'default' | 'warning' | 'danger' }) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white p-4 ring-1 ring-gray-200/80',
        tone === 'warning' && 'shadow-[inset_3px_0_0_0_#f59e0b]',
        tone === 'danger' && 'shadow-[inset_3px_0_0_0_#ef4444]',
        className,
      )}
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <span className="text-gray-400">{icon}</span>
        {label}
      </p>
      {children}
    </div>
  );
}

function FullView({ horse, permissions, onChanged }: { horse: HorseDetail; permissions: HorsePermissions; onChanged: () => void }) {
  const navigate = useNavigate();
  const user = useStore((state) => state.currentUser);
  const isOwner = user?.role === 'HORSE_OWNER';
  const readOnly = horse.lifecycleStatus === 'TRANSFERRED';
  const isVet = can(user, 'exam.record') && !readOnly;
  const canRequest = can(user, 'examRequest.create') && !readOnly;
  const canCare = can(user, 'care.manage') && !readOnly;
  const people = usePeople(horse.groom ? [horse.groom] : []);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab');
  const tab: TabKey = TABS.some((item) => item.key === requestedTab) ? (requestedTab as TabKey) : 'timeline';
  const here = links.horseMedical(horse.id);

  const medical = useService(async () => {
    const [cases, records, locks, history, injuries, note, requests, checkups] = await Promise.all([
      listHorseCases(horse.id),
      listHorseRecords(horse.id),
      listHorseLocks(horse.id),
      getHealthHistory(horse.id),
      getInjuries(horse.id),
      getCareInstructions(horse.id).catch(() => null),
      isOwner ? Promise.resolve(null) : listHorseExamRequests(horse.id).catch(() => null),
      can(user, 'checkup.view') ? listCheckups().catch(() => null) : Promise.resolve(null),
    ]);
    return { cases, records, locks, history, injuries, note, requests, checkup: checkups?.find((item) => item.horseId === horse.id) ?? null };
  }, [horse.id, isOwner]);

  if (medical.loading && !medical.data) return <Skeleton rows={5} />;
  if (medical.error && !medical.data) return <ErrorBox message={medical.error} />;
  const data = medical.data!;

  const reload = () => {
    medical.reload();
    onChanged();
  };
  const done = () => {
    setDialog(null);
    reload();
  };

  const openCase = data.cases.items.find((item) => item.status === 'OPEN');
  const costVisible = 'totalCost' in data.cases;
  const activeLock = data.locks.find((lock) => lock.status === 'ACTIVE');
  const pastLocks = data.locks.filter((lock) => lock.status !== 'ACTIVE');
  const caseById = new Map(data.cases.items.map((item) => [item.id, item]));
  const activeVisits = data.records.filter((record) => !record.voidedAt);
  const lastOpenVisit = openCase ? activeVisits.find((record) => record.caseId === openCase.id) : undefined;
  const pendingRequests = (data.requests ?? []).filter((request) => request.status === 'PENDING');
  const urgentPending = pendingRequests.filter((request) => request.urgent).length;
  const closedCount = data.cases.items.filter((item) => item.status === 'CLOSED').length;
  const visit = () => navigate(links.visitNew({ horseId: horse.id, caseId: openCase?.id, back: here }));

  const menu = [
    ...(permissions.canChangeHealth && !readOnly ? [{ label: 'Đổi trạng thái sức khỏe', icon: <HeartPulse size={14} />, onSelect: () => setDialog({ kind: 'health' }) }] : []),
    ...(isVet && !activeLock ? [{ label: 'Đặt khóa huấn luyện', icon: <Lock size={14} />, onSelect: () => setDialog({ kind: 'lock' }) }] : []),
    ...(canCare ? [{ label: 'Tạo lịch chăm sóc', icon: <CalendarPlus size={14} />, onSelect: () => navigate(links.careNew(horse.id, here)) }] : []),
  ];

  const tabs = TABS.map((item) => ({
    key: item.key,
    label: item.label,
    badge: item.key === 'timeline' ? activeVisits.length : item.key === 'cases' ? data.cases.items.length : undefined,
  }));

  return (
    <>
      {/* Thanh thao tác + trạng thái chính */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-200/80">
        <div className="grid divide-y divide-gray-100 md:grid-cols-[1.1fr_1fr_1.5fr] md:divide-x md:divide-y-0">
          <div className="p-5">
            <p className="text-xs text-gray-500">Sức khỏe hiện tại</p>
            <p className={cn('mt-1 flex items-center gap-2 text-lg font-semibold', healthText[horse.healthStatus])}>
              <Dot tone={horse.healthStatus === 'ELIGIBLE' ? 'neutral' : healthDot[horse.healthStatus]} hollow={horse.healthStatus === 'QUARANTINED'} className="h-2.5 w-2.5" />
              {healthLabel[horse.healthStatus]}
            </p>
            <p className="mt-1 text-sm text-gray-500">{healthHint[horse.healthStatus]}</p>
          </div>
          <div className="p-5">
            <p className="text-xs text-gray-500">Khóa huấn luyện</p>
            {activeLock ? (
              <>
                <p className="mt-1 text-lg font-semibold text-red-700">Đang khóa</p>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{activeLock.reason}</p>
              </>
            ) : (
              <p className="mt-1 text-lg font-semibold text-gray-900">Không có</p>
            )}
          </div>
          <div className="p-5">
            <p className="text-xs text-gray-500">Bệnh án đang điều trị</p>
            {openCase ? (
              <Link to={links.case(openCase.id)} className="group mt-1 block">
                <p className="text-lg font-semibold text-gray-900 group-hover:underline">{openCase.initialDiagnosis}</p>
                <p className="mt-1 text-sm text-gray-500">
                  Mở {formatDate(openCase.openedAt)}
                  {lastOpenVisit ? ` · khám gần nhất ${formatDate(lastOpenVisit.examDate)}` : ''}
                  {lastOpenVisit?.nextVisitAt ? ` · hẹn tái khám ${formatDate(lastOpenVisit.nextVisitAt)}` : ''}
                </p>
              </Link>
            ) : (
              <p className="mt-1 text-lg font-semibold text-gray-900">Không có</p>
            )}
          </div>
        </div>
        {(isVet || canRequest || menu.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
            {isVet && (
              <Button onClick={visit}>
                <Stethoscope size={15} /> {openCase ? 'Ghi buổi tái khám' : 'Ghi buổi khám'}
                {pendingRequests.length > 0 && <span className="rounded-md bg-white/15 px-1.5 text-xs font-medium">{pendingRequests.length} yêu cầu chờ</span>}
              </Button>
            )}
            {canRequest && (
              <Button variant="secondary" onClick={() => setDialog({ kind: 'request' })}>
                <Send size={15} /> Gửi yêu cầu khám
              </Button>
            )}
            {menu.length > 0 && <ActionMenu items={menu} />}
            {readOnly && <span className="text-sm text-gray-500">Ngựa đã chuyển nhượng, hồ sơ chỉ xem.</span>}
          </div>
        )}
      </section>

      {/* Tình trạng hôm nay — lưới bất đối xứng: ghi chú bác sĩ rộng hơn */}
      <div className="grid gap-4 md:grid-cols-4">
        {data.checkup && (
          <Tile icon={<CalendarClock size={14} />} label="Khám định kỳ" tone={data.checkup.dueStatus === 'OVERDUE' ? 'warning' : 'default'}>
            <CheckupDue status={data.checkup.dueStatus} daysLeft={data.checkup.daysLeft} />
            <p className="mt-2 text-sm text-gray-700">Hạn {formatDate(data.checkup.dueDate)}</p>
            <p className="text-xs text-gray-500">
              {data.checkup.appointment ? `Đã hẹn ${formatDateTime(data.checkup.appointment.scheduledAt)}` : data.checkup.lastVisitDate ? `Khám gần nhất ${formatDate(data.checkup.lastVisitDate)}` : 'Chưa có buổi khám'}
            </p>
          </Tile>
        )}
        <Tile icon={<NotebookPen size={14} />} label="Bác sĩ dặn" className={cn(data.checkup ? 'md:col-span-2' : 'md:col-span-3')}>
          <CareNote note={data.note?.current} />
        </Tile>
        {data.requests ? (
          <Tile icon={<ClipboardList size={14} />} label="Yêu cầu khám đang chờ" tone={urgentPending > 0 ? 'danger' : pendingRequests.length > 0 ? 'warning' : 'default'}>
            <p className="text-2xl font-bold tabular-nums text-gray-900">{pendingRequests.length}</p>
            <p className="text-xs text-gray-500">{urgentPending > 0 ? `${urgentPending} yêu cầu Khẩn` : pendingRequests.length > 0 ? 'Chờ bác sĩ xử lý' : 'Không có yêu cầu nào'}</p>
          </Tile>
        ) : (
          costVisible && (
            <Tile icon={<Wallet size={14} />} label="Chi phí y tế">
              <p className="text-xl font-bold tabular-nums text-gray-900">{formatMoney(data.cases.totalCost ?? 0)}</p>
              <p className="text-xs text-gray-500">{closedCount} bệnh án đã đóng</p>
            </Tile>
          )
        )}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        {/* ===== Cột chính ===== */}
        <div className="space-y-4 lg:col-span-8">
          <Tabs tabs={tabs} active={tab} onChange={(key) => setParams(key === 'timeline' ? {} : { tab: key }, { replace: true })} />

          {tab === 'timeline' &&
            (data.records.length === 0 ? (
              <EmptyState title="Chưa có buổi khám nào" hint="Buổi khám định kỳ, theo yêu cầu và tái khám hiện ở đây, mới nhất trên cùng." />
            ) : (
              <VisitTimeline
                records={data.records}
                people={people}
                caseLabel={(record) => (record.caseId ? (caseById.get(record.caseId)?.initialDiagnosis ?? 'Bệnh án') : undefined)}
                onVoid={isVet ? (record) => setDialog({ kind: 'void', record }) : undefined}
              />
            ))}

          {tab === 'cases' && (
            <Card>
              {data.cases.items.length === 0 ? (
                <p className="text-sm text-gray-500">Ngựa chưa có bệnh án nào. Bệnh án được mở khi bác sĩ kết luận Có vấn đề tại buổi khám.</p>
              ) : (
                <ul className="-mx-2 -my-1 space-y-0.5">
                  {data.cases.items.map((item) => (
                    <li key={item.id}>
                      <Link to={links.case(item.id)} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-xl p-2.5 transition hover:bg-gray-50">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">{item.initialDiagnosis}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Mở {formatDate(item.openedAt)} · {people.name(item.openedBy, 'vet')}
                            {item.closedAt && ` · đóng ${formatDate(item.closedAt)}`}
                          </p>
                          {item.finalConclusion && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{item.finalConclusion}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          {costVisible && item.status === 'CLOSED' && <span className="text-sm font-semibold tabular-nums text-gray-900">{formatMoney(item.totalCost)}</span>}
                          <CaseStatusPill status={item.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === 'injuries' && (
            <Card>
              <SectionTitle icon={<Bandage size={16} />}>Diễn biến chấn thương</SectionTitle>
              <InjuryProgress items={data.injuries} />
            </Card>
          )}

          {tab === 'health' && (
            <Card>
              <SectionTitle icon={<History size={16} />}>Lịch sử sức khỏe</SectionTitle>
              {data.history.length === 0 ? (
                <p className="text-sm text-gray-500">Chưa có lần đổi trạng thái sức khỏe nào được ghi lại.</p>
              ) : (
                <ol className="space-y-3">
                  {data.history.map((item, index) => (
                    <li key={`${item.changedAt}-${index}`} className="flex flex-wrap items-start gap-x-4 gap-y-1.5">
                      <span className="w-32 shrink-0 text-xs tabular-nums text-gray-500">{formatDateTime(item.changedAt)}</span>
                      <div className="min-w-0 flex-1">
                        <HealthShift from={item.from} to={item.to} />
                        {item.reason && <p className="mt-1 text-sm text-gray-700">{item.reason}</p>}
                        <p className="mt-0.5 text-xs text-gray-500">
                          {healthChangeSource(item.feature)} · {people.name(item.actorId, item.feature?.startsWith('F3') ? 'vet' : 'staff')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}
        </div>

        {/* ===== Cột phụ ===== */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
          <Card tone={activeLock ? 'danger' : 'default'} className={activeLock ? 'shadow-[inset_3px_0_0_0_#ef4444]!' : ''}>
            <SectionTitle icon={<Lock size={16} />}>Khóa huấn luyện</SectionTitle>
            {activeLock ? (
              <div className="space-y-2">
                <LockPill />
                <p className="text-sm text-gray-800">{activeLock.reason}</p>
                <p className="text-xs text-gray-500">
                  Từ {formatDate(activeLock.lockStart)} · {people.name(activeLock.lockedBy, 'vet')}
                  {activeLock.lockEnd ? ` · dự kiến gỡ ${formatDate(activeLock.lockEnd)}` : ' · chưa đặt ngày dự kiến gỡ'}
                </p>
                {activeLock.caseId && (
                  <Link to={links.case(activeLock.caseId)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                    <FolderOpen size={12} /> {caseById.get(activeLock.caseId)?.initialDiagnosis ?? 'Bệnh án'}
                  </Link>
                )}
                {isVet && (
                  <div className="pt-1">
                    <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'release', lock: activeLock })}>
                      <Unlock size={14} /> Gỡ khóa
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Không có khóa hiệu lực.</p>
            )}
            {pastLocks.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500">Lịch sử khóa</p>
                {pastLocks.map((lock) => (
                  <div key={lock.id} className="text-xs text-gray-500">
                    <p className="text-gray-700">{lock.reason}</p>
                    <p>
                      {formatDate(lock.lockStart)} → {formatDate(lock.releasedAt)} · {lock.releasedBySystem ? 'Hệ thống gỡ' : people.name(lock.releasedBy, 'vet')}
                      {lock.releaseConclusion && ` · ${lock.releaseConclusion}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {data.requests && (
            <Card>
              <SectionTitle icon={<ClipboardList size={16} />}>Yêu cầu khám gần đây</SectionTitle>
              {data.requests.length === 0 ? (
                <p className="text-sm text-gray-500">Chưa có yêu cầu khám nào.</p>
              ) : (
                <ul className="-my-3 divide-y divide-gray-100">
                  {data.requests.slice(0, 5).map((request) => (
                    <li key={request.id} className="space-y-1.5 py-3">
                      <RequestRow request={request} people={people} />
                      {request.status !== 'PENDING' && (
                        <p className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <RequestPill status={request.status} />
                          {request.status === 'DISMISSED' && request.dismissReason}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {data.requests.length > 5 && (
                <Link to={links.requests} className="mt-3 inline-block text-xs font-medium text-emerald-700 hover:underline">
                  Hàng đợi yêu cầu khám
                </Link>
              )}
            </Card>
          )}

          <CareScheduleSection horse={{ id: horse.id, name: horse.name, groom: horse.groom }} readOnly={readOnly} />

          {costVisible && data.requests && (
            <Card variant="flat">
              <SectionTitle icon={<Wallet size={16} />}>Tổng chi phí y tế</SectionTitle>
              <p className="text-lg font-semibold tabular-nums text-gray-900">{formatMoney(data.cases.totalCost ?? 0)}</p>
              <p className="mt-1 text-xs text-gray-500">{closedCount} bệnh án đã đóng. Bệnh án đang mở chưa có chi phí; khám định kỳ không tính phí.</p>
            </Card>
          )}
          {!costVisible && closedCount > 0 && <p className="px-1 text-xs text-gray-500">Chi phí y tế không hiển thị với vai trò của bạn.</p>}
        </aside>
      </div>

      <HealthChangeModal open={dialog?.kind === 'health'} onClose={() => setDialog(null)} horse={{ id: horse.id, name: horse.name, healthStatus: horse.healthStatus }} onDone={reload} />
      {dialog?.kind === 'lock' && <PlaceLockModal horse={{ id: horse.id, name: horse.name }} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'release' && <ReleaseLockModal lock={dialog.lock} horseName={horse.name} onClose={() => setDialog(null)} onDone={done} />}
      <CreateRequestModal open={dialog?.kind === 'request'} onClose={() => setDialog(null)} horse={{ id: horse.id, name: horse.name }} onDone={medical.reload} />
      {dialog?.kind === 'void' && (
        <VoidVisitModal
          record={dialog.record}
          horseName={horse.name}
          caseInfo={
            dialog.record.caseId && caseById.get(dialog.record.caseId)
              ? {
                  status: caseById.get(dialog.record.caseId)!.status,
                  otherActiveVisits: activeVisits.filter((record) => record.caseId === dialog.record.caseId && record.id !== dialog.record.id).length,
                }
              : undefined
          }
          onClose={() => setDialog(null)}
          onVoided={reload}
          onReRecord={(record) =>
            navigate(
              links.visitNew({
                horseId: horse.id,
                caseId: record.caseId && caseById.get(record.caseId)?.status === 'OPEN' ? record.caseId : undefined,
                replaces: record.id,
                back: here,
              }),
            )
          }
        />
      )}
    </>
  );
}
