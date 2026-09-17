import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  Target,
} from 'lucide-react';
import { useStore } from '../store/store';
import { useI18n } from '../i18n/I18nContext';

const dateFormatter = new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short' });

const TrainerAdjustPlan = () => {
  const plans = useStore((state) => state.trainingPlans);
  const horses = useStore((state) => state.horses);
  const { t } = useI18n();
  const horseNames = new Map(horses.map((horse) => [horse.id, horse.name]));
  const sessions = plans
    .flatMap((plan) => plan.phases.flatMap((phase) => phase.sessions.map((session) => ({ plan, phase, session }))))
    .sort((a, b) => `${a.session.date}T${a.session.time}`.localeCompare(`${b.session.date}T${b.session.time}`));
  const completed = sessions.filter(({ session }) => session.status === 'completed').length;
  const scheduled = sessions.filter(({ session }) => session.status === 'scheduled').length;
  const averageLoad = sessions.length
    ? Math.round(sessions.reduce((sum, { session }) => sum + session.workloadPercent, 0) / sessions.length)
    : 0;

  return (
    <div className="space-y-7 pb-12">
      <header className="grid gap-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-7 lg:grid-cols-[1fr_320px] lg:p-9">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            <CalendarDays size={15} /> {t('Training execution')}
          </div>
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-gray-900">
            {t('One objective, delivered through focused sessions.')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
            {t('Review what happens next across every active plan. Each session belongs to a phase and every phase serves the plan’s primary objective.')}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 self-end">
          <Metric value={plans.length} label={t('Plans')} />
          <Metric value={scheduled} label={t('Ready')} />
          <Metric value={`${averageLoad}%`} label={t('Avg load')} />
        </div>
      </header>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('Execution queue')}</h2>
              <p className="mt-1 text-sm text-gray-400">{t('Sessions ordered by date, with their plan context intact.')}</p>
            </div>
            <span className="text-xs font-semibold text-emerald-700">{completed}/{sessions.length} {t('completed')}</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_8px_rgba(5,96,69,0.05)]">
            {sessions.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">{t('No training sessions have been planned yet.')}</div>
            ) : (
              sessions.map(({ plan, phase, session }) => (
                <Link
                  key={session.id}
                  to={`/plan/${plan.horseId}/session/${session.id}?phaseId=${phase.id}`}
                  className="group grid gap-4 border-b border-gray-50 p-5 transition last:border-0 hover:bg-emerald-50/40 sm:grid-cols-[84px_1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-800">{dateFormatter.format(new Date(`${session.date}T00:00:00`))}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Clock3 size={12} /> {session.time}</p>
                  </div>
                  <div className="min-w-0 sm:border-l sm:border-gray-100 sm:pl-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{session.title}</h3>
                      <Status status={session.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-gray-400">
                      {horseNames.get(plan.horseId) ?? plan.horseId} · {plan.name} · {phase.name}
                    </p>
                    <p className="mt-2 line-clamp-1 text-sm text-gray-500">{session.objective}</p>
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <div className="text-right"><p className="text-sm font-bold text-gray-800">{session.workloadPercent}%</p><p className="text-[11px] text-gray-400">{t('workload')}</p></div>
                    <ArrowUpRight size={17} className="text-gray-300 transition group-hover:text-emerald-600" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div><h2 className="text-lg font-bold text-gray-900">{t('Plan progression')}</h2><p className="mt-1 text-sm text-gray-400">{t('The larger purpose behind this schedule.')}</p></div>
          {plans.map((plan) => {
            const planSessions = plan.phases.flatMap((phase) => phase.sessions);
            const planCompleted = planSessions.filter((session) => session.status === 'completed').length;
            const progress = planSessions.length ? Math.round((planCompleted / planSessions.length) * 100) : 0;
            return (
              <Link key={plan.id} to={`/plan/${plan.horseId}`} className="block rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_8px_rgba(5,96,69,0.05)] transition hover:border-emerald-100">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold text-emerald-700">{horseNames.get(plan.horseId) ?? plan.horseId}</p><h3 className="mt-1 font-bold text-gray-900">{plan.name}</h3></div>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-emerald-700">{t(plan.status)}</span>
                </div>
                <div className="mt-4 flex gap-3"><Target size={17} className="mt-0.5 shrink-0 text-emerald-600" /><p className="text-sm leading-5 text-gray-500">{plan.objective}</p></div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress}%` }} /></div>
                <div className="mt-2 flex justify-between text-xs text-gray-400"><span>{plan.phases.length} {t('phases')} · {planSessions.length} {t('sessions')}</span><span>{progress}%</span></div>
                <div className="mt-4 flex items-start gap-2 border-t border-gray-50 pt-4 text-xs text-gray-400"><Flag size={14} className="mt-0.5 shrink-0 text-amber-500" /> {plan.targetEvent || t('No target event')}</div>
              </Link>
            );
          })}
          <div className="flex items-center gap-3 rounded-2xl bg-gray-900 p-5 text-white">
            <Activity size={18} className="text-emerald-400" />
            <div><p className="text-sm font-semibold">{t('Schedule health')}</p><p className="mt-0.5 text-xs text-gray-400">{scheduled} {t('scheduled')} · {completed} {t('completed')}</p></div>
          </div>
        </aside>
      </div>
    </div>
  );
};

function Metric({ value, label }: { value: string | number; label: string }) {
  return <div className="rounded-2xl border border-white/80 bg-white/75 p-4"><p className="text-xl font-bold text-gray-900">{value}</p><p className="mt-1 text-[11px] text-gray-400">{label}</p></div>;
}

function Status({ status }: { status: string }) {
  const complete = status === 'completed';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{complete && <CheckCircle2 size={11} />}{status.replace('_', ' ')}</span>;
}

export default TrainerAdjustPlan;
