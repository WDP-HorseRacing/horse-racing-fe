import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { ChevronLeft, Flame, Wheat, Save } from 'lucide-react';

const TrainerPlan = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const horse = useStore(state => state.horses.find(h => h.id === id));
  const savePlan = useStore(state => state.saveTrainingPlan);

  const [distance, setDistance] = useState('1600');
  const [workload, setWorkload] = useState<'Light' | 'Moderate' | 'Heavy'>('Moderate');
  const [surface, setSurface] = useState<'Turf' | 'Dirt' | 'Sand'>('Turf');
  const [energy, setEnergy] = useState(16);
  const [concentrate, setConcentrate] = useState(20);

  useEffect(() => {
    let baseMcal = 16;
    let distMultiplier = parseInt(distance) / 1000; 
    let workloadMulti = workload === 'Light' ? 1.2 : workload === 'Moderate' ? 1.5 : 2.0;
    let calculatedMcal = Math.round(baseMcal + (distMultiplier * workloadMulti * 5));
    setEnergy(calculatedMcal);
    if (calculatedMcal > 30) setConcentrate(55);
    else if (calculatedMcal > 24) setConcentrate(40);
    else setConcentrate(20);
  }, [distance, workload]);

  if (!horse) return <div className="text-center py-20 text-gray-400">Horse not found</div>;

  const handleSave = () => {
    savePlan({ horseId: horse.id, distance: `${distance}m`, workload, surface, energy_mcal: energy, concentrate_percentage: concentrate });
    navigate('/horses');
  };

  const buttonOption = (current: string, value: string, disabled = false) =>
    `flex-1 py-3 rounded-xl border font-medium text-sm transition-all duration-200 active:scale-[0.98] ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${
      current === value
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-100'
        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
    }`;

  return (
    <div className="space-y-6 pb-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors text-sm font-medium">
        <ChevronLeft size={16} /> Back to horses
      </button>

      {/* Horse Header */}
      <div className="flex items-center gap-5 bg-white p-5 rounded-2xl border border-gray-100" style={{ boxShadow: 'var(--shadow-card)' }}>
        <img src={horse.avatar} alt={horse.name} className="w-20 h-20 rounded-xl object-cover border border-gray-100" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">{horse.name}</h2>
          <p className="text-gray-500 text-sm mt-0.5">Phase: {horse.currentPhase} · Aptitude: {horse.race_aptitude}</p>
        </div>
        {horse.healthStatus === 'INJURED' && (
          <div className="ml-auto bg-red-50 text-red-600 px-4 py-2.5 rounded-xl border border-red-100 max-w-xs">
            <p className="font-semibold text-sm">Medical lock active</p>
            <p className="text-xs mt-0.5 text-red-500">Diet is locked by veterinarian. Heavy workload disabled.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training Parameters */}
        <div className="space-y-6 bg-white p-7 rounded-2xl border border-gray-100" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-4">Training parameters</h3>
          
          <div>
            <label className="block text-sm text-gray-500 font-medium mb-3">Distance</label>
            <div className="flex gap-2.5">
              {['800', '1200', '1600', '2400'].map(dist => (
                <button key={dist} onClick={() => setDistance(dist)} className={buttonOption(distance, dist)}>
                  {dist}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-500 font-medium mb-3">Workload intensity</label>
            <div className="flex gap-2.5">
              {['Light', 'Moderate', 'Heavy'].map(wl => (
                <button
                  key={wl}
                  disabled={horse.healthStatus === 'INJURED' && wl === 'Heavy'}
                  onClick={() => setWorkload(wl as any)}
                  className={buttonOption(workload, wl, horse.healthStatus === 'INJURED' && wl === 'Heavy')}
                >
                  {wl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-500 font-medium mb-3">Surface</label>
            <div className="flex gap-2.5">
              {['Turf', 'Dirt', 'Sand'].map(s => (
                <button key={s} onClick={() => setSurface(s as any)} className={buttonOption(surface, s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Nutrition Panel */}
        <div className="space-y-6 bg-white p-7 rounded-2xl border border-gray-100 relative overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="absolute top-0 right-0 p-8 opacity-[0.03]"><Flame size={120} /></div>
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-4 relative z-10">Dynamic nutrition</h3>
          
          <div className="relative z-10">
            <p className="text-sm text-gray-500 mb-2">Required energy (auto-calculated)</p>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-5xl font-bold text-amber-500 tracking-tighter tabular-nums">{energy}</span>
              <span className="text-lg text-gray-400 mb-1">Mcal / day</span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600 flex items-center gap-2"><Wheat size={14} className="text-emerald-500"/> Forage (hay)</span>
                  <span className="text-gray-500 tabular-nums">{100 - concentrate}%</span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${100 - concentrate}%` }} />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600 flex items-center gap-2"><Flame size={14} className="text-amber-500"/> Concentrate (grain)</span>
                  <span className="text-amber-500 font-semibold tabular-nums">{concentrate}%</span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${concentrate}%` }} />
                </div>
                {concentrate > 50 && (
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded-lg border border-amber-100">High starch diet required for this workload. Vet approval may be needed.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-7 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-200 shadow-sm shadow-emerald-600/20 active:scale-[0.98]"
        >
          <Save size={18} /> Save plan & generate diet
        </button>
      </div>
    </div>
  );
};

export default TrainerPlan;
