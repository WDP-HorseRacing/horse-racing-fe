import React from 'react';
import { useStore } from '../store/store';
import { Activity, AlertCircle, CheckCircle2, Navigation, Flag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const horses = useStore(state => state.horses);
  
  const attentionRequired = horses.filter(h => h.status === 'MONITOR' || h.status === 'INJURED' || h.status === 'LOCKED');
  const trainingToday = horses.filter(h => h.status === 'TRAINING' || h.status === 'FIT');
  const raceReady = horses.filter(h => h.raceReadiness === 'Peak' || h.raceReadiness === 'High');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Good morning, Trainer</h2>
          <p className="text-slate-400">Track condition is Optimal. 12 horses scheduled today.</p>
        </div>
      </div>

      {/* Bento Box Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Widget: Stable Fitness */}
        <div className="md:col-span-2 bg-[#161616] border border-slate-800 rounded-2xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 transition-opacity group-hover:opacity-100 opacity-50"></div>
          <h3 className="text-sm font-medium text-slate-400 mb-6 uppercase tracking-wider">Stable Fitness Score</h3>
          <div className="flex items-end gap-6">
            <span className="text-7xl font-bold text-white tracking-tighter">78<span className="text-emerald-500 text-5xl">%</span></span>
            <div className="flex-1 h-12 flex items-end">
              <svg viewBox="0 0 100 30" className="w-full h-full preserve-3d">
                <path d="M0,25 L20,20 L40,28 L60,15 L80,22 L100,5" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Quick Stats Column */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#161616] border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-white">{trainingToday.length}</p>
              <p className="text-sm text-slate-400 mt-1">Training Today</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Activity className="text-emerald-400" />
            </div>
          </div>
          <div className="bg-[#161616] border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-white">{raceReady.length}</p>
              <p className="text-sm text-slate-400 mt-1">Race Ready</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Flag className="text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Requires Attention - Horizontal Scroll / Masonry style */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-amber-500" />
          Requires Attention
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {attentionRequired.map(horse => (
            <div 
              key={horse.id} 
              onClick={() => navigate(`/live-training/${horse.id}`)}
              className="bg-[#161616] border border-slate-800 hover:border-slate-600 rounded-xl p-5 flex items-center gap-4 cursor-pointer transition-all hover:translate-y-[-2px] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
            >
              <img src={horse.avatar} alt={horse.name} className="w-14 h-14 rounded-full object-cover border-2 border-slate-800" />
              <div className="flex-1">
                <h4 className="text-base font-semibold text-white">{horse.name}</h4>
                <p className="text-sm text-slate-400">{horse.currentPhase}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                horse.healthStatus === 'INJURED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {horse.healthStatus}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

