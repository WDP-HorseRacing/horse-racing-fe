import { useState } from 'react';
import { useStore } from '../store/store';
import { AlertCircle, Trophy, Calendar, MapPin } from 'lucide-react';

const RaceRegistration = () => {
  const horses = useStore(state => state.horses.filter(h => h.raceReadiness === 'Peak' || h.raceReadiness === 'High'));
  const [selectedHorse, setSelectedHorse] = useState<string>('');
  const [selectedRaceDist, setSelectedRaceDist] = useState<number>(0);

  const horse = horses.find(h => h.id === selectedHorse);

  const checkAptitudeMatch = () => {
    if (!horse || !selectedRaceDist) return null;
    let raceType = '';
    if (selectedRaceDist <= 1600) raceType = 'SPRINTER';
    else if (selectedRaceDist <= 1800) raceType = 'MILER';
    else raceType = 'STAYER';

    if (horse.race_aptitude === raceType) {
      return { match: true, text: 'Perfect match: Horse aptitude aligns with race distance.' };
    }
    return { match: false, text: `Warning: This horse is a ${horse.race_aptitude}, but this is a ${raceType} race. Performance may be suboptimal.` };
  };

  const aptitudeStatus = checkAptitudeMatch();

  const races = [
    { id: 'r1', name: 'Spring Sprint Cup', dist: 1200, date: 'Oct 15, 2026', venue: 'Sha Tin Racecourse' },
    { id: 'r2', name: 'Classic Mile Stakes', dist: 1600, date: 'Nov 3, 2026', venue: 'Happy Valley' },
    { id: 'r3', name: 'Grand Endurance Derby', dist: 2400, date: 'Dec 12, 2026', venue: 'Sha Tin Racecourse' },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Race registration</h2>
        <p className="text-gray-500 font-light">Select a peak-condition horse and register for upcoming races.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Select Horse */}
        <div className="bg-white p-7 rounded-2xl border border-gray-100" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-semibold text-gray-400 mb-5">Select horse</h3>
          <div className="space-y-2.5">
            {horses.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">No race-ready horses available.</p>
            ) : (
              horses.map(h => (
                <div 
                  key={h.id}
                  onClick={() => setSelectedHorse(h.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3 active:scale-[0.99] ${
                    selectedHorse === h.id 
                      ? 'bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-100' 
                      : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <img src={h.avatar} alt={h.name} className="w-10 h-10 rounded-xl object-cover border border-gray-100" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-800 truncate">{h.name}</h4>
                    <p className="text-xs text-gray-400">Aptitude: <span className="text-gray-600 font-medium">{h.race_aptitude}</span></p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                    h.raceReadiness === 'Peak' ? 'text-emerald-600 bg-emerald-50' : 'text-sky-600 bg-sky-50'
                  }`}>
                    {h.raceReadiness}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Select Race */}
        <div className="bg-white p-7 rounded-2xl border border-gray-100" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-semibold text-gray-400 mb-5">Select race</h3>
          <div className="space-y-2.5">
            {races.map(r => (
              <div 
                key={r.id}
                onClick={() => setSelectedRaceDist(r.dist)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 active:scale-[0.99] ${
                  selectedRaceDist === r.dist 
                    ? 'bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-100' 
                    : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">{r.name}</h4>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {r.date}</span>
                      <span className="flex items-center gap-1"><MapPin size={12} /> {r.venue}</span>
                    </div>
                    <span className="inline-block mt-2 text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{r.dist}m</span>
                  </div>
                  <Trophy size={18} className={selectedRaceDist === r.dist ? 'text-emerald-500' : 'text-gray-200'} />
                </div>
              </div>
            ))}
          </div>

          {aptitudeStatus && (
            <div className={`mt-6 p-3.5 rounded-xl border flex items-start gap-2.5 ${
              aptitudeStatus.match ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-700'
            }`}>
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm">{aptitudeStatus.text}</p>
            </div>
          )}

          <button 
            disabled={!selectedHorse || !selectedRaceDist}
            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm shadow-emerald-600/20 active:scale-[0.98] disabled:active:scale-100"
          >
            Confirm registration
          </button>
        </div>
      </div>
    </div>
  );
};

export default RaceRegistration;
