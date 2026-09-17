import { useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { useStore } from '../store/store';
import { useI18n } from '../i18n/I18nContext';
import type { TrainingSession } from '../types/raceos';
import { T } from '../i18n/T';

export default function TrainingSessionEditor() {
  const { id, sessionId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const plan = useStore(state => state.trainingPlans.find(item => item.horseId === id));
  const saveSession = useStore(state => state.saveTrainingSession);
  const phase = plan?.phases.find(item => item.id === params.get('phaseId')) ?? plan?.phases[0];
  const existing = phase?.sessions.find(item => item.id === sessionId);
  const [title, setTitle] = useState(existing?.title ?? 'New training session');
  const [objective, setObjective] = useState(existing?.objective ?? 'Support the objective of this phase.');
  const [type, setType] = useState(existing?.type ?? 'Aerobic');
  const [date, setDate] = useState(existing?.date ?? '2026-09-20');
  const [time, setTime] = useState(existing?.time ?? '06:00');
  const [distanceM, setDistance] = useState(existing?.distanceM ?? 1200);
  const [durationMin, setDuration] = useState(existing?.durationMin ?? 30);
  const [workloadPercent, setWorkload] = useState(existing?.workloadPercent ?? 50);
  const [intensity, setIntensity] = useState<TrainingSession['intensity']>(existing?.intensity ?? 'Light');
  const [surface, setSurface] = useState<TrainingSession['surface']>(existing?.surface ?? 'Turf');
  const [assignedGroom, setGroom] = useState(existing?.assignedGroom ?? 'Mai Tran');
  const [note, setNote] = useState(existing?.note ?? '');

  if (!plan || !phase) return <div className="py-20 text-center text-gray-400">{t('Publish the plan before adding sessions.')}</div>;
  const energyMcal = Math.round(16 + distanceM / 1000 * (intensity === 'High' ? 10 : intensity === 'Moderate' ? 7 : 5));
  const save = () => {
    saveSession(plan.id, phase.id, { id: existing?.id ?? `session-${Date.now()}`, title, objective, type, date, time, distanceM, durationMin, workloadPercent, intensity, surface, status: existing?.status ?? 'planned', assignedGroom, note, energyMcal, concentratePercent: intensity === 'High' ? 50 : intensity === 'Moderate' ? 40 : 25 });
    navigate(`/plan/${plan.horseId}`);
  };
  const options = (current: string, value: string) => `rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${current === value ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`;

  return <div className="mx-auto max-w-4xl space-y-7 pb-12">
    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-medium text-gray-400"><ArrowLeft size={16} /> {t('Back to plan')}</button>
    <div><h1 className="text-2xl font-bold text-gray-900">{t(existing ? 'Edit training session' : 'Add training session')}</h1><p className="text-gray-500">{plan.name} · {phase.name}</p></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="space-y-5 rounded-2xl border border-gray-100 bg-white p-7 shadow-[0_2px_8px_rgba(5,96,69,0.05)]">
        <Field label={t('Session title')}><input value={title} onChange={event => setTitle(event.target.value)} /></Field>
        <Field label={t('Session purpose')}><textarea value={objective} onChange={event => setObjective(event.target.value)} className="min-h-24" /></Field>
        <Field label={t('Exercise type')}><input value={type} onChange={event => setType(event.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-4"><Field label={t('Date')}><input type="date" value={date} onChange={event => setDate(event.target.value)} /></Field><Field label={t('Time')}><input type="time" value={time} onChange={event => setTime(event.target.value)} /></Field></div>
        <Field label={t('Intensity')}><div className="flex flex-wrap gap-2">{(['Light', 'Moderate', 'High'] as const).map(value => <button key={value} onClick={() => setIntensity(value)} className={options(intensity, value)}>{t(value)}</button>)}</div></Field>
        <Field label={t('Surface')}><div className="flex flex-wrap gap-2">{(['Soft', 'Turf', 'Dirt', 'Synthetic', 'Sand'] as const).map(value => <button key={value} onClick={() => setSurface(value)} className={options(surface, value)}>{t(value)}</button>)}</div></Field>
        <div className="grid grid-cols-3 gap-4"><NumberField label={t('Distance (m)')} value={distanceM} onChange={setDistance} /><NumberField label={t('Duration (min)')} value={durationMin} onChange={setDuration} /><NumberField label={t('Workload (%)')} value={workloadPercent} onChange={setWorkload} /></div>
        <Field label={t('Assigned groom')}><input value={assignedGroom} onChange={event => setGroom(event.target.value)} /></Field>
        <Field label={t('Execution note')}><textarea value={note} onChange={event => setNote(event.target.value)} className="min-h-24" /></Field>
      </section>
      <aside className="h-fit rounded-2xl border border-amber-100 bg-amber-50 p-6"><Sparkles className="mb-4 text-amber-500" /><p className="text-xs font-semibold text-amber-700">{t('Session nutrition estimate')}</p><p className="mt-2 text-4xl font-bold text-gray-900">{energyMcal}</p><p className="text-sm text-gray-500"><T>Mcal / day</T></p><div className="mt-6 border-t border-amber-100 pt-5"><p className="text-sm text-gray-600">{t('Concentrate')}: <strong>{intensity === 'High' ? 50 : intensity === 'Moderate' ? 40 : 25}%</strong></p></div></aside>
    </div>
    <div className="flex justify-end"><button onClick={save} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3 font-semibold text-white"><Save size={18} /> {t('Save session')}</button></div>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-medium text-gray-500">{label}<div className="mt-2 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-gray-200 [&>input]:bg-gray-50 [&>input]:p-3 [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:border-gray-200 [&>textarea]:bg-gray-50 [&>textarea]:p-3">{children}</div></label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Field label={label}><input type="number" value={value} onChange={event => onChange(Number(event.target.value))} /></Field>; }
