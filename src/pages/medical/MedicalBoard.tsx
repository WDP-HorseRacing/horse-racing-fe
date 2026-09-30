// F3.1 — Bảng điều khiển y tế: VET thao tác; CM và HT xem.
// Nguyên tắc: phần bình thường để trung tính; chỉ yêu cầu khẩn, quá hạn, khóa, sức khỏe bất thường mới có màu.
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
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
  ChipFilter,
  Dot,
  EmptyState,
  ErrorBox,
  PageHeader,
  SectionTitle,
  Skeleton,
  Tip,
  cn,
} from '../../components/ui';
import { UrgencyPill, ZoneStatusPill, healthDot } from '../../components/ui/status';
import { healthHint, healthLabel } from '../../lib/labels';
import { formatDate, formatRelative, toDateKey } from '../../lib/format';
import { links } from '../../lib/links';
import { now } from '../../lib/clock';
import type { HealthStatus } from '../../types/domain';
import ExaminationSheet from './components/ExaminationSheet';
import { HealthChangeModal } from './components/modals';
import { HorseChip, PeriodicPill, RequestLines } from './components/parts';
import { HEALTH_ORDER, healthText } from './components/utils';

/** Dải nhấn trái cho ô chuồng có ngựa bất thường — ngựa bình thường không có màu. */
const STALL_ACCENT: Record<HealthStatus, string> = {
  ELIGIBLE: '',
  UNDER_OBSERVATION: 'shadow-[inset_3px_0_0_0_#f59e0b]',
  INJURED: 'shadow-[inset_3px_0_0_0_#ef4444]',
  QUARANTINED: 'shadow-[inset_3px_0_0_0_#ef4444]',
};

function LinkAction({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
      {children} <ArrowUpRight size={14} />
    </Link>
  );
}

function Count({ value }: { value: number }) {
  return <span className="rounded-md bg-gray-100 px-1.5 text-xs font-semibold text-gray-600 tabular-nums">{value}</span>;
}

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
          'flex min-h-17 flex-col justify-between rounded-xl border border-dashed p-2.5 text-xs text-gray-400',
          maintenance ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-transparent',
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
  const abnormal = horse.healthStatus !== 'ELIGIBLE';
  const retired = horse.lifecycleStatus === 'RETIRED';
  return (
    <Tip content={horse.locked ? `Khóa huấn luyện: ${horse.lockReason}` : healthHint[horse.healthStatus]}>
      <button
        type="button"
        onClick={() => onOpen(horse.id)}
        className={cn(
          'flex min-h-17 flex-col justify-between rounded-xl border border-gray-200 bg-white p-2.5 text-left transition hover:border-gray-300 hover:bg-gray-50',
          STALL_ACCENT[horse.healthStatus],
          dim && 'opacity-25',
        )}
      >
        <span className="flex items-center justify-between gap-1">
          <span className="font-mono text-[11px] text-gray-400">{code}</span>
          <span className="flex items-center gap-1">
            {horse.openCaseId && <FolderOpen size={11} className="text-gray-400" />}
            {horse.locked && <Lock size={11} className="text-red-600" />}
          </span>
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-gray-900">{horse.name}</span>
        {abnormal ? (
          <span className={cn('block truncate text-[11px] font-medium', healthText[horse.healthStatus])}>
            {healthLabel[horse.healthStatus]}
          </span>
        ) : (
          retired && <span className="block truncate text-[11px] text-gray-400">đã giải nghệ</span>
        )}
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
        'inline-flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300',
        dim && 'opacity-25',
      )}
    >
      {horse.healthStatus !== 'ELIGIBLE' && <Dot tone={healthDot[horse.healthStatus]} hollow={horse.healthStatus === 'QUARANTINED'} />}
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
  const urgentFirst = data.pendingRequests.find((row) => row.urgency === 'URGENT');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bảng điều khiển y tế"
        description="Yêu cầu khám đang chờ, lịch khám định kỳ, bệnh án đang mở, khóa huấn luyện và sức khỏe toàn đàn."
        actions={
          (data.canChangeHealth || data.canExamine) && (
            <>
              {data.canChangeHealth && (
                <Button variant="secondary" onClick={() => setHealthOpen(true)}>
                  <HeartPulse size={16} /> Đổi trạng thái sức khỏe
                </Button>
              )}
              {data.canExamine && (
                <Button variant="secondary" onClick={() => setExam({})}>
                  <Stethoscope size={16} /> Ghi buổi khám
                </Button>
              )}
            </>
          )
        }
      />

      {/* Sức khỏe toàn đàn — một hàng chip, bấm để lọc sơ đồ chuồng */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm text-gray-500">Sức khỏe toàn đàn</span>
        <ChipFilter<HealthStatus | ''>
          value={filter}
          onChange={(value) => setFilter(value === filter ? '' : value)}
          options={[
            { value: '', label: 'Tất cả', count: data.totalHorses },
            ...HEALTH_ORDER.map((status) => ({
              value: status,
              label: healthLabel[status],
              count: data.counts[status],
              dot: status === 'ELIGIBLE' ? ('neutral' as const) : healthDot[status],
              hollow: status === 'QUARANTINED',
            })),
          ]}
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        {/* Yêu cầu khám chờ xử lý — khối quan trọng nhất */}
        <div className="space-y-5 lg:col-span-7">
          <Card>
            <SectionTitle icon={<ClipboardList size={16} />} action={<LinkAction to={links.requests}>Tất cả yêu cầu</LinkAction>}>
              Yêu cầu khám chờ xử lý
              <Count value={data.pendingRequests.length} />
              {data.urgentCount > 0 && <span className="text-sm font-semibold text-red-700">· {data.urgentCount} khẩn</span>}
            </SectionTitle>
            {data.pendingRequests.length === 0 ? (
              <EmptyState
                title="Không có yêu cầu khám nào đang chờ"
                hint="Yêu cầu từ Groom, cảnh báo chỉ số và cảnh báo buổi tập sẽ hiện ở đây."
              />
            ) : (
              <ul className="space-y-2.5">
                {data.pendingRequests.slice(0, 8).map((row) => {
                  const urgent = row.urgency === 'URGENT';
                  return (
                    <li
                      key={row.id}
                      className={cn(
                        'flex flex-wrap items-start gap-4 rounded-xl bg-white p-4 ring-1',
                        urgent ? 'shadow-[inset_3px_0_0_0_#ef4444] ring-red-200' : 'ring-gray-200',
                      )}
                    >
                      <HorseChip horse={row.horse} size={40} />
                      <div className="min-w-50 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                          {urgent && <UrgencyPill urgency={row.urgency} />}
                          <span className="font-medium text-gray-700">{row.sourceLabel}</span>
                          <span>· {row.createdByName}</span>
                          <span>· {formatRelative(row.createdAt, now())}</span>
                        </div>
                        <div className="mt-1.5">
                          <RequestLines lines={row.descriptionLines} compact />
                        </div>
                      </div>
                      {row.canExamine && (
                        <Button size="sm" variant={urgent ? 'primary' : 'secondary'} onClick={() => setExam({ horseId: row.horse.id })}>
                          <Stethoscope size={14} /> Khám ngay
                        </Button>
                      )}
                    </li>
                  );
                })}
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
              <p className="text-sm text-gray-500">Không có bệnh án nào đang mở.</p>
            ) : (
              <ul className="-mx-2 -my-1 space-y-0.5">
                {data.openCases.map((item) => {
                  const due = item.nextAppointment && item.nextAppointment <= todayKey;
                  return (
                    <li key={item.id}>
                      <Link to={links.case(item.id)} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-gray-50">
                        <Avatar src={item.horse.avatar} name={item.horse.name} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-900">
                            {item.title}
                            {item.activeLock && <Lock size={12} className="shrink-0 text-red-600" />}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {item.horse.name} · mở {formatDate(item.openedAt)} · {item.examCount} buổi khám
                            {item.nextAppointment && (
                              <span className={cn(due && 'font-medium text-amber-800')}>
                                {' '}
                                · hẹn {formatDate(item.nextAppointment)}
                                {due && ' (đã tới hẹn)'}
                              </span>
                            )}
                          </p>
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
          {/* Quá hạn / sắp tới hạn khám định kỳ */}
          <Card>
            <SectionTitle icon={<CalendarClock size={16} />} action={<LinkAction to={links.periodic}>Lịch khám</LinkAction>}>
              Khám định kỳ cần chú ý{data.periodicDue.length > 0 && <Count value={data.periodicDue.length} />}
            </SectionTitle>
            {data.periodicDue.length === 0 ? (
              <p className="text-sm text-gray-500">Mọi ngựa đều đúng hạn khám định kỳ.</p>
            ) : (
              <ul className="-my-2 divide-y divide-gray-100">
                {data.periodicDue.slice(0, 6).map((row) => (
                  <li key={row.horse.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <HorseChip horse={row.horse} size={32} sub={`Hạn ${formatDate(row.dueDate)}`} />
                    <div className="flex items-center gap-3">
                      <PeriodicPill state={row.state} label={row.stateLabel} overdueDays={row.overdueDays} alerted={row.alerted} />
                      {data.canExamine && (
                        <Button size="sm" variant="ghost" onClick={() => setExam({ horseId: row.horse.id })}>
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
          <Card>
            <SectionTitle icon={<Lock size={16} />} action={<LinkAction to={links.locks}>Quản lý khóa</LinkAction>}>
              Khóa huấn luyện đang hiệu lực
              <Count value={data.activeLocks.length} />
            </SectionTitle>
            {data.activeLocks.length === 0 ? (
              <p className="text-sm text-gray-500">Không có ngựa nào đang bị khóa huấn luyện.</p>
            ) : (
              <ul className="-my-2 divide-y divide-gray-100">
                {data.activeLocks.map((lock) => (
                  <li key={lock.id} className="py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <HorseChip horse={lock.horse} size={32} sub={`Từ ${formatDate(lock.placedAt)} · ${lock.placedByName}`} />
                      <span className="text-xs text-gray-500">
                        {lock.expectedLiftDate ? `Dự kiến gỡ ${formatDate(lock.expectedLiftDate)}` : 'Chưa đặt ngày gỡ'}
                      </span>
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-800">
                      <Lock size={12} className="shrink-0 text-red-600" />
                      {lock.reason}
                    </p>
                    {lock.pastExpected && (
                      <p className="mt-1 text-xs font-medium text-amber-800">Đã qua ngày dự kiến — chờ bác sĩ xác nhận</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Sơ đồ chuồng theo sức khỏe */}
      <Card>
        <SectionTitle
          icon={<MapIcon size={16} />}
          action={
            <div className="hidden flex-wrap items-center gap-4 text-xs text-gray-500 sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <Dot tone="warn" /> Cần theo dõi
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Dot tone="danger" /> Chấn thương · Cách ly
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock size={11} className="text-red-600" /> Khóa huấn luyện
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FolderOpen size={11} className="text-gray-400" /> Bệnh án mở
              </span>
            </div>
          }
        >
          Sơ đồ chuồng theo sức khỏe
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="ml-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              Lọc: {healthLabel[filter]} ✕
            </button>
          )}
        </SectionTitle>
        <div className="grid gap-x-8 gap-y-6 xl:grid-cols-2">
          {data.zones.map((zone) => (
            <section key={zone.id}>
              <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">
                  {zone.name}
                  <span className="ml-2 font-normal text-gray-500">
                    {zone.trainerName ? `HT ${zone.trainerName}` : 'Chưa có HT phụ trách'}
                  </span>
                </p>
                {zone.status !== 'ACTIVE' && <ZoneStatusPill status={zone.status} />}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
                  <span className="text-xs font-medium text-amber-800">Chờ xếp ô:</span>
                  {zone.waiting.map((horse) => (
                    <HorseToken key={horse.id} horse={horse} dim={dim(horse)} onOpen={openHorse} />
                  ))}
                </div>
              )}
            </section>
          ))}
          {data.noZone.length > 0 && (
            <section>
              <p className="mb-2.5 text-sm font-semibold text-gray-800">
                Chưa xếp khu <span className="ml-1 text-xs font-medium text-amber-800">chờ xếp chỗ</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {data.noZone.map((horse) => (
                  <HorseToken key={horse.id} horse={horse} dim={dim(horse)} onOpen={openHorse} />
                ))}
              </div>
            </section>
          )}
        </div>
      </Card>

      {urgentFirst && data.canExamine && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 lg:hidden">
          <Button onClick={() => setExam({ horseId: urgentFirst.horse.id })}>
            <Stethoscope size={16} /> Khám yêu cầu khẩn
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
