// F3.1 — Bảng điều khiển y tế (VET, CM, HT) từ GET /medical/dashboard.
// Nguyên tắc: phần bình thường để trung tính; chỉ yêu cầu khẩn, quá hạn, sức khỏe bất thường mới có màu.
// Bộ lọc khu và sức khỏe áp cho cả 5 khối, kể cả số đếm (BA chốt: đếm theo bộ lọc).
// Head Trainer chỉ thấy ngựa thuộc khu mình phụ trách và khu cách ly (BE trả toàn câu lạc bộ, FE lọc).
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, ClipboardList, FolderOpen, Map as MapIcon, Stethoscope, Syringe } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getMedicalDashboard } from '../../api/medical';
import { listBarns, listStalls } from '../../api/stable';
import type { HealthStatus, MedicalDashboard } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { Button, Card, Dot, EmptyState, ErrorBox, FilterSelect, PageHeader, SectionTitle, Skeleton, Tabs, cn } from '../../components/ui';
import { MedicalBoardSkeleton } from '../../components/skeletons';
import { canSeeBarn, computeZoneScope } from '../../lib/zone-scope';
import { primeZoneScope } from '../../hooks/useMyScope';
import { scopeDashboard } from './components/scope';
import { healthDot } from '../../components/ui/status';
import { healthLabel } from '../../lib/labels';
import { careTypeLabel } from '../../lib/api-labels';
import { formatDate, formatDateTime } from '../../lib/format';
import { links, type VisitParams } from '../../lib/links';
import { CareDue } from './components/care';
import { usePeople } from './components/people';
import { CheckupDue, Count, HorseChip, LinkAction, RequestMeta, RequestText } from './components/parts';
import { HEALTH_SEVERITY, todayKey } from './components/utils';
import { ZoneBoard, ZoneLegend } from '../stable/components/ZoneBoard';
import { buildCells, type StallOccupant } from '../stable/components/barn';

type HerdHorse = MedicalDashboard['herd']['horses'][number];

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
  // HT: gọi BE không kèm bộ lọc sức khỏe rồi lọc ở FE, để số đếm từng tab tính đúng trong phạm vi khu.
  const board = useService(
    () => getMedicalDashboard({ barnId: barnId || undefined, healthStatus: trainer ? undefined : health || undefined }),
    [barnId, trainer ? '' : health],
  );
  const people = usePeople();
  const exam = (params: VisitParams = {}) => navigate(links.visitNew({ ...params, back: links.medicalBoard }));

  const visible = barns.data?.scope.visibleBarnIds;
  const data = useMemo(() => {
    if (!board.data) return undefined;
    if (!trainer) return board.data;
    return visible ? scopeDashboard(board.data, visible, health) : undefined;
  }, [board.data, trainer, visible, health]);

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

  // HT chờ có phạm vi khu rồi mới hiện, để không lóe dữ liệu toàn câu lạc bộ.
  if ((board.loading || (trainer && barns.loading)) && !data) return <MedicalBoardSkeleton />;
  if (board.error && !data) return <ErrorBox message={board.error} />;
  if (!data) return null;

  const openHorse = (horseId: string) => navigate(links.horseMedical(horseId));
  const counts = data.herd.counts;
  const total = HEALTH_SEVERITY.reduce((sum, status) => sum + counts[status], 0);
  const urgentCount = data.pendingRequests.filter((row) => row.urgent).length;
  const today = todayKey();
  const filtered = !!barnId || !!health;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bảng điều khiển y tế"
        description={
          trainer
            ? 'Yêu cầu khám, bệnh án đang mở, lịch khám và lịch chăm sóc của ngựa trong khu bạn phụ trách và khu cách ly.'
            : 'Yêu cầu khám đang chờ, bệnh án đang mở, lịch khám định kỳ, lịch chăm sóc và sức khỏe toàn đàn.'
        }
        actions={
          isVet && (
            <Button variant="secondary" onClick={() => exam()}>
              <Stethoscope size={16} /> Ghi buổi khám
            </Button>
          )
        }
      />

      {/* Bộ lọc: sức khỏe (tab) + khu, áp cho mọi khối bên dưới (số đếm theo bộ lọc) */}
      <div className="flex flex-wrap items-end gap-3">
        <Tabs
          className="min-w-0 flex-1"
          active={health}
          onChange={(key) => setHealth(key as HealthStatus | '')}
          tabs={[
            { key: '', label: trainer ? 'Ngựa trong khu' : 'Toàn đàn', count: health ? undefined : total },
            ...HEALTH_SEVERITY.map((status) => ({ key: status, label: healthLabel[status], count: counts[status] })),
          ]}
        />
        <div className="flex items-center gap-2 pb-1.5">
          {board.loading && <span className="text-xs text-gray-400">Đang tải…</span>}
          <FilterSelect value={barnId} onChange={setBarnId} label="Khu chuồng">
            <option value="">{trainer ? 'Mọi khu của bạn' : 'Mọi khu'}</option>
            {barns.data?.items.map((barn) => (
              <option key={barn.id} value={barn.id}>
                {barn.name}
              </option>
            ))}
          </FilterSelect>
        </div>
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

      {/* Sơ đồ đàn theo khu — cùng cách vẽ với Sơ đồ chuồng */}
      <Card>
        <SectionTitle icon={<MapIcon size={16} />} action={<LinkAction to={links.stable}>Sơ đồ chuồng</LinkAction>}>
          Sơ đồ đàn theo khu
        </SectionTitle>
        <ZoneLegend className="mb-4" />
        {!herd ? (
          <Skeleton rows={2} />
        ) : herd.zones.length === 0 && herd.noBarn.length === 0 ? (
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
      </Card>
    </div>
  );
}
