import { useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, MapPin, Trophy } from 'lucide-react';
import { useStore } from '../store/store';
import { upcomingRaces } from '../data/raceos';
import { useI18n } from '../i18n/I18nContext';
import type { RaceAptitude } from '../types/raceos';

const allowedRoles = ['HEAD_TRAINER', 'CLUB_MANAGER', 'HORSE_OWNER'];

const RaceRegistration = () => {
  const { t } = useI18n();
  const currentUser = useStore(state => state.currentUser);
  const allHorses = useStore(state => state.horses);
  const ownerships = useStore(state => state.ownerships);
  const registrations = useStore(state => state.raceRegistrations);
  const registerRace = useStore(state => state.registerRace);
  const [selectedHorseId, setSelectedHorseId] = useState('');
  const [selectedRaceId, setSelectedRaceId] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!currentUser || !allowedRoles.includes(currentUser.role)) {
    return <div className="rounded-2xl border border-amber-100 bg-amber-50 p-8 text-center text-sm text-amber-700">{t('You do not have permission to register a horse for a race.')}</div>;
  }

  const ownedHorseIds = new Set(ownerships.filter(item => item.ownerId === currentUser.id).map(item => item.horseId));
  const horses = allHorses.filter(horse =>
    horse.lifecycleStatus === 'ACTIVE' &&
    horse.healthStatus === 'ELIGIBLE' &&
    (horse.raceReadiness === 'Peak' || horse.raceReadiness === 'High') &&
    (currentUser.role !== 'HORSE_OWNER' || ownedHorseIds.has(horse.id)),
  );
  const horse = horses.find(item => item.id === selectedHorseId);
  const race = upcomingRaces.find(item => item.id === selectedRaceId);
  const raceType = race ? aptitudeForDistance(race.dist) : null;
  const matches = Boolean(horse && raceType && horse.race_aptitude === raceType);
  const duplicate = Boolean(horse && race && registrations.some(item => item.horseId === horse.id && item.raceId === race.id));

  const submit = () => {
    if (!horse || !race || duplicate) return;
    registerRace({ id: `registration-${horse.id}-${race.id}`, horseId: horse.id, raceId: race.id, submittedBy: currentUser.id, status: 'submitted', createdAt: new Date().toISOString() });
    setSubmitted(true);
  };

  return <div className="space-y-6 pb-12">
    <div><h2 className="mb-1 text-2xl font-bold tracking-tight text-gray-900">{t('Race registration')}</h2><p className="font-light text-gray-500">{t('Select an eligible, race-ready horse and an upcoming race.')}</p></div>
    {submitted && <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-700"><CheckCircle2 size={19} /> {t('Registration submitted successfully.')}</div>}
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <section className="rounded-2xl border border-gray-100 bg-white p-7 shadow-[0_2px_8px_rgba(5,96,69,0.05)]">
        <h3 className="mb-5 text-sm font-semibold text-gray-400">{t('Select horse')}</h3>
        <div className="space-y-2.5">{horses.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">{t('No eligible race-ready horses available.')}</p> : horses.map(item => <button type="button" key={item.id} onClick={() => { setSelectedHorseId(item.id); setSubmitted(false); }} className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition ${selectedHorseId === item.id ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><img src={item.avatar} alt={item.name} className="h-10 w-10 rounded-xl border border-gray-100 object-cover" /><div className="min-w-0 flex-1"><h4 className="truncate text-sm font-semibold text-gray-800">{item.name}</h4><p className="text-xs text-gray-400">{t('Aptitude')}: <span className="font-medium text-gray-600">{item.race_aptitude}</span></p></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">{item.raceReadiness}</span></button>)}</div>
      </section>
      <section className="rounded-2xl border border-gray-100 bg-white p-7 shadow-[0_2px_8px_rgba(5,96,69,0.05)]">
        <h3 className="mb-5 text-sm font-semibold text-gray-400">{t('Select race')}</h3>
        <div className="space-y-2.5">{upcomingRaces.map(item => <button type="button" key={item.id} onClick={() => { setSelectedRaceId(item.id); setSubmitted(false); }} className={`w-full rounded-xl border p-4 text-left transition ${selectedRaceId === item.id ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><div className="flex items-start justify-between"><div><h4 className="text-sm font-semibold text-gray-800">{item.name}</h4><div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-400"><span className="flex items-center gap-1"><Calendar size={12} /> {item.date}</span><span className="flex items-center gap-1"><MapPin size={12} /> {item.venue}</span></div><span className="mt-2 inline-block rounded bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500">{item.dist}m · {aptitudeForDistance(item.dist)}</span></div><Trophy size={18} className={selectedRaceId === item.id ? 'text-emerald-500' : 'text-gray-200'} /></div></button>)}</div>
        {horse && race && <div className={`mt-6 flex items-start gap-2.5 rounded-xl border p-3.5 ${matches ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}><AlertCircle size={18} className="mt-0.5 shrink-0" /><p className="text-sm">{matches ? t('Perfect match: horse aptitude aligns with race distance.') : `${t('Aptitude warning')}: ${horse.race_aptitude} → ${raceType}. ${t('Performance may be suboptimal.')}`}</p></div>}
        {duplicate && <p className="mt-4 text-sm font-medium text-amber-700">{t('This horse is already registered for this race.')}</p>}
        <button type="button" onClick={submit} disabled={!horse || !race || duplicate} className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">{t('Confirm registration')}</button>
      </section>
    </div>
  </div>;
};

function aptitudeForDistance(distance: number): RaceAptitude {
  if (distance <= 1400) return 'SPRINTER';
  if (distance <= 1800) return 'MILER';
  return 'STAYER';
}

export default RaceRegistration;
