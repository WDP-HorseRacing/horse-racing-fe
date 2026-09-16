import React, { useState, useEffect } from 'react';
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

  // Dynamic Nutrition Logic
  const [energy, setEnergy] = useState(16);
  const [concentrate, setConcentrate] = useState(20);

  useEffect(() => {
    // Basic baseline for resting horse is 16 Mcal
    let baseMcal = 16;
    let distMultiplier = parseInt(distance) / 1000; 
    let workloadMulti = workload === 'Light' ? 1.2 : workload === 'Moderate' ? 1.5 : 2.0;
    
    let calculatedMcal = Math.round(baseMcal + (distMultiplier * workloadMulti * 5));
    setEnergy(calculatedMcal);
    
    // Concentrate (Grain) % goes up as Energy demand goes up
    if (calculatedMcal > 30) setConcentrate(55);
    else if (calculatedMcal > 24) setConcentrate(40);
    else setConcentrate(20);
  }, [distance, workload]);

  if (!horse) return <div>Horse not found</div>;

  const handleSave = () => {
    savePlan({
      horseId: horse.id,
      distance: `${distance}m`,
      workload,
      surface,
      energy_mcal: energy,
      concentrate_percentage: concentrate
    });
    navigate('/horses');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
        <ChevronLeft size={16} /> Back to Horses
      </button>

      <div className="flex items-center gap-6 bg-[#161616] p-6 rounded-2xl border border-slate-800">
        <img src={horse.avatar} alt={horse.name} className="w-24 h-24 rounded-xl object-cover" />
        <div>
          <h2 className="text-2xl font-bold text-white">{horse.name}</h2>
          <p className="text-slate-400 mt-1">Phase: {horse.currentPhase} • Aptitude: {horse.race_aptitude}</p>
        </div>
        {horse.healthStatus === 'INJURED' && (
          <div className="ml-auto bg-rose-500/10 text-rose-400 px-4 py-2 rounded-lg border border-rose-500/20 max-w-xs">
            <p className="font-semibold text-sm">Medical Lock Active</p>
            <p className="text-xs mt-1">Diet is locked by Veterinarian. Heavy workload disabled.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Training Parameters */}
        <div className="space-y-6 bg-[#161616] p-8 rounded-2xl border border-slate-800">
          <h3 className="text-xl font-semibold text-white border-b border-slate-800 pb-4">Training Parameters</h3>
          
          <div>
            <label className="block text-sm text-slate-400 mb-3">Distance</label>
            <div className="flex gap-3">
              {['800', '1200', '1600', '2400'].map(dist => (
                <button
                  key={dist}
                  onClick={() => setDistance(dist)}
                  className={`flex-1 py-3 rounded-xl border font-medium text-sm transition-all ${
                    distance === dist 
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                      : 'bg-[#1a1a1a] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {dist}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-3">Workload Intensity</label>
            <div className="flex gap-3">
              {['Light', 'Moderate', 'Heavy'].map(wl => (
                <button
                  key={wl}
                  disabled={horse.healthStatus === 'INJURED' && wl === 'Heavy'}
                  onClick={() => setWorkload(wl as any)}
                  className={`flex-1 py-3 rounded-xl border font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    workload === wl 
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                      : 'bg-[#1a1a1a] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {wl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Nutrition Panel */}
        <div className="space-y-6 bg-[#161616] p-8 rounded-2xl border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Flame size={120} />
          </div>
          <h3 className="text-xl font-semibold text-white border-b border-slate-800 pb-4 relative z-10">Dynamic Nutrition</h3>
          
          <div className="relative z-10">
            <p className="text-sm text-slate-400 mb-2">Required Energy (Auto-calculated)</p>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-5xl font-bold text-amber-400 tracking-tighter">{energy}</span>
              <span className="text-lg text-slate-500 mb-1">Mcal / day</span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300 flex items-center gap-2"><Wheat size={14} className="text-emerald-400"/> Forage (Cỏ khô)</span>
                  <span className="text-slate-400">{100 - concentrate}%</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${100 - concentrate}%` }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300 flex items-center gap-2"><Flame size={14} className="text-amber-400"/> Concentrate (Tinh bột)</span>
                  <span className="text-amber-400">{concentrate}%</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${concentrate}%` }}></div>
                </div>
                {concentrate > 50 && (
                  <p className="text-xs text-amber-500 mt-2">High starch diet required for this workload. Vet approval may be needed.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
        >
          <Save size={18} /> Save Plan & Generate Diet
        </button>
      </div>
    </div>
  );
};

export default TrainerPlan;
