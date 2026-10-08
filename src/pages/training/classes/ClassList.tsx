// F2.3 — Danh sách lớp huấn luyện. BE tự lọc theo vai trò: CM, bác sĩ thấy tất cả, HLV lớp mình phụ trách,
// Groom lớp có lượt mình dắt. Lớp đang chạy là thẻ lớn có thời gian của lớp, tiến độ buổi, buổi kế tiếp.
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Layers, Plus, Users } from 'lucide-react';
import { listClasses, listEnrollments, listPlans, listSessions } from '../../../api/training';
import type { Enrollment, TrainingClass, TrainingClassStatus, TrainingPlan, TrainingSession } from '../../../api/types';
import { Button, ChipFilter, EmptyState, ErrorBox, NotFound, PageHeader, Skeleton, cn } from '../../../components/ui';
import { useService } from '../../../hooks/useService';
import { can } from '../../../auth/permissions';
import { useStore } from '../../../store/store';
import { links } from '../../../lib/links';
import { formatDate } from '../../../lib/format';
import { clubDateKey, clubTime, clubToday, diffDateKeys, isoWeekdayOf } from '../../../lib/club-time';
import { weekdayShort } from '../../../lib/training-labels';
import { gsap, useGSAP } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { ClassStatusPill, IntensityBars, TrialBadge } from '../components/bits';
import { ProgressFill } from '../components/motion';
import { useUserNames } from '../hooks';

interface ClassRow {
  item: TrainingClass;
  sessions: TrainingSession[];
  enrollments: Enrollment[];
}

type Filter = 'ALL' | TrainingClassStatus;

export default function ClassList() {
  const user = useStore((state) => state.currentUser);
  const isManager = user?.role === 'CLUB_MANAGER';
  const canManage = can(user, 'class.manage');
  const scope = useRef<HTMLDivElement>(null);
  const data = useService(async () => {
    const [classes, plans] = await Promise.all([listClasses(), can(user, 'plan.view') ? listPlans().catch(() => [] as TrainingPlan[]) : Promise.resolve([] as TrainingPlan[])]);
    // Lớp còn mở cần buổi và ghi danh để vẽ tiến độ. Lớp đã kết thúc chỉ hiện dòng gọn.
    const rows: ClassRow[] = await Promise.all(
      classes.map(async (item) =>
        item.status === 'ACTIVE' || item.status === 'DRAFT'
          ? { item, sessions: await listSessions(item.id).catch(() => []), enrollments: await listEnrollments(item.id).catch(() => []) }
          : { item, sessions: [], enrollments: [] },
      ),
    );
    return { rows, plans: new Map(plans.map((plan) => [plan.id, plan])) };
  }, [user?.id]);
  const users = useUserNames(isManager);

  const rows = useMemo(() => data.data?.rows ?? [], [data.data]);
  const counts = useMemo(() => {
    const result: Record<Filter, number> = { ALL: rows.length, DRAFT: 0, ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 };
    rows.forEach((row) => (result[row.item.status] += 1));
    return result;
  }, [rows]);
  const [filter, setFilter] = useState<Filter | null>(null);
  const effective: Filter = filter ?? (counts.ACTIVE > 0 ? 'ACTIVE' : 'ALL');
  const visible = rows.filter((row) => effective === 'ALL' || row.item.status === effective);
  const open = visible.filter((row) => row.item.status === 'ACTIVE' || row.item.status === 'DRAFT');
  const closed = visible.filter((row) => row.item.status === 'COMPLETED' || row.item.status === 'CANCELLED');

  useGSAP(
    () => {
      if (prefersReducedMotion() || visible.length === 0) return;
      gsap.from('[data-class-card]', { opacity: 0, y: 16, duration: 0.45, stagger: 0.06, ease: 'power3.out', clearProps: 'all' });
      gsap.from('[data-today-mark]', { y: -10, opacity: 0, duration: 0.5, delay: 0.5, ease: 'back.out(3)' });
    },
    { scope, dependencies: [effective, rows.length] },
  );

  if (!can(user, 'class.view')) return <NotFound />;

  return (
    <div ref={scope} className="space-y-5">
      <PageHeader
        title="Lớp huấn luyện"
        description={
          canManage
            ? 'Các lớp bạn phụ trách. Mỗi lớp theo một giáo án, ngựa ghi danh tập chung các buổi.'
            : isManager
              ? 'Mọi lớp của câu lạc bộ. Quản lý câu lạc bộ chỉ xem.'
              : user?.role === 'GROOM'
                ? 'Các lớp có ngựa bạn được giao dắt.'
                : 'Các lớp huấn luyện của câu lạc bộ.'
        }
        actions={
          canManage && (
            <Link to={links.classNew()}>
              <Button>
                <Plus size={16} /> Mở lớp
              </Button>
            </Link>
          )
        }
      />

      {data.loading && !data.data ? (
        <Skeleton rows={5} />
      ) : data.error ? (
        <ErrorBox message={data.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Chưa có lớp nào"
          hint={canManage ? 'Mở lớp từ một giáo án của bạn: chọn ngày bắt đầu, các thứ trong tuần, hệ thống sinh lịch buổi tập.' : undefined}
          action={
            canManage && (
              <Link to={links.classNew()}>
                <Button>
                  <Plus size={16} /> Mở lớp đầu tiên
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <ChipFilter<Filter>
            value={effective}
            onChange={setFilter}
            options={[
              { value: 'ACTIVE', label: 'Đang chạy', count: counts.ACTIVE },
              { value: 'DRAFT', label: 'Nháp', count: counts.DRAFT },
              { value: 'COMPLETED', label: 'Đã hoàn thành', count: counts.COMPLETED },
              { value: 'CANCELLED', label: 'Đã hủy', count: counts.CANCELLED },
              { value: 'ALL', label: 'Tất cả', count: counts.ALL },
            ]}
          />
          {visible.length === 0 && <EmptyState title="Không có lớp ở trạng thái này" />}
          {open.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-12">
              {open.map((row, index) => (
                <OpenClassCard
                  key={row.item.id}
                  row={row}
                  plan={data.data?.plans.get(row.item.planId)}
                  trainer={isManager && row.item.headTrainerId ? users.get(row.item.headTrainerId)?.fullName : undefined}
                  className={open.length === 1 ? 'lg:col-span-12' : index % 4 === 0 || index % 4 === 3 ? 'lg:col-span-7' : 'lg:col-span-5'}
                />
              ))}
            </div>
          )}
          {closed.length > 0 && (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200/80">
              {closed.map((row) => (
                <li key={row.item.id} data-class-card>
                  <Link to={links.class(row.item.id)} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">
                        <span className="font-mono text-gray-500">{row.item.code}</span> {row.item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(row.item.startDate)} đến {formatDate(row.item.endDate)}
                        {row.item.cancelReason && ` · Lý do hủy: ${row.item.cancelReason}`}
                      </p>
                    </div>
                    <ClassStatusPill status={row.item.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function OpenClassCard({ row, plan, trainer, className = '' }: { row: ClassRow; plan?: TrainingPlan; trainer?: string; className?: string }) {
  const { item, sessions, enrollments } = row;
  const today = clubToday();
  const totalDays = diffDateKeys(item.startDate, item.endDate) + 1;
  const elapsed = Math.min(totalDays, Math.max(0, diffDateKeys(item.startDate, today) + 1));
  const ratio = totalDays > 0 ? elapsed / totalDays : 0;
  const counted = sessions.filter((session) => session.status !== 'CANCELLED');
  const done = counted.filter((session) => session.status === 'COMPLETED').length;
  const drafts = sessions.filter((session) => session.status === 'DRAFT').length;
  const active = enrollments.filter((enrollment) => enrollment.status === 'ACTIVE').length;
  const now = new Date().toISOString();
  const live = sessions.find((session) => session.status === 'IN_PROGRESS');
  const next = live ?? sessions.filter((session) => session.status === 'SCHEDULED' && session.scheduledEndAt >= now).sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt))[0];
  const inRange = today >= item.startDate && today <= item.endDate;
  return (
    <article data-class-card className={cn('flex min-w-0 flex-col rounded-2xl bg-white p-5 ring-1 ring-gray-200/80 transition hover:ring-emerald-200', item.status === 'ACTIVE' ? 'shadow-grass-tint' : 'border border-dashed border-gray-300 ring-0', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-gray-500">{item.code}</p>
          <Link to={links.class(item.id)} className="block truncate text-lg font-bold tracking-tight text-gray-900 hover:text-emerald-800">
            {item.name}
          </Link>
          <p className="mt-0.5 truncate text-sm text-gray-500">{[plan?.name, trainer].filter(Boolean).join(' · ') || 'Theo giáo án của HLV trưởng'}</p>
        </div>
        <ClassStatusPill status={item.status} />
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex justify-between font-mono text-xs text-gray-500">
          <span>{formatDate(item.startDate)}</span>
          <span>{formatDate(item.endDate)}</span>
        </div>
        <div className="relative">
          <ProgressFill ratio={ratio} tone={item.status === 'ACTIVE' ? 'green' : 'gray'} />
          {inRange && <span data-today-mark className="absolute -top-1.5 h-4 w-0.5 rounded-full bg-gray-900" style={{ left: `calc(${ratio * 100}% - 1px)` }} title="Hôm nay" />}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-gray-50/80 px-3 py-2 ring-1 ring-gray-100">
          <p className="flex items-center gap-1 text-xs text-gray-500">
            <Layers size={12} /> Buổi xong
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {done}/{counted.length}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50/80 px-3 py-2 ring-1 ring-gray-100">
          <p className="flex items-center gap-1 text-xs text-gray-500">
            <Users size={12} /> Ngựa
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {active}/{item.maxHorses}
          </p>
        </div>
        <div className={cn('rounded-xl px-3 py-2 ring-1', drafts ? 'bg-amber-50/70 ring-amber-200/70' : 'bg-gray-50/80 ring-gray-100')}>
          <p className="text-xs text-gray-500">Buổi nháp</p>
          <p className="font-mono text-sm font-semibold tabular-nums">{drafts}</p>
        </div>
      </div>

      {next ? (
        <Link to={links.session(next.id)} className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50/60 px-3 py-2.5 ring-1 ring-emerald-100 transition hover:ring-emerald-300">
          <CalendarClock size={16} className="shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-emerald-800">{next.status === 'IN_PROGRESS' ? 'Đang diễn ra' : 'Buổi kế tiếp'}</p>
            <p className="truncate text-sm font-semibold text-gray-900">{next.name}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs text-gray-600">
              {weekdayShort[isoWeekdayOf(clubDateKey(next.scheduledStartAt))]} {formatDate(next.scheduledStartAt).slice(0, 5)}
            </p>
            <p className="font-mono text-sm font-semibold">{clubTime(next.scheduledStartAt)}</p>
          </div>
          <div className="hidden flex-col items-end gap-1 sm:flex">
            <IntensityBars intensity={next.intensity} showLabel={false} />
            <TrialBadge type={next.sessionType} />
          </div>
        </Link>
      ) : (
        <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500 ring-1 ring-gray-100">
          {item.status === 'DRAFT' ? 'Lớp nháp. Kích hoạt để ghi danh ngựa và công bố buổi.' : drafts ? 'Chưa công bố buổi nào sắp tới.' : 'Không còn buổi sắp tới.'}
        </p>
      )}
    </article>
  );
}
