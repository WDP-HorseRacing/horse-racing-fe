// F3.1 — Bảng điều khiển y tế (VET, CM, HT) từ GET /medical/dashboard.
// Nguyên tắc: phần bình thường để trung tính; chỉ yêu cầu khẩn, quá hạn, sức khỏe bất thường mới có màu.
// Bộ lọc khu và sức khỏe áp cho cả 5 khối, kể cả số đếm (BA chốt: đếm theo bộ lọc).
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, ClipboardList, FolderOpen, Map as MapIcon, Stethoscope, Syringe } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getMedicalDashboard } from '../../api/medical';
import { listBarns } from '../../api/stable';
import type { HealthStatus, MedicalDashboard } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { Button, Card, ChipFilter, Dot, EmptyState, ErrorBox, FilterSelect, PageHeader, SectionTitle, Skeleton, Tip, cn } from '../../components/ui';
import { healthDot } from '../../components/ui/status';
import { healthHint, healthLabel } from '../../lib/labels';
import { careTypeLabel } from '../../lib/api-labels';
import { formatDate, formatDateTime } from '../../lib/format';
import { links, type VisitParams } from '../../lib/links';
import { CareDue } from './components/care';
import { usePeople } from './components/people';
import { CheckupDue, Count, HorseChip, LinkAction, RequestMeta, RequestText } from './components/parts';
import { HEALTH_SEVERITY, healthText, todayKey } from './components/utils';

type HerdHorse = MedicalDashboard['herd']['horses'][number];

/** Dải nhấn trái cho ô có ngựa bất thường — ngựa bình thường không có màu. */
const STALL_ACCENT: Record<HealthStatus, string> = {
  ELIGIBLE: '',
  UNDER_OBSERVATION: 'shadow-[inset_3px_0_0_0_#f59e0b]',
  INJURED: 'shadow-[inset_3px_0_0_0_#ef4444]',
  QUARANTINED: 'shadow-[inset_3px_0_0_0_#ef4444]',
};

function StallCell({ horse, openCase, onOpen }: { horse: HerdHorse; openCase: boolean; onOpen: (id: string) => void }) {
  const abnormal = horse.healthStatus !== 'ELIGIBLE';
  return (
    <Tip content={healthHint[horse.healthStatus]}>
      <button
        type="button"
        onClick={() => onOpen(horse.horseId)}
        className={cn(
          'flex min-h-17 flex-col justify-between rounded-xl border border-gray-200 bg-white p-2.5 text-left transition hover:border-gray-300 hover:bg-gray-50',
          STALL_ACCENT[horse.healthStatus],
        )}
      >
        <span className="flex items-center justify-between gap-1">
          <span className="font-mono text-[11px] text-gray-400">{horse.stallCode}</span>
          {openCase && <FolderOpen size={11} className="text-gray-400" aria-label="Có bệnh án mở" />}
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-gray-900">{horse.horseName}</span>
        {abnormal && <span className={cn('block truncate text-[11px] font-medium', healthText[horse.healthStatus])}>{healthLabel[horse.healthStatus]}</span>}
      </button>
    </Tip>
  );
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

export default function MedicalBoard() {
  const navigate = useNavigate();
  const user = useStore((state) => state.currentUser);
  const isVet = can(user, 'exam.record');
  const [barnId, setBarnId] = useState('');
  const [health, setHealth] = useState<HealthStatus | ''>('');
  const barns = useService(() => listBarns(), []);
  const board = useService(() => getMedicalDashboard({ barnId: barnId || undefined, healthStatus: health || undefined }), [barnId, health]);
  const people = usePeople();
  const exam = (params: VisitParams = {}) => navigate(links.visitNew({ ...params, back: links.medicalBoard }));

  const barnName = useMemo(() => new Map((barns.data ?? []).map((barn) => [barn.id, barn.name])), [barns.data]);
  const data = board.data;

  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { key: string; name: string; placed: HerdHorse[]; waiting: HerdHorse[] }>();
    data.herd.horses.forEach((horse) => {
      const key = horse.barnId ?? '';
      if (!map.has(key)) map.set(key, { key, name: horse.barnId ? (barnName.get(horse.barnId) ?? 'Khu chuồng') : 'Chưa xếp khu', placed: [], waiting: [] });
      const group = map.get(key)!;
      (horse.stallId ? group.placed : group.waiting).push(horse);
    });
    const order = (barns.data ?? []).map((barn) => barn.id);
    return [...map.values()]
      .map((group) => ({ ...group, placed: [...group.placed].sort((a, b) => (a.stallCode ?? '').localeCompare(b.stallCode ?? '')) }))
      .sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : order.indexOf(a.key) - order.indexOf(b.key)));
  }, [data, barnName, barns.data]);

  if (board.loading && !data) return <Skeleton rows={6} />;
  if (board.error && !data) return <ErrorBox message={board.error} />;
  if (!data) return null;

  const openHorse = (horseId: string) => navigate(links.horseMedical(horseId));
  const counts = data.herd.counts;
  const total = HEALTH_SEVERITY.reduce((sum, status) => sum + counts[status], 0);
  const urgentCount = data.pendingRequests.filter((row) => row.urgent).length;
  const openCaseHorses = new Set(data.openCases.map((item) => item.horseId));
  const today = todayKey();
  const filtered = !!barnId || !!health;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bảng điều khiển y tế"
        description="Yêu cầu khám đang chờ, bệnh án đang mở, lịch khám định kỳ, lịch chăm sóc và sức khỏe toàn đàn."
        actions={
          isVet && (
            <Button variant="secondary" onClick={() => exam()}>
              <Stethoscope size={16} /> Ghi buổi khám
            </Button>
          )
        }
      />

      {/* Bộ lọc: khu + sức khỏe (số đếm theo bộ lọc) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FilterSelect value={barnId} onChange={setBarnId} label="Khu chuồng">
          <option value="">Mọi khu</option>
          {barns.data?.map((barn) => (
            <option key={barn.id} value={barn.id}>
              {barn.name}
            </option>
          ))}
        </FilterSelect>
        <ChipFilter<HealthStatus | ''>
          value={health}
          onChange={(value) => setHealth(value === health ? '' : value)}
          options={[
            { value: '', label: 'Tất cả', count: health ? undefined : total },
            ...HEALTH_SEVERITY.map((status) => ({
              value: status,
              label: healthLabel[status],
              count: counts[status],
            })),
          ]}
        />
        {board.loading && <span className="text-xs text-gray-400">Đang tải…</span>}
      </div>
      {board.error && <ErrorBox message={board.error} />}

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          {/* Yêu cầu khám chờ xử lý — khối quan trọng nhất */}
          <Card>
            <SectionTitle icon={<ClipboardList size={16} />} action={<LinkAction to={links.requests}>Tất cả yêu cầu</LinkAction>}>
              Yêu cầu khám chờ xử lý
              <Count value={data.pendingRequests.length} />
              {urgentCount > 0 && <span className="text-sm font-semibold text-red-700">· {urgentCount} khẩn</span>}
            </SectionTitle>
            {data.pendingRequests.length === 0 ? (
              <EmptyState
                title="Không có yêu cầu khám nào đang chờ"
                hint="Yêu cầu từ Groom, nhân viên và cảnh báo chỉ số (sốt, sụt cân) sẽ hiện ở đây, khẩn lên trước."
              />
            ) : (
              <ul className="space-y-2.5">
                {data.pendingRequests.slice(0, 8).map((row) => (
                  <li
                    key={row.id}
                    className={cn(
                      'flex flex-wrap items-start gap-4 rounded-xl bg-white p-4 ring-1',
                      row.urgent ? 'shadow-[inset_3px_0_0_0_#ef4444] ring-red-200' : 'ring-gray-200',
                    )}
                  >
                    <HorseChip horse={{ id: row.horseId, name: row.horseName }} size={40} />
                    <div className="min-w-50 flex-1">
                      <RequestMeta request={row} people={people} />
                      <div className="mt-1.5">
                        <RequestText text={row.description} compact />
                      </div>
                    </div>
                    {isVet && (
                      <Button
                        size="sm"
                        variant={row.urgent ? 'primary' : 'secondary'}
                        onClick={() => exam({ horseId: row.horseId, kind: 'REQUEST', requestIds: [row.id] })}
                      >
                        <Stethoscope size={14} /> Khám
                      </Button>
                    )}
                  </li>
                ))}
                {data.pendingRequests.length > 8 && (
                  <li className="pt-1 text-center text-sm">
                    <Link to={links.requests} className="font-medium text-emerald-700 hover:underline">
                      Xem thêm {data.pendingRequests.length - 8} yêu cầu
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </Card>

          {/* Bệnh án đang mở */}
          <Card>
            <SectionTitle icon={<FolderOpen size={16} />} action={<LinkAction to={links.cases}>Bệnh án</LinkAction>}>
              Bệnh án đang mở
              <Count value={data.openCases.length} />
            </SectionTitle>
            {data.openCases.length === 0 ? (
              <p className="text-sm text-gray-500">Không có bệnh án nào đang mở{filtered ? ' trong bộ lọc này' : ''}.</p>
            ) : (
              <ul className="-mx-2 -my-1 space-y-0.5">
                {data.openCases.map((item) => {
                  const due = !!item.nextVisitAt && item.nextVisitAt.slice(0, 10) <= today;
                  return (
                    <li key={item.caseId}>
                      <Link to={links.case(item.caseId)} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-gray-50">
                        <HorseChip horse={{ id: item.horseId, name: item.horseName }} size={32} plain sub={item.initialDiagnosis} />
                        <div className="ml-auto shrink-0 text-right text-xs text-gray-500">
                          <p>Khám gần nhất {item.lastVisitAt ? formatDate(item.lastVisitAt) : '—'}</p>
                          {item.nextVisitAt ? (
                            <p className={cn(due && 'font-medium text-amber-800')}>
                              Hẹn tái khám {formatDate(item.nextVisitAt)}
                              {due && ' · đã tới hẹn'}
                            </p>
                          ) : (
                            <p>Chưa hẹn tái khám</p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-5">
          {/* Khám định kỳ cần chú ý */}
          <Card>
            <SectionTitle icon={<CalendarClock size={16} />} action={<LinkAction to={links.periodic}>Lịch khám</LinkAction>}>
              Khám định kỳ cần chú ý{data.checkups.length > 0 && <Count value={data.checkups.length} />}
            </SectionTitle>
            {data.checkups.length === 0 ? (
              <p className="text-sm text-gray-500">Không ngựa nào quá hạn hoặc sắp đến hạn khám trong 3 ngày tới.</p>
            ) : (
              <ul className="-my-2 divide-y divide-gray-100">
                {data.checkups.slice(0, 8).map((row) => (
                  <li key={row.horseId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <HorseChip
                      horse={{ id: row.horseId, name: row.horseName }}
                      size={32}
                      sub={row.appointment ? `Hạn ${formatDate(row.dueDate)} · hẹn ${formatDateTime(row.appointment.scheduledAt)}` : `Hạn ${formatDate(row.dueDate)}`}
                    />
                    <div className="flex items-center gap-3">
                      <CheckupDue status={row.dueStatus} daysLeft={row.daysLeft} />
                      {isVet && (
                        <Button size="sm" variant="ghost" onClick={() => exam({ horseId: row.horseId, kind: 'ROUTINE' })}>
                          Khám
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Lịch chăm sóc đến hạn */}
          <Card variant="flat">
            <SectionTitle icon={<Syringe size={16} />} action={<LinkAction to={links.careSchedules}>Lịch chăm sóc</LinkAction>}>
              Lịch chăm sóc đến hạn{data.careSchedules.length > 0 && <Count value={data.careSchedules.length} />}
            </SectionTitle>
            {data.careSchedules.length === 0 ? (
              <p className="text-sm text-gray-500">Không có lịch tiêm phòng, tẩy giun, kiểm tra móng nào đến hạn trong 3 ngày tới.</p>
            ) : (
              <ul className="-my-2 divide-y divide-gray-100">
                {data.careSchedules.map((row) => (
                  <li key={row.scheduleId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <HorseChip
                      horse={{ id: row.horseId, name: row.horseName }}
                      size={32}
                      sub={`${careTypeLabel[row.type]} · ${row.assignedTo ? people.name(row.assignedTo) : 'chưa giao'}`}
                    />
                    <CareDue dueAt={`${row.dueDate}T12:00:00`} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Sơ đồ đàn theo khu */}
      <Card>
        <SectionTitle
          icon={<MapIcon size={16} />}
          action={
            <div className="hidden flex-wrap items-center gap-4 text-xs text-gray-500 sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <Dot tone="warn" /> Cần theo dõi
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Dot tone="danger" /> Chấn thương
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Dot tone="danger" hollow /> Cách ly
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FolderOpen size={11} className="text-gray-400" /> Bệnh án mở
              </span>
            </div>
          }
        >
          Sơ đồ đàn theo khu
        </SectionTitle>
        {groups.length === 0 ? (
          <EmptyState title="Không có ngựa nào khớp bộ lọc" hint="Bỏ lọc khu hoặc sức khỏe để xem toàn đàn." />
        ) : (
          <div className="grid gap-x-8 gap-y-6 xl:grid-cols-2">
            {groups.map((group) => (
              <section key={group.key || 'none'}>
                <p className="mb-2.5 text-sm font-semibold text-gray-800">
                  {group.name}
                  <span className="ml-2 font-normal text-gray-500">{group.placed.length + group.waiting.length} ngựa</span>
                </p>
                {group.placed.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {group.placed.map((horse) => (
                      <StallCell key={horse.horseId} horse={horse} openCase={openCaseHorses.has(horse.horseId)} onOpen={openHorse} />
                    ))}
                  </div>
                )}
                {group.waiting.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">Chưa xếp ô:</span>
                    {group.waiting.map((horse) => (
                      <HorseToken key={horse.horseId} horse={horse} onOpen={openHorse} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </Card>

    </div>
  );
}
