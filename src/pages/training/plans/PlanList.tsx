// F2.2 — Giáo án. HLV trưởng thấy và lập giáo án của riêng mình, Club Manager xem mọi giáo án.
// Giáo án sửa gần nhất là thẻ lớn bên trái, các giáo án khác xếp cột phải, mỗi thẻ có dải tuần theo cường độ.
import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Layers, Pencil, Plus } from 'lucide-react';
import { listClasses, listPlans, listSubjects } from '../../../api/training';
import type { TrainingClass, TrainingPlan } from '../../../api/types';
import { Button, EmptyState, ErrorBox, NotFound, PageHeader, Skeleton, cn } from '../../../components/ui';
import { useService } from '../../../hooks/useService';
import { can } from '../../../auth/permissions';
import { useStore } from '../../../store/store';
import { links } from '../../../lib/links';
import { formatDate } from '../../../lib/format';
import { gsap, useGSAP } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { WeekRibbon, planSegments } from '../components/bits';
import { useUserNames } from '../hooks';

export default function PlanList() {
  const user = useStore((state) => state.currentUser);
  const isManager = user?.role === 'CLUB_MANAGER';
  const canManage = can(user, 'plan.manage');
  const scope = useRef<HTMLDivElement>(null);
  const data = useService(async () => {
    const [plans, classes, subjects] = await Promise.all([listPlans(), listClasses().catch(() => [] as TrainingClass[]), canManage ? listSubjects() : Promise.resolve([])]);
    return { plans, classes, subjectCount: subjects.length };
  }, [canManage]);
  const users = useUserNames(isManager);

  const plans = useMemo(() => [...(data.data?.plans ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [data.data]);
  const classCount = useMemo(() => {
    const counts = new Map<string, number>();
    (data.data?.classes ?? []).forEach((item) => counts.set(item.planId, (counts.get(item.planId) ?? 0) + 1));
    return counts;
  }, [data.data]);

  // Thẻ hiện dần, các đoạn của dải tuần trải từ trái sang.
  useGSAP(
    () => {
      if (prefersReducedMotion() || plans.length === 0) return;
      gsap.from('[data-plan-card]', { opacity: 0, y: 18, duration: 0.45, stagger: 0.06, ease: 'power3.out', clearProps: 'all' });
      gsap.from('[data-ribbon-segment]', { scaleX: 0, transformOrigin: 'left center', duration: 0.6, stagger: 0.03, delay: 0.15, ease: 'power3.out', clearProps: 'transform' });
    },
    { scope, dependencies: [plans.length] },
  );

  if (!can(user, 'plan.view')) return <NotFound message="Giáo án dành cho huấn luyện viên trưởng và quản lý câu lạc bộ." />;

  const [hero, ...rest] = plans;

  return (
    <div ref={scope} className="space-y-5">
      <PageHeader
        title="Giáo án"
        description={isManager ? 'Giáo án của mọi huấn luyện viên trưởng. Quản lý câu lạc bộ chỉ xem.' : 'Ghép các môn học theo tuần, dùng lại cho nhiều lớp của bạn.'}
        actions={
          canManage && (
            <Link to={links.planNew}>
              <Button>
                <Plus size={16} /> Lập giáo án
              </Button>
            </Link>
          )
        }
      />

      {data.loading && !data.data ? (
        <Skeleton rows={5} />
      ) : data.error ? (
        <ErrorBox message={data.error} />
      ) : plans.length === 0 ? (
        <EmptyState
          title={canManage ? 'Bạn chưa có giáo án nào' : 'Chưa có giáo án nào'}
          hint={
            canManage
              ? data.data?.subjectCount
                ? 'Giáo án gồm các môn xếp theo thứ tự, mỗi môn học trong vài tuần. Lập xong thì mở lớp từ giáo án.'
                : 'Câu lạc bộ chưa có môn học nào. Nhờ quản lý câu lạc bộ thêm môn trước khi lập giáo án.'
              : 'Huấn luyện viên trưởng chưa lập giáo án.'
          }
          action={
            canManage && !!data.data?.subjectCount && (
              <Link to={links.planNew}>
                <Button>
                  <Plus size={16} /> Lập giáo án đầu tiên
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          {hero && (
            <PlanCard
              plan={hero}
              classCount={classCount.get(hero.id) ?? 0}
              owner={isManager ? users.get(hero.headTrainerId)?.fullName : undefined}
              canManage={canManage}
              large
              className="lg:col-span-7 lg:row-span-2"
            />
          )}
          {rest.map((plan, index) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              classCount={classCount.get(plan.id) ?? 0}
              owner={isManager ? users.get(plan.headTrainerId)?.fullName : undefined}
              canManage={canManage}
              className={index < 2 ? 'lg:col-span-5' : 'lg:col-span-6'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  classCount,
  owner,
  canManage,
  large,
  className = '',
}: {
  plan: TrainingPlan;
  classCount: number;
  owner?: string;
  canManage: boolean;
  large?: boolean;
  className?: string;
}) {
  const trials = plan.subjects.filter((item) => item.subject.sessionType === 'TIME_TRIAL').length;
  return (
    <article
      data-plan-card
      className={cn(
        'group flex min-w-0 flex-col rounded-2xl bg-white ring-1 ring-gray-200/80 transition hover:ring-emerald-200',
        large ? 'turf-soft p-6 shadow-grass-tint' : 'p-5 shadow-[0_14px_30px_-26px_rgba(6,78,59,0.5)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {owner && <p className="mb-1 text-sm text-gray-500">{owner}</p>}
          <Link to={links.plan(plan.id)} className={cn('block truncate font-bold tracking-tight text-gray-900 hover:text-emerald-800', large ? 'text-2xl' : 'text-lg')}>
            {plan.name}
          </Link>
          {plan.description && <p className={cn('mt-1 text-sm text-gray-600', large ? 'line-clamp-3' : 'line-clamp-2')}>{plan.description}</p>}
        </div>
        <div className={cn('flex shrink-0 flex-col items-end rounded-xl bg-white/80 px-3 py-1.5 ring-1 ring-emerald-900/10', large && 'px-4 py-2')}>
          <span className={cn('font-mono font-bold tabular-nums text-emerald-800', large ? 'text-3xl' : 'text-xl')}>{plan.totalWeeks}</span>
          <span className="text-xs text-gray-500">tuần</span>
        </div>
      </div>

      <WeekRibbon segments={planSegments(plan)} size={large ? 'lg' : 'md'} className={large ? 'mt-6' : 'mt-4'} />

      {large && (
        <ol className="mt-5 grid gap-1.5 sm:grid-cols-2">
          {plan.subjects.map((item) => (
            <li key={item.position} className="flex min-w-0 items-center gap-2 text-sm">
              <span className="w-16 shrink-0 font-mono text-xs tabular-nums text-gray-500">
                T{item.startWeek}
                {item.weeks > 1 && `-${item.startWeek + item.weeks - 1}`}
              </span>
              <span className="truncate text-gray-800">{item.subject.name}</span>
            </li>
          ))}
        </ol>
      )}

      <div className={cn('mt-auto flex flex-wrap items-center justify-between gap-3 pt-5', large && 'border-t border-emerald-900/10 pt-4')}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange size={14} className="text-gray-400" /> {plan.subjects.length} môn
          </span>
          {trials > 0 && <span>{trials} môn chạy thử</span>}
          <span className="inline-flex items-center gap-1.5">
            <Layers size={14} className="text-gray-400" /> {classCount ? `${classCount} lớp dùng` : 'Chưa có lớp'}
          </span>
          <span className="text-xs text-gray-400">Sửa {formatDate(plan.updatedAt)}</span>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Link to={links.planEdit(plan.id)}>
              <Button variant="inline" size="sm">
                <Pencil size={13} /> Sửa
              </Button>
            </Link>
            <Link to={links.classNew(plan.id)}>
              <Button variant={large ? 'primary' : 'secondary'} size="sm">
                <Plus size={13} /> Mở lớp
              </Button>
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
