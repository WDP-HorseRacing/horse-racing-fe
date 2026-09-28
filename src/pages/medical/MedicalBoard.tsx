// F3.1 — Bảng điều khiển y tế: VET thao tác; CM và HT xem.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  FolderOpen,
  HeartPulse,
  Lock,
  Map as MapIcon,
  Stethoscope,
  Wrench,
} from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getMedicalBoard, type BoardHorse } from '../../services/medical.service';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  Pill,
  Reveal,
  SectionTitle,
  Skeleton,
  Tip,
  cn,
} from '../../components/ui';
import { UrgencyPill, stallBorder } from '../../components/ui/status';
import { healthHint, healthLabel } from '../../lib/labels';
import { formatDate, formatRelative, toDateKey } from '../../lib/format';
import { links } from '../../lib/links';
import { now } from '../../lib/clock';
import type { HealthStatus } from '../../types/domain';
import ExaminationSheet from './components/ExaminationSheet';
import { HealthChangeModal } from './components/modals';
import { HorseChip, PeriodicPill, RequestLines } from './components/parts';
import { HEALTH_ORDER, healthSwatch } from './components/utils';

const KPI_SPAN: Record<HealthStatus, string> = {
  ELIGIBLE: 'lg:col-span-4',
  UNDER_OBSERVATION: 'lg:col-span-3',
  INJURED: 'lg:col-span-3',
  QUARANTINED: 'lg:col-span-2',
};

function StallCell({
  code,
  horse,
  maintenance,
  dim,
  onOpen,
}: {
  code: string;
  horse?: BoardHorse;
  maintenance?: boolean;
  dim: boolean;
  onOpen: (horseId: string) => void;
}) {
  if (!horse) {
    return (
      <div
        className={cn(
          'flex min-h-18.5 flex-col justify-between rounded-xl border border-dashed p-2.5 text-xs transition',
          maintenance ? 'border-gray-300 bg-gray-100/70 text-gray-400' : 'border-gray-200 bg-white/40 text-gray-300',
          dim && 'opacity-30',
        )}
      >
        <span className="font-mono">{code}</span>
        <span className="flex items-center gap-1">
          {maintenance ? (
            <>
              <Wrench size={11} /> Bảo trì
            </>
          ) : (
            'Trống'
          )}
        </span>
      </div>
    );
  }
  return (
    <Tip content={horse.locked ? `Khóa huấn luyện: ${horse.lockReason}` : healthHint[horse.healthStatus]}>
      <button
        type="button"
        onClick={() => onOpen(horse.id)}
        className={cn(
          'relative flex min-h-18.5 flex-col justify-between rounded-xl border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-grass',
          stallBorder[horse.healthStatus],
          dim && 'opacity-25 hover:translate-y-0',
        )}
      >
        <span className="flex items-center justify-between gap-1">
          <span className="font-mono text-[11px] text-gray-400">{code}</span>
          <span className="flex items-center gap-1">
            {horse.urgentRequest && <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" title="Có yêu cầu khám khẩn" />}
            {horse.openCaseId && <FolderOpen size={11} className="text-amber-600" />}
            {horse.locked && <Lock size={11} className="text-red-600" />}
          </span>
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-gray-900">{horse.name}</span>
        <span className={cn('block truncate text-[11px] font-medium', healthSwatch[horse.healthStatus].text)}>
          {healthLabel[horse.healthStatus]}
          {horse.lifecycleStatus === 'RETIRED' && <span className="font-normal text-gray-400"> · giải nghệ</span>}
        </span>
      </button>
    </Tip>
  );
}

function HorseToken({ horse, dim, onOpen }: { horse: BoardHorse; dim: boolean; onOpen: (horseId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(horse.id)}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:shadow-grass',
        stallBorder[horse.healthStatus],
        dim && 'opacity-25',
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', healthSwatch[horse.healthStatus].dot)} />
      {horse.name}
      {horse.locked && <Lock size={11} className="text-red-600" />}
    </button>
  );
}

export default function MedicalBoard() {
  const navigate = useNavigate();
  const board = useService(() => getMedicalBoard(), []);
  const [filter, setFilter] = useState<HealthStatus | ''>('');
  const [exam, setExam] = useState<{ horseId?: string } | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);

  if (board.loading && !board.data) return <Skeleton rows={6} />;
  if (board.error) return <ErrorBox message={board.error} />;
  const data = board.data!;
  const todayKey = toDateKey(now());
  const openHorse = (horseId: string) => navigate(links.horse(horseId, 'medical'));
  const dim = (horse?: BoardHorse) => !!filter && (!horse || horse.healthStatus !== filter);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Y tế"
        title="Bảng điều khiển y tế"
        description="Sức khỏe toàn đàn, yêu cầu khám đang chờ, lịch khám định kỳ, bệnh án đang mở và khóa huấn luyện."
        actions={
          (data.canChangeHealth || data.canExamine) && (
            <>
              {data.canChangeHealth && (
                <Button variant="secondary" onClick={() => setHealthOpen(true)}>
                  <HeartPulse size={16} /> Đổi trạng thái sức khỏe
                </Button>
              )}
              {data.canExamine && (
                <Button onClick={() => setExam({})}>
                  <Stethoscope size={16} /> Ghi buổi khám
                </Button>
              )}
            </>
          )
        }
      />

      {/* Dải KPI sức khỏe — bấm để lọc sơ đồ */}
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-12">
        {HEALTH_ORDER.map((status) => {
          const count = data.counts[status];
          const active = filter === status;
          return (
            <button
              key={status}
              type="button"
              data-reveal
              onClick={() => setFilter(active ? '' : status)}
              className={cn(
                'group flex flex-col justify-between rounded-2xl bg-white p-5 text-left ring-1 transition-all duration-200 hover:-translate-y-0.5',
                KPI_SPAN[status],
                active ? 'ring-2 ring-offset-2 ring-offset-canvas' : 'ring-emerald-950/5',
                active && status === 'ELIGIBLE' && 'ring-emerald-500',
                active && status === 'UNDER_OBSERVATION' && 'ring-amber-400',
                active && status === 'INJURED' && 'ring-red-400',
                active && status === 'QUARANTINED' && 'ring-fuchsia-400',
                status === 'INJURED' && count > 0 ? 'shadow-red' : status === 'UNDER_OBSERVATION' && count > 0 ? 'shadow-amber' : 'shadow-grass',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-500">
                <span className={cn('h-2.5 w-2.5 rounded-full', healthSwatch[status].dot)} />
                {healthLabel[status]}
              </span>
              <span className="mt-3 flex items-end justify-between gap-3">
                <span className={cn('text-4xl font-bold leading-none tabular-nums', count > 0 ? healthSwatch[status].text : 'text-gray-300')}>
                  {count}
                </span>
                {status === 'ELIGIBLE' ? (
                  <span className="flex h-2 w-40 max-w-[55%] overflow-hidden rounded-full bg-gray-100">
                    {HEALTH_ORDER.map((item) => (
                      <span
                        key={item}
                        className={healthSwatch[item].bar}
                        style={{ width: `${data.totalHorses ? (data.counts[item] / data.totalHorses) * 100 : 0}%` }}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="text-right text-[11px] leading-tight text-gray-400">{healthHint[status]}</span>
                )}
              </span>
              {status === 'ELIGIBLE' && (
                <span className="mt-2 text-xs text-gray-400">
                  trên {data.totalHorses} ngựa còn ở câu lạc bộ{filter && ' · đang lọc sơ đồ, bấm lại để bỏ lọc'}
                </span>
              )}
            </button>
          );
        })}
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Yêu cầu khám chờ xử lý */}
        <Card tone={data.urgentCount > 0 ? 'danger' : 'default'} className="lg:col-span-7 lg:row-span-2">
          <SectionTitle
            icon={<ClipboardList size={16} />}
            action={
              <Link to={links.requests} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
                Tất cả yêu cầu <ArrowUpRight size={14} />
              </Link>
            }
          >
            Yêu cầu khám chờ xử lý
            <span className="rounded-md bg-gray-100 px-1.5 text-xs font-semibold text-gray-600 tabular-nums">{data.pendingRequests.length}</span>
            {data.urgentCount > 0 && (
              <Pill tone="red" pulse>
                {data.urgentCount} khẩn
              </Pill>
            )}
          </SectionTitle>
          {data.pendingRequests.length === 0 ? (
            <EmptyState title="Không có yêu cầu khám nào đang chờ" hint="Yêu cầu từ Groom, cảnh báo chỉ số và cảnh báo buổi tập sẽ hiện ở đây." />
          ) : (
            <ul className="space-y-2.5">
              {data.pendingRequests.slice(0, 8).map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    'flex flex-wrap items-start gap-4 rounded-xl p-3.5 ring-1',
                    row.urgency === 'URGENT' ? 'bg-red-50/80 ring-red-200' : 'bg-gray-50/70 ring-gray-100',
                  )}
                >
                  <HorseChip horse={row.horse} size={40} />
                  <div className="min-w-50 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <UrgencyPill urgency={row.urgency} />
                      <span className="font-medium text-gray-700">{row.sourceLabel}</span>
                      <span>· {row.createdByName}</span>
                      <span>· {formatRelative(row.createdAt, now())}</span>
                    </div>
                    <div className="mt-1.5">
                      <RequestLines lines={row.descriptionLines} compact />
                    </div>
                  </div>
                  {row.canExamine && (
                    <Button
                      size="sm"
                      variant={row.urgency === 'URGENT' ? 'danger' : 'primary'}
                      onClick={() => setExam({ horseId: row.horse.id })}
                    >
                      <Stethoscope size={14} /> Khám ngay
                    </Button>
                  )}
                </li>
              ))}
              {data.pendingRequests.length > 8 && (
                <li className="text-center text-sm text-gray-500">
                  <Link to={links.requests} className="font-medium text-emerald-700 hover:underline">
                    Xem thêm {data.pendingRequests.length - 8} yêu cầu
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Card>

        {/* Quá hạn / sắp tới hạn khám định kỳ */}
        <Card tone={data.periodicAlertCount > 0 ? 'warning' : 'default'} className="lg:col-span-5">
          <SectionTitle
            icon={<CalendarClock size={16} />}
            action={
              <Link to={links.periodic} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
                Lịch khám <ArrowUpRight size={14} />
              </Link>
            }
          >
            Khám định kỳ cần chú ý
          </SectionTitle>
          {data.periodicDue.length === 0 ? (
            <p className="rounded-xl bg-emerald-50/60 p-4 text-sm text-emerald-800">Mọi ngựa đều đúng hạn khám định kỳ.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.periodicDue.slice(0, 6).map((row) => (
                <li key={row.horse.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <HorseChip horse={row.horse} size={32} sub={`Hạn ${formatDate(row.dueDate)}`} />
                  <div className="flex items-center gap-2">
                    <PeriodicPill state={row.state} label={row.stateLabel} overdueDays={row.overdueDays} alerted={row.alerted} />
                    {data.canExamine && (
                      <Button size="sm" variant="soft" onClick={() => setExam({ horseId: row.horse.id })}>
                        Khám
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Khóa đang hiệu lực */}
        <Card variant="flat" tone={data.activeLocks.length ? 'danger' : 'muted'} className="lg:col-span-5">
          <SectionTitle
            icon={<Lock size={16} />}
            action={
              <Link to={links.locks} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
                Quản lý khóa <ArrowUpRight size={14} />
              </Link>
            }
          >
            Khóa huấn luyện đang hiệu lực
            <span className="rounded-md bg-white px-1.5 text-xs font-semibold text-gray-600 tabular-nums">{data.activeLocks.length}</span>
          </SectionTitle>
          {data.activeLocks.length === 0 ? (
            <p className="text-sm text-gray-500">Không có ngựa nào đang bị khóa huấn luyện.</p>
          ) : (
            <ul className="space-y-2">
              {data.activeLocks.map((lock) => (
                <li key={lock.id} className="rounded-xl bg-white p-3 ring-1 ring-red-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <HorseChip horse={lock.horse} size={30} sub={`Từ ${formatDate(lock.placedAt)} · ${lock.placedByName}`} />
                    <span className="text-xs text-gray-500">
                      {lock.expectedLiftDate ? `Dự kiến gỡ ${formatDate(lock.expectedLiftDate)}` : 'Chưa đặt ngày gỡ'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{lock.reason}</p>
                  {lock.pastExpected && (
                    <p className="mt-1.5 text-xs font-medium text-amber-700">Đã qua ngày dự kiến — chờ bác sĩ xác nhận</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Bệnh án đang mở */}
        <Card className="lg:col-span-4">
          <SectionTitle
            icon={<FolderOpen size={16} />}
            action={
              <Link to={links.cases} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
                Bệnh án <ArrowUpRight size={14} />
              </Link>
            }
          >
            Bệnh án đang mở
          </SectionTitle>
          {data.openCases.length === 0 ? (
            <p className="text-sm text-gray-500">Không có bệnh án nào đang mở.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.openCases.map((item) => {
                const due = item.nextAppointment && item.nextAppointment <= todayKey;
                return (
                  <li key={item.id}>
                    <Link
                      to={links.case(item.id)}
                      className="block rounded-xl bg-amber-50/50 p-3.5 ring-1 ring-amber-100 transition hover:bg-amber-50 hover:shadow-amber"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={item.horse.avatar} name={item.horse.name} size={34} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                          <p className="truncate text-xs text-gray-500">
                            {item.horse.name} · mở {formatDate(item.openedAt)} · {item.examCount} buổi khám
                          </p>
                        </div>
                        {item.activeLock && <Lock size={14} className="shrink-0 text-red-500" />}
                      </div>
                      {item.nextAppointment && (
                        <p className={cn('mt-2 text-xs', due ? 'font-semibold text-red-600' : 'text-gray-500')}>
                          Hẹn khám tiếp {formatDate(item.nextAppointment)}
                          {due && ' — đã tới hẹn'}
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Sơ đồ chuồng theo sức khỏe */}
        <Card className="lg:col-span-8">
          <SectionTitle
            icon={<MapIcon size={16} />}
            action={
              <div className="hidden flex-wrap items-center gap-3 text-xs text-gray-500 sm:flex">
                {HEALTH_ORDER.map((status) => (
                  <span key={status} className="inline-flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', healthSwatch[status].dot)} /> {healthLabel[status]}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1">
                  <Lock size={11} className="text-red-600" /> khóa
                </span>
                <span className="inline-flex items-center gap-1">
                  <FolderOpen size={11} className="text-amber-600" /> bệnh án mở
                </span>
              </div>
            }
          >
            Sơ đồ chuồng theo sức khỏe
            {filter && (
              <button type="button" onClick={() => setFilter('')} className="ml-1">
                <Pill tone="gray">Lọc: {healthLabel[filter]} ✕</Pill>
              </button>
            )}
          </SectionTitle>
          <div className="space-y-6">
            {data.zones.map((zone) => (
              <section key={zone.id}>
                <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800">
                    {zone.name}
                    <span className="ml-2 font-light text-gray-400">{zone.trainerName ? `HT ${zone.trainerName}` : 'Chưa có HT phụ trách'}</span>
                  </p>
                  {zone.status !== 'ACTIVE' && <Pill tone="amber">{zone.status === 'MAINTENANCE' ? 'Khu bảo trì' : 'Khu đóng'}</Pill>}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                  {zone.cells.map((cell) => (
                    <StallCell
                      key={cell.stallId}
                      code={cell.code}
                      horse={cell.horse}
                      maintenance={cell.status === 'MAINTENANCE'}
                      dim={dim(cell.horse)}
                      onOpen={openHorse}
                    />
                  ))}
                </div>
                {zone.waiting.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400">Chờ xếp ô:</span>
                    {zone.waiting.map((horse) => (
                      <HorseToken key={horse.id} horse={horse} dim={dim(horse)} onOpen={openHorse} />
                    ))}
                  </div>
                )}
              </section>
            ))}
            {data.noZone.length > 0 && (
              <section className="rounded-xl bg-orange-50/50 p-3 ring-1 ring-orange-100">
                <p className="mb-2 text-xs font-medium text-orange-800">Chưa xếp khu</p>
                <div className="flex flex-wrap gap-2">
                  {data.noZone.map((horse) => (
                    <HorseToken key={horse.id} horse={horse} dim={dim(horse)} onOpen={openHorse} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </Card>
      </div>

      {data.urgentCount > 0 && data.canExamine && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 lg:hidden">
          <Button variant="danger" onClick={() => setExam({ horseId: data.pendingRequests[0].horse.id })}>
            <AlertOctagon size={16} /> Khám yêu cầu khẩn
          </Button>
        </div>
      )}

      {exam && (
        <ExaminationSheet
          horseId={exam.horseId}
          onClose={() => setExam(null)}
          onDone={() => {
            setExam(null);
            board.reload();
          }}
        />
      )}
      {healthOpen && (
        <HealthChangeModal
          onClose={() => setHealthOpen(false)}
          onDone={() => {
            setHealthOpen(false);
            board.reload();
          }}
        />
      )}
    </div>
  );
}
