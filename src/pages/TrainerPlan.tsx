import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CircleDashed, Flag, Plus, Save, Target } from 'lucide-react';
import { useStore } from '../store/store';
import { useI18n } from '../i18n/I18nContext';
import type { TrainingPlan } from '../types/raceos';

const TrainerPlan = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const horse = useStore(state => state.horses.find(item => item.id === id));
  const storedPlan = useStore(state => state.trainingPlans.find(plan => plan.horseId === id));
  const savePlan = useStore(state => state.saveTrainingPlan);
  const fallback = useMemo(() => createEmptyPlan(id ?? ''), [id]);
  const plan = storedPlan ?? fallback;
  const [name, setName] = useState(plan.name);
  const [objective, setObjective] = useState(plan.objective);
  const [targetEvent, setTargetEvent] = useState(plan.targetEvent);
  if (!horse) return <div className="py-20 text-center text-gray-400">{t('Horse not found')}</div>;
  const sessions = plan.phases.flatMap(phase => phase.sessions);
  const completed = sessions.filter(session => session.status === 'completed').length;
  const progress = sessions.length ? Math.round(completed / sessions.length * 100) : 0;
  const handleSave = () => savePlan({ ...plan, name, objective, targetEvent, publishedAt: new Date().toISOString() });

  return <div className="space-y-7 pb-12">
    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-gray-600"><ArrowLeft size={16} /> {t('Back')}</button>
    <section className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-emerald-50 p-8">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-[1fr_280px]">
        <div><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-700"><Target size={15} /> {t('Primary training objective')}</div><h1 className="max-w-3xl text-3xl font-bold tracking-tight text-gray-900">{objective}</h1><p className="mt-4 text-sm text-gray-500">{horse.name} · {plan.startDate} → {plan.endDate}</p></div>
        <div className="rounded-2xl border border-white/80 bg-white/75 p-5 backdrop-blur"><div className="flex items-center gap-2 text-xs font-semibold text-gray-400"><Flag size={14} className="text-amber-500" /> {t('Target event')}</div><p className="mt-2 font-semibold text-gray-900">{targetEvent || t('Not set')}</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress}%` }} /></div><div className="mt-2 flex justify-between text-xs text-gray-400"><span>{progress}% {t('complete')}</span><span>{completed}/{sessions.length} {t('sessions')}</span></div></div>
      </div>
    </section>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[[plan.phases.length, t('Phases')], [sessions.length, t('Sessions')], [sessions.filter(session => session.status === 'scheduled').length, t('Scheduled')], [t(plan.status), t('Plan status')]].map(([value, label]) => <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_8px_rgba(5,96,69,0.05)]"><p className="text-2xl font-bold capitalize text-gray-900">{value}</p><p className="mt-1 text-xs text-gray-400">{label}</p></div>)}
    </div>
    <section className="rounded-2xl border border-gray-100 bg-white p-7 shadow-[0_2px_8px_rgba(5,96,69,0.05)]">
      <h2 className="mb-5 text-sm font-semibold text-gray-500">{t('Plan definition')}</h2>
      <div className="grid gap-5 md:grid-cols-2"><label className="text-sm text-gray-500">{t('Plan name')}<input value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800" /></label><label className="text-sm text-gray-500">{t('Target event')}<input value={targetEvent} onChange={event => setTargetEvent(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800" /></label><label className="text-sm text-gray-500 md:col-span-2">{t('Primary objective')}<textarea value={objective} onChange={event => setObjective(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800" /></label></div>
    </section>
    <section>
      <div className="mb-5"><h2 className="text-lg font-bold text-gray-900">{t('Phases & sessions')}</h2><p className="text-sm text-gray-400">{t('Each phase advances the plan objective through focused sessions.')}</p></div>
      <div>{[...plan.phases].sort((a, b) => a.order - b.order).map((phase, index) => <div key={phase.id} className="grid grid-cols-[40px_1fr] gap-4">
        <div className="flex flex-col items-center"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">{index + 1}</div>{index < plan.phases.length - 1 && <div className="w-px flex-1 bg-emerald-100" />}</div>
        <div className="pb-9"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-gray-900">{phase.name}</h3><p className="text-xs text-gray-400">{phase.startDate} → {phase.endDate}</p><p className="mt-2 text-sm text-gray-500">{phase.objective}</p></div><span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{phase.sessions.filter(session => session.status === 'completed').length}/{phase.sessions.length} {t('done')}</span></div>
          <div className="grid gap-3 xl:grid-cols-2">{phase.sessions.map(session => <Link key={session.id} to={`/plan/${plan.horseId}/session/${session.id}?phaseId=${phase.id}`} className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex gap-3">{session.status === 'completed' ? <CheckCircle2 size={19} className="mt-0.5 text-emerald-600" /> : <CircleDashed size={19} className="mt-0.5 text-amber-500" />}<div><p className="font-semibold text-gray-800">{session.title}</p><p className="mt-1 text-xs text-gray-400">{session.date} · {session.time} · {session.type}</p></div></div><span className="text-xs font-semibold capitalize text-gray-400">{t(session.status)}</span></div><div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500"><span className="rounded-lg bg-gray-50 px-2 py-1">{session.distanceM} m</span><span className="rounded-lg bg-gray-50 px-2 py-1">{session.durationMin} min</span><span className="rounded-lg bg-gray-50 px-2 py-1">{t(session.intensity)}</span><span className="rounded-lg bg-gray-50 px-2 py-1">{t(session.surface)}</span></div></Link>)}
            <Link to={`/plan/${plan.horseId}/session/new?phaseId=${phase.id}`} className="flex min-h-32 items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"><Plus size={17} /> {t('Add session to')} {phase.name}</Link>
          </div>
        </div>
      </div>)}</div>
    </section>
    <div className="flex justify-end"><button onClick={handleSave} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3 font-semibold text-white shadow-sm shadow-emerald-600/20"><Save size={18} /> {t('Publish plan changes')}</button></div>
  </div>;
};

function createEmptyPlan(horseId: string): TrainingPlan {
  return { id: `plan-${horseId}`, horseId, name: 'New training plan', objective: 'Define the primary outcome for this training cycle.', status: 'draft', startDate: '2026-09-18', endDate: '2026-10-18', targetEvent: '', note: '', publishedAt: '', phases: [{ id: `phase-${horseId}-foundation`, name: 'Foundation', objective: 'Establish the baseline required for the plan objective.', order: 1, startDate: '2026-09-18', endDate: '2026-09-28', sessions: [] }] };
}

export default TrainerPlan;
