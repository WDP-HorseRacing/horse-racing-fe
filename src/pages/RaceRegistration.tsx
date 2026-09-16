import React, { useState } from 'react';
import { useStore } from '../store/store';
import { AlertCircle, Trophy } from 'lucide-react';

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
      return { match: true, text: 'Perfect Match: Horse aptitude aligns with race distance.' };
    }
    
    return { match: false, text: `Warning: This horse is a ${horse.race_aptitude}, but this is a ${raceType} race. Performance may be suboptimal.` };
  };

  const aptitudeStatus = checkAptitudeMatch();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Race Registration</h2>
        <p className="text-slate-400">Select a peak-condition horse and register for upcoming races.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[#161616] p-8 rounded-2xl border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-6">1. Select Horse</h3>
          <div className="space-y-3">
            {horses.map(h => (
              <div 
                key={h.id}
                onClick={() => setSelectedHorse(h.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4 ${
                  selectedHorse === h.id 
                    ? 'bg-emerald-500/10 border-emerald-500/50' 
                    : 'bg-[#1a1a1a] border-slate-800 hover:border-slate-600'
                }`}
              >
                <img src={h.avatar} alt={h.name} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-1">
                  <h4 className="text-white font-medium">{h.name}</h4>
                  <p className="text-xs text-slate-400">Aptitude: <span className="text-slate-300">{h.race_aptitude}</span></p>
                </div>
                <div className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">
                  {h.raceReadiness}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#161616] p-8 rounded-2xl border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-6">2. Select Race</h3>
          <div className="space-y-3">
            {[
              { id: 'r1', name: 'Spring Sprint Cup', dist: 1200 },
              { id: 'r2', name: 'Classic Mile Stakes', dist: 1600 },
              { id: 'r3', name: 'Grand Endurance Derby', dist: 2400 }
            ].map(r => (
              <div 
                key={r.id}
                onClick={() => setSelectedRaceDist(r.dist)}
                className={`p-5 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${
                  selectedRaceDist === r.dist 
                    ? 'bg-emerald-500/10 border-emerald-500/50' 
                    : 'bg-[#1a1a1a] border-slate-800 hover:border-slate-600'
                }`}
              >
                <div>
                  <h4 className="text-white font-medium">{r.name}</h4>
                  <p className="text-sm text-slate-400 mt-1">{r.dist}m</p>
                </div>
                <Trophy size={20} className={selectedRaceDist === r.dist ? 'text-emerald-400' : 'text-slate-600'} />
              </div>
            ))}
          </div>

          {aptitudeStatus && (
            <div className={`mt-8 p-4 rounded-xl border flex items-start gap-3 ${
              aptitudeStatus.match ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm">{aptitudeStatus.text}</p>
            </div>
          )}

          <button 
            disabled={!selectedHorse || !selectedRaceDist}
            className="w-full mt-8 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-slate-950 py-3 rounded-xl font-bold transition-all"
          >
            Confirm Registration
          </button>
        </div>
      </div>
    </div>
  );
};

export default RaceRegistration;
