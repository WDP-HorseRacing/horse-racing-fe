import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Lock, Stethoscope } from 'lucide-react';
import { useStore } from '../store/store';
import { T } from '../i18n/T';
import { useI18n } from '../i18n/I18nContext';

export default function VeterinaryAction({ mode }: { mode: 'exam' | 'injury' | 'lock' }) {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const horse = useStore(state => state.horses.find(item => item.id === id));
  const updateHorse = useStore(state => state.updateHorse);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  if (!horse) return <div className="py-20 text-center text-gray-400"><T>Horse not found</T></div>;
  const title = mode === 'exam' ? 'Record examination' : mode === 'injury' ? 'Injury mapping' : 'Lock training';
  const submit = () => {
    if (mode === 'lock') updateHorse(horse.id, { healthStatus: 'UNDER_OBSERVATION' });
    setSaved(true);
  };
  return <div className="mx-auto max-w-2xl space-y-6"><button onClick={() => navigate(-1)} className="text-sm font-medium text-gray-400"><T>← Back to medical</T></button><div><h2 className="text-2xl font-bold text-gray-900"><T>{title}</T></h2><p className="text-gray-500">{horse.name} · <T>{horse.currentPhase}</T></p></div>{saved ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6"><CheckCircle2 className="mb-3 text-emerald-600" /><p className="font-semibold text-gray-900"><T>Medical record saved</T></p><p className="text-sm text-gray-500"><T>The horse timeline and responsible team were updated.</T></p></div> : <div className="rounded-2xl border border-gray-100 bg-white p-7 shadow-[0_2px_8px_rgba(5,96,69,0.05)]"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">{mode === 'lock' ? <Lock className="text-red-500" /> : <Stethoscope className="text-emerald-600" />}</div><label className="block text-sm text-gray-500"><T>{mode === 'injury' ? 'Affected area and severity' : mode === 'lock' ? 'Clinical reason and restrictions' : 'Findings, diagnosis, and treatment'}</T><textarea value={notes} onChange={event => setNotes(event.target.value)} className="mt-2 min-h-36 w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 focus:border-emerald-500 focus:outline-none" placeholder={t('Enter clinical notes…')} /></label><button onClick={submit} className={`mt-6 w-full rounded-xl py-3 font-semibold text-white ${mode === 'lock' ? 'bg-red-600' : 'bg-emerald-600'}`}><T>{mode === 'lock' ? 'Confirm training lock' : 'Save medical record'}</T></button></div>}</div>;
}
