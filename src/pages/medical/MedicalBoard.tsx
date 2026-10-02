// F3.1 — Bảng điều khiển y tế (VET, CM, HT) từ GET /medical/dashboard.
// Bố cục: 4 số liệu → "Hàng đợi khám" (gộp yêu cầu khám, hẹn tái khám tới hạn, khám định kỳ cần chú ý; việc gấp
// lên đầu, mỗi dòng một nút Khám) → cột phải: sức khỏe đàn (bấm để lọc), đang điều trị, chăm sóc đến hạn →
// sơ đồ đàn theo khu thu gọn ở cuối. Bộ lọc khu và sức khỏe áp cho mọi khối (sức khỏe lọc ở FE để số đếm đủ).
// Head Trainer chỉ thấy ngựa thuộc khu mình phụ trách và khu cách ly (BE trả toàn câu lạc bộ, FE lọc).
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarClock, ChevronDown, ClipboardList, FolderOpen, Map as MapIcon, Stethoscope, Syringe, X } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getMedicalDashboard } from '../../api/medical';
import { listBarns, listStalls } from '../../api/stable';
import type { HealthStatus, MedicalDashboard } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { Avatar, Button, Card, Dot, EmptyState, ErrorBox, FilterSelect, PageHeader, Stat, cn } from '../../components/ui';
import { MedicalBoardSkeleton } from '../../components/skeletons';
import { DonutChart } from '../../components/charts/DonutChart';
import { canSeeBarn, computeZoneScope } from '../../lib/zone-scope';
import { primeZoneScope } from '../../hooks/useMyScope';
import { filterHealth, scopeDashboard } from './components/scope';
import { QUEUE_LABEL, buildQueue, matchesFilter, type QueueFilter, type QueueItem, type QueueKind } from './components/queue';
import { healthDot } from '../../components/ui/status';
import { healthLabel } from '../../lib/labels';
import { careTypeLabel } from '../../lib/api-labels';
import { daysBetween, formatDateShort } from '../../lib/format';
import { now } from '../../lib/clock';
import { links, type VisitParams } from '../../lib/links';
import { CareDue } from './components/care';
import { usePeople } from './components/people';
import { RequestMeta } from './components/parts';
import { todayKey } from './components/utils';
import { ZoneBoard, ZoneLegend } from '../stable/components/ZoneBoard';
import { buildCells, type StallOccupant } from '../stable/components/barn';
import { healthSegments } from '../dashboard/charts';

type HerdHorse = MedicalDashboard['herd']['horses'][number];
const HEALTH_KEYS: HealthStatus[] = ['ELIGIBLE', 'UNDER_OBSERVATION', 'INJURED', 'QUARANTINED'];
const MAP_KEY = 'horseracing_medical_map_open';
const QUEUE_PAGE = 10;

const KIND_CHIP: Record<QueueKind, string> = {
  URGENT: 'bg-red-600 text-white',
  FOLLOW_UP: 'tint-amber',
  CHECKUP_OVERDUE: 'tint-amber',
  REQUEST: 'tint-emerald',
  CHECKUP_SOON: 'tint-gray',
};

function readMapOpen() {
  try {
    return window.localStorage.getItem(MAP_KEY) === '1';
  } catch {
    return false;
  }
}

function HorseToken({ horse, onOpen }: { horse: HerdHorse; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(horse.horseId)}
      className="inline-flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
    >
      {horse.healthStatus !== 'ELIGIBLE' && <Dot tone={healthDot[horse.healthStatus]} hollow={horse.healthStatus === 'QUARANTINED'} />}
      {horse.horseName}
    </button>
  );
}

function SideCard({ icon, title, count, to, toLabel, children }: { icon: ReactNode; title: string; count?: number; to?: string; toLabel?: string; children: ReactNode }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[0.95rem] font-semibold text-gray-900">
          <span className="tint-emerald flex h-7 w-7 items-center justify-center rounded-lg">{icon}</span>
          {title}
          {count !== undefined && count > 0 && <span className="text-sm font-normal text-gray-400">{count}</span>}
        </h3>
        {to && (
          <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-emerald-700">
            {toLabel} <ArrowRight size={14} />
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

/** Một dòng trong hàng đợi khám. */
function QueueRow({
  item,
  place,
  photo,
  people,
  canExam,
  onExam,
  onOpen,
}: {
  item: QueueItem;
  place?: string;
  photo?: string | null;
  people: ReturnType<typeof usePeople>;
  canExam: boolean;
  onExam: (visit: VisitParams) => void;
  onOpen: (horseId: string) => void;
}) {
  return (
    <li className={cn('flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50/80 sm:px-5', item.kind === 'URGENT' && 'bg-red-50/40 hover:bg-red-50/70')}>
      <span className={cn('h-9 w-1 shrink-0 rounded-full', item.kind === 'URGENT' ? 'bg-red-500' : item.kind === 'FOLLOW_UP' || item.kind === 'CHECKUP_OVERDUE' ? 'bg-amber-400' : 'bg-gray-200')} aria-hidden />
      <button type="button" onClick={() => onOpen(item.horseId)} className="shrink-0" aria-label={`Hồ sơ y tế ${item.horseName}`}>
        <Avatar src={photo ?? undefined} name={item.horseName} size={40} className="rounded-xl" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button type="button" onClick={() => onOpen(item.horseId)} className="truncate text-sm font-semibold text-gray-900 hover:underline">
            {item.horseName}
          </button>
          {place && <span className="font-mono text-[11px] text-gray-400">{place}</span>}
          <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', KIND_CHIP[item.kind])}>{QUEUE_LABEL[item.kind]}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-gray-700" title={item.reason}>
          {item.reason}
        </p>
        <div className="mt-0.5 truncate text-xs text-gray-500">{item.request ? <RequestMeta request={item.request} people={people} showUrgent={false} /> : item.meta}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.to && (
          <Link to={item.to} className="hidden text-xs font-medium text-gray-500 hover:text-emerald-700 sm:inline">
            Bệnh án
          </Link>
        )}
        {canExam && (
          <Button size="sm" variant={item.kind === 'URGENT' ? 'primary' : 'secondary'} onClick={() => onExam(item.visit)}>
            <Stethoscope size={14} /> Khám
          </Button>
        )}
      </div>
    </li>
  );
}

export default function MedicalBoard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const user = useStore((state) => state.currentUser);
  const isVet = can(user, 'exam.record');
  const [barnId, setBarnId] = useState('');
  // ?health=<trạng thái> khi mở từ biểu đồ ở Tổng quan.
  const requestedHealth = params.get('health');
  const health: HealthStatus | '' = HEALTH_KEYS.includes(requestedHealth as HealthStatus) ? (requestedHealth as HealthStatus) : '';
  const setHealth = (next: HealthStatus | '') =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        if (next) copy.set('health', next);
        else copy.delete('health');
        return copy;
      },
      { replace: true },
    );
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL');
  const [showAll, setShowAll] = useState(false);
  const [mapOpen, setMapOpenState] = useState(readMapOpen);
  const setMapOpen = (open: boolean) => {
    setMapOpenState(open);
    try {
      window.localStorage.setItem(MAP_KEY, open ? '1' : '0');
    } catch {
      // Trình duyệt chặn lưu trữ: chỉ mất ghi nhớ trạng thái mở.
    }
  };
  const trainer = user?.role === 'HEAD_TRAINER';
  const barns = useService(
    () =>
      Promise.all([listBarns(), listStalls()]).then(([items, stalls]) => {
        const scope = computeZoneScope(user, items, stalls);
        if (user && scope.trainer) primeZoneScope(user.id, items, stalls);
        // HT: chỉ các khu được xem (khu mình + khu cách ly).
        return { items: items.filter((barn) => canSeeBarn(scope, barn.id)), stalls, scope };
      }),
    [user?.id, user?.role],
  );
  // Gọi BE không kèm bộ lọc sức khỏe rồi lọc ở FE, để biểu đồ sức khỏe luôn đủ số của từng trạng thái.
  const board = useService(() => getMedicalDashboard({ barnId: barnId || undefined }), [barnId]);
  const people = usePeople();
  const exam = (visit: VisitParams = {}) => navigate(links.visitNew({ ...visit, back: links.medicalBoard }));

  const visible = barns.data?.scope.visibleBarnIds;
  // Dữ liệu theo phạm vi (HT) — dùng cho biểu đồ; `data` thêm bộ lọc sức khỏe — dùng cho các danh sách.
  const scoped = useMemo(() => {
    if (!board.data) return undefined;
    if (!trainer) return board.data;
    return visible ? scopeDashboard(board.data, visible) : undefined;
  }, [board.data, trainer, visible]);
  const data = useMemo(() => (scoped ? filterHealth(scoped, health) : undefined), [scoped, health]);

  // Sơ đồ đàn: mỗi khu một lưới 3×3 ô như Sơ đồ chuồng. Ô có ngựa không khớp bộ lọc sức khỏe hiện mờ.
  const herd = useMemo(() => {
    if (!data || !barns.data) return null;
    const caseByHorse = new Map(data.openCases.map((item) => [item.horseId, item.initialDiagnosis]));
    const occupants = new Map<string, StallOccupant>(
      data.herd.horses
        .filter((horse) => horse.stallId)
        .map((horse) => [horse.stallId!, { id: horse.horseId, name: horse.horseName, healthStatus: horse.healthStatus, openCase: caseByHorse.get(horse.horseId) }]),
    );
    const zones = barns.data.items
      .filter((barn) => !barnId || barn.id === barnId)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }))
      .map((barn) => ({
        barn,
        cells: buildCells(barn.id, barns.data!.stalls, occupants),
        waiting: data.herd.horses.filter((horse) => horse.barnId === barn.id && !horse.stallId),
      }));
    return { zones, noBarn: trainer ? [] : data.herd.horses.filter((horse) => !horse.barnId) };
  }, [data, barns.data, barnId, trainer]);

  const today = todayKey();
  const queue = useMemo(() => (data ? buildQueue(data, today, links.case) : []), [data, today]);

  // HT chờ có phạm vi khu rồi mới hiện, để không lóe dữ liệu toàn câu lạc bộ.
  if ((board.loading || (trainer && barns.loading)) && !data) return <MedicalBoardSkeleton />;
  if (board.error && !data) return <ErrorBox message={board.error} />;
  if (!data || !scoped) return null;

  const openHorse = (horseId: string) => navigate(links.horseMedical(horseId));
  const placeOf = new Map(data.herd.horses.map((horse) => [horse.horseId, horse.stallCode ?? undefined]));
  const urgentCount = data.pendingRequests.filter((row) => row.urgent).length;
  const followUps = data.openCases.filter((item) => item.nextVisitAt && item.nextVisitAt.slice(0, 10) <= today).length;
  const overdueCheckups = data.checkups.filter((item) => item.daysLeft < 0).length;
  const careDueToday = data.careSchedules.filter((item) => item.dueDate <= today).length;
  const shown = queue.filter((item) => matchesFilter(item, queueFilter));
  const visibleRows = showAll ? shown : shown.slice(0, QUEUE_PAGE);
  const filterCount = (filter: QueueFilter) => queue.filter((item) => matchesFilter(item, filter)).length;
  const careByType = (['VACCINATION', 'DEWORMING', 'FARRIER'] as const)
    .map((type) => ({ type, rows: data.careSchedules.filter((item) => item.type === type).sort((a, b) => a.dueDate.localeCompare(b.dueDate)) }))
    .filter((group) => group.rows.length > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bảng điều khiển y tế"
        description={
          trainer
            ? 'Việc khám và chăm sóc của ngựa trong khu bạn phụ trách và khu cách ly, việc gấp lên đầu.'
            : 'Việc cần khám hôm nay, ngựa đang điều trị và lịch chăm sóc của toàn đàn, việc gấp lên đầu.'
        }
        actions={
          <>
            <FilterSelect value={barnId} onChange={setBarnId} label="Khu chuồng">
              <option value="">{trainer ? 'Mọi khu của bạn' : 'Mọi khu'}</option>
              {barns.data?.items.map((barn) => (
                <option key={barn.id} value={barn.id}>
                  {barn.name}
                </option>
              ))}
            </FilterSelect>
            {isVet && (
              <Button onClick={() => exam()}>
                <Stethoscope size={16} /> Ghi buổi khám
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          value={data.pendingRequests.length}
          label="Yêu cầu khám đang chờ"
          hint={urgentCount ? `${urgentCount} khẩn` : 'không có yêu cầu khẩn'}
          icon={<ClipboardList size={18} />}
          tone={urgentCount ? 'danger' : 'warning'}
          active={queueFilter === 'REQUEST'}
          onClick={() => setQueueFilter(queueFilter === 'REQUEST' ? 'ALL' : 'REQUEST')}
        />
        <Stat
          value={data.openCases.length}
          label="Đang điều trị"
          hint={followUps ? `${followUps} tới hẹn tái khám` : 'chưa ca nào tới hẹn'}
          icon={<FolderOpen size={18} />}
          tone={followUps ? 'warning' : 'default'}
          active={queueFilter === 'FOLLOW_UP'}
          onClick={() => setQueueFilter(queueFilter === 'FOLLOW_UP' ? 'ALL' : 'FOLLOW_UP')}
        />
        <Stat
          value={data.checkups.length}
          label="Khám định kỳ cần chú ý"
          hint={overdueCheckups ? `${overdueCheckups} quá hạn` : 'quá hạn hoặc trong 3 ngày tới'}
          icon={<CalendarClock size={18} />}
          tone={overdueCheckups ? 'danger' : 'warning'}
          active={queueFilter === 'CHECKUP'}
          onClick={() => setQueueFilter(queueFilter === 'CHECKUP' ? 'ALL' : 'CHECKUP')}
        />
        <Stat
          value={data.careSchedules.length}
          label="Chăm sóc đến hạn"
          hint={careDueToday ? `${careDueToday} đến hạn hoặc quá hạn` : 'trong 3 ngày tới'}
          icon={<Syringe size={18} />}
          tone="warning"
          onClick={() => navigate(links.careSchedules)}
        />
      </div>

      {health && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50/70 px-4 py-2.5 text-sm text-emerald-900 ring-1 ring-emerald-100">
          Đang lọc ngựa <span className="font-semibold">{healthLabel[health].toLowerCase()}</span>: mọi khối chỉ hiện ngựa này.
          <button type="button" onClick={() => setHealth('')} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-emerald-100">
            <X size={13} /> Bỏ lọc
          </button>
        </div>
      )}
      {board.error && <ErrorBox message={board.error} />}

      <div className="grid items-start gap-5 lg:grid-cols-12">
        {/* ===== Hàng đợi khám ===== */}
        <Card className="p-0 sm:p-0 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Hàng đợi khám <span className="ml-1 text-sm font-normal text-gray-400">{queue.length}</span>
              </h3>
              <p className="text-xs text-gray-500">Khẩn → tái khám tới hẹn → định kỳ quá hạn → yêu cầu thường → định kỳ sắp đến</p>
            </div>
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc hàng đợi">
              {(
                [
                  ['ALL', 'Tất cả'],
                  ['URGENT', 'Khẩn'],
                  ['FOLLOW_UP', 'Tái khám'],
                  ['CHECKUP', 'Định kỳ'],
                  ['REQUEST', 'Yêu cầu'],
                ] as [QueueFilter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={queueFilter === key}
                  onClick={() => {
                    setQueueFilter(key);
                    setShowAll(false);
                  }}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition',
                    queueFilter === key ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                >
                  {label} <span className="ml-0.5 tabular-nums opacity-70">{filterCount(key)}</span>
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="border-t border-gray-100 p-5">
              <EmptyState
                title={queue.length === 0 ? 'Không có ngựa nào cần khám lúc này' : 'Không có mục nào trong nhóm này'}
                hint={queue.length === 0 ? 'Yêu cầu khám từ Groom, cảnh báo chỉ số, hẹn tái khám và khám định kỳ đến hạn sẽ hiện ở đây.' : 'Chọn "Tất cả" để xem toàn bộ hàng đợi.'}
              />
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {visibleRows.map((item) => (
                <QueueRow
                  key={item.key}
                  item={item}
                  place={placeOf.get(item.horseId)}
                  people={people}
                  canExam={isVet}
                  onExam={exam}
                  onOpen={openHorse}
                />
              ))}
            </ul>
          )}
          {shown.length > QUEUE_PAGE && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="w-full border-t border-gray-100 py-2.5 text-sm font-medium text-emerald-700 hover:bg-gray-50">
              {showAll ? 'Thu gọn' : `Xem thêm ${shown.length - QUEUE_PAGE} mục`}
            </button>
          )}
        </Card>

        {/* ===== Cột phải ===== */}
        <div className="space-y-5 lg:col-span-4">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[0.95rem] font-semibold text-gray-900">{trainer ? 'Sức khỏe ngựa trong khu' : 'Sức khỏe đàn'}</h3>
              {health && (
                <button type="button" onClick={() => setHealth('')} className="text-xs font-medium text-emerald-700 hover:underline">
                  Bỏ lọc
                </button>
              )}
            </div>
            <DonutChart
              segments={healthSegments(scoped.herd.counts)}
              size={140}
              thickness={16}
              centerLabel="ngựa"
              selected={health || undefined}
              onSelect={(key) => setHealth(health === key ? '' : (key as HealthStatus))}
              className="flex-col items-stretch sm:flex-row sm:items-center lg:flex-col lg:items-stretch xl:flex-row xl:items-center"
            />
          </Card>

          <SideCard icon={<FolderOpen size={15} />} title="Đang điều trị" count={data.openCases.length} to={links.cases} toLabel="Bệnh án">
            {data.openCases.length === 0 ? (
              <p className="text-sm text-gray-500">Không có ngựa nào đang điều trị{health || barnId ? ' trong bộ lọc này' : ''}.</p>
            ) : (
              <ul className="-mx-2 space-y-1">
                {data.openCases.map((item) => {
                  const due = !!item.nextVisitAt && item.nextVisitAt.slice(0, 10) <= today;
                  const days = Math.max(0, daysBetween(item.openedAt, now()));
                  return (
                    <li key={item.caseId}>
                      <Link to={links.case(item.caseId)} className="flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-gray-50">
                        <Avatar name={item.horseName} size={32} className="rounded-lg" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-gray-900">{item.horseName}</span>
                          <span className="block truncate text-xs text-gray-500">{item.initialDiagnosis}</span>
                          <span className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                            <span className="tint-gray rounded-md px-1.5 py-0.5">Ngày thứ {days + 1}</span>
                            {item.nextVisitAt ? (
                              <span className={cn('rounded-md px-1.5 py-0.5', due ? 'tint-amber font-semibold' : 'tint-gray')}>
                                {due ? 'Tới hẹn tái khám' : `Tái khám ${formatDateShort(item.nextVisitAt)}`}
                              </span>
                            ) : (
                              <span className="tint-gray rounded-md px-1.5 py-0.5">Chưa hẹn tái khám</span>
                            )}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SideCard>

          <SideCard icon={<Syringe size={15} />} title="Chăm sóc đến hạn" count={data.careSchedules.length} to={links.careSchedules} toLabel="Lịch chăm sóc">
            {careByType.length === 0 ? (
              <p className="text-sm text-gray-500">Không có tiêm phòng, tẩy giun, kiểm tra móng nào đến hạn trong 3 ngày tới.</p>
            ) : (
              <div className="space-y-3">
                {careByType.map((group) => (
                  <div key={group.type}>
                    <p className="mb-1 text-xs font-semibold text-gray-500">
                      {careTypeLabel[group.type]} · {group.rows.length}
                    </p>
                    <ul className="space-y-1">
                      {group.rows.map((row) => (
                        <li key={row.scheduleId} className="flex items-center justify-between gap-3 text-sm">
                          <button type="button" onClick={() => openHorse(row.horseId)} className="min-w-0 truncate text-left text-gray-800 hover:underline">
                            {row.horseName}
                            <span className="ml-1.5 text-xs text-gray-400">{row.assignedTo ? people.name(row.assignedTo) : 'chưa giao'}</span>
                          </button>
                          <CareDue dueAt={`${row.dueDate}T12:00:00`} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </SideCard>
        </div>
      </div>

      {/* ===== Sơ đồ đàn theo khu — thu gọn, mở khi cần xem vị trí ===== */}
      <Card className="p-0 sm:p-0">
        <button
          type="button"
          onClick={() => setMapOpen(!mapOpen)}
          aria-expanded={mapOpen}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-gray-50/70"
        >
          <span className="flex items-center gap-2 text-[0.95rem] font-semibold text-gray-900">
            <span className="tint-emerald flex h-7 w-7 items-center justify-center rounded-lg">
              <MapIcon size={15} />
            </span>
            Sơ đồ đàn theo khu
            <span className="text-xs font-normal text-gray-500">{herd ? `${herd.zones.length} khu · bấm để ${mapOpen ? 'thu gọn' : 'mở'}` : ''}</span>
          </span>
          <ChevronDown size={18} className={cn('text-gray-400 transition-transform', mapOpen && 'rotate-180')} />
        </button>
        {mapOpen && herd && (
          <div className="border-t border-gray-100 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <ZoneLegend />
              <Link to={links.stable} className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-emerald-700">
                Sơ đồ chuồng <ArrowRight size={14} />
              </Link>
            </div>
            {herd.zones.length === 0 && herd.noBarn.length === 0 ? (
              <EmptyState title="Không có ngựa nào khớp bộ lọc" hint="Bỏ lọc khu hoặc sức khỏe để xem toàn đàn." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {herd.zones.map((zone) => (
                  <ZoneBoard
                    key={zone.barn.id}
                    size="compact"
                    variant="nested"
                    barn={zone.barn}
                    cells={zone.cells}
                    mine={barns.data?.scope.myBarnIds.has(zone.barn.id)}
                    isolation={barns.data?.scope.isolationBarnIds.has(zone.barn.id)}
                    cellLink={(cell) => (cell.occupant ? links.horseMedical(cell.occupant.id) : undefined)}
                    footer={
                      zone.waiting.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-500">Chưa xếp ô:</span>
                          {zone.waiting.map((horse) => (
                            <HorseToken key={horse.horseId} horse={horse} onOpen={openHorse} />
                          ))}
                        </div>
                      ) : undefined
                    }
                  />
                ))}
                {herd.noBarn.length > 0 && (
                  <section className="rounded-2xl bg-gray-50/70 p-3.5 ring-1 ring-gray-200/60">
                    <p className="mb-2 text-base font-bold text-gray-900">Chưa xếp khu</p>
                    <div className="flex flex-wrap gap-1.5">
                      {herd.noBarn.map((horse) => (
                        <HorseToken key={horse.horseId} horse={horse} onOpen={openHorse} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
