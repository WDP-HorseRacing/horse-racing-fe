// F2.2 — Chi tiết một giáo án: dải tuần lớn, các môn theo thứ tự kèm tuần học, và các lớp đang dùng giáo án.
import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { getPlan, listClasses } from '../../../api/training';
import type { TrainingClass } from '../../../api/types';
import { Button, EmptyState, NotFound, PageHeader, Skeleton } from '../../../components/ui';
import { useService } from '../../../hooks/useService';
import { useStore } from '../../../store/store';
import { useCrumbs } from '../../../components/Breadcrumb';
import { links } from '../../../lib/links';
import { formatDate } from '../../../lib/format';
import { formatMeters, formatRaceTime } from '../../../lib/training-format';
import { gsap, useGSAP } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { ClassStatusPill, Figure, IntensityBars, TrialBadge, WeekRibbon, planSegments } from '../components/bits';
import { useUserNames } from '../hooks';

export default function PlanDetail() {
  const { id = '' } = useParams();
  const user = useStore((state) => state.currentUser);
  const scope = useRef<HTMLDivElement>(null);
  const data = useService(async () => {
    const [plan, classes] = await Promise.all([getPlan(id), listClasses().catch(() => [] as TrainingClass[])]);
    return { plan, classes: classes.filter((item) => item.planId === id) };
  }, [id]);
  const users = useUserNames(user?.role === 'CLUB_MANAGER');
  useCrumbs(data.data ? [{ label: data.data.plan.name }] : null, [{ label: 'Giáo án', to: links.plans }]);

  useGSAP(
    () => {
      if (!data.data || prefersReducedMotion()) return;
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('[data-ribbon-segment]', { scaleX: 0, transformOrigin: 'left center', duration: 0.6, stagger: 0.06 })
        .from('[data-plan-step]', { opacity: 0, x: -14, duration: 0.4, stagger: 0.06, clearProps: 'all' }, '-=0.35');
    },
    { scope, dependencies: [!!data.data] },
  );

  if (data.loading && !data.data) return <Skeleton rows={6} />;
  if (data.error || !data.data) return <NotFound message={data.error} />;
  const { plan, classes } = data.data;
  const mine = plan.headTrainerId === user?.id;

  return (
    <div ref={scope} className="space-y-5">
      <PageHeader
        back={
          <Link to={links.plans} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900">
            <ArrowLeft size={15} /> Giáo án
          </Link>
        }
        eyebrow={!mine ? users.get(plan.headTrainerId)?.fullName : undefined}
        title={plan.name}
        description={plan.description ?? undefined}
        actions={
          mine && (
            <>
              <Link to={links.planEdit(plan.id)}>
                <Button variant="secondary">
                  <Pencil size={15} /> Sửa giáo án
                </Button>
              </Link>
              <Link to={links.classNew(plan.id)}>
                <Button>
                  <Plus size={15} /> Mở lớp từ giáo án
                </Button>
              </Link>
            </>
          )
        }
      />

      <section className="turf-soft rounded-3xl p-6 shadow-grass-tint ring-1 ring-emerald-900/10">
        <div className="mb-5 flex flex-wrap items-end gap-x-8 gap-y-3">
          <Figure label="Tổng số tuần" value={<span className="text-3xl">{plan.totalWeeks}</span>} />
          <Figure label="Số môn" value={<span className="text-3xl">{plan.subjects.length}</span>} />
          <Figure label="Lớp dùng giáo án" value={<span className="text-3xl">{classes.length}</span>} />
          <p className="ml-auto text-xs text-gray-500">Cập nhật {formatDate(plan.updatedAt)}</p>
        </div>
        <WeekRibbon segments={planSegments(plan)} size="lg" />
      </section>

      <div className="grid gap-5 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <h3 className="mb-3 font-semibold text-gray-900">Các môn theo thứ tự</h3>
          <ol className="relative space-y-2.5 border-l-2 border-dashed border-emerald-200 pl-5">
            {plan.subjects.map((item) => (
              <li key={item.position} data-plan-step className="relative rounded-2xl bg-white p-4 ring-1 ring-gray-200/80">
                <span className="absolute -left-[27px] top-5 h-3 w-3 rounded-full bg-emerald-600 ring-4 ring-[#f5f6f4]" aria-hidden />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs tabular-nums text-gray-500">
                      Tuần {item.startWeek}
                      {item.weeks > 1 && ` đến ${item.startWeek + item.weeks - 1}`}
                      {` · ${item.weeks} tuần`}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="truncate font-semibold text-gray-900">{item.subject.name}</p>
                      <TrialBadge type={item.subject.sessionType} />
                    </div>
                    {item.subject.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.subject.description}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    <IntensityBars intensity={item.subject.intensity} />
                    <span className="font-mono tabular-nums">{formatMeters(item.subject.plannedDistanceM)}</span>
                    {item.subject.surface && <span>{item.subject.surface}</span>}
                    {item.subject.targetTimeMs && <span className="font-mono tabular-nums text-amber-800">Mục tiêu {formatRaceTime(item.subject.targetTimeMs)}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="lg:col-span-5">
          <h3 className="mb-3 font-semibold text-gray-900">Lớp dùng giáo án này</h3>
          {classes.length === 0 ? (
            <EmptyState title="Chưa có lớp nào" hint={mine ? 'Mở lớp để sinh lịch buổi tập từ giáo án.' : undefined} />
          ) : (
            <ul className="space-y-2">
              {classes.map((item) => (
                <li key={item.id}>
                  <Link to={links.class(item.id)} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 transition hover:ring-emerald-200">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{item.name}</p>
                      <p className="font-mono text-xs text-gray-500">
                        {item.code} · {formatDate(item.startDate)} đến {formatDate(item.endDate)}
                      </p>
                    </div>
                    <ClassStatusPill status={item.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
