import React, { useState } from 'react';
import { useStore } from '../store/store';
import { useNavigate, Link } from 'react-router-dom';
import { Settings2, Activity, Plus, Filter } from 'lucide-react';
import { motion } from 'motion/react';

const TrainerHorses = () => {
  const navigate = useNavigate();
  const horses = useStore(state => state.horses);
  const currentUser = useStore(state => state.currentUser);
  const [filter, setFilter] = useState('ALL');

  const filteredHorses = horses.filter(h => {
    if (filter === 'ALL') return true;
    return h.healthStatus === filter || h.lifecycleStatus === filter;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">My Stable</h2>
          <p className="text-slate-400">Manage horse profiles, training plans, and medical status.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="bg-[#121212] border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent text-slate-300 text-sm focus:outline-none appearance-none cursor-pointer pr-4"
            >
              <option value="ALL">All Status</option>
              <option value="ELIGIBLE">Eligible</option>
              <option value="INJURED">Injured</option>
              <option value="UNDER_OBSERVATION">Under Monitor</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>
          
          {currentUser?.role === 'CLUB_MANAGER' && (
            <Link 
              to="/horses/new"
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              <Plus size={16} /> Register Horse
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredHorses.map((horse, idx) => (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            key={horse.id} 
            className="bg-[#121212] border border-slate-800 rounded-3xl overflow-hidden flex flex-col md:flex-row hover:border-slate-700 transition-colors shadow-xl"
          >
            <div 
              className="md:w-2/5 h-56 md:h-auto relative cursor-pointer"
              onClick={() => navigate(`/horses/${horse.id}`)}
            >
              <img src={horse.avatar} alt={horse.name} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#121212] md:from-transparent md:bg-gradient-to-r to-transparent"></div>
            </div>
            
            <div className="flex-1 p-6 flex flex-col justify-between relative z-10">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <Link to={`/horses/${horse.id}`} className="text-xl font-bold text-white hover:text-emerald-400 transition-colors">
                    {horse.name}
                  </Link>
                  <span className="px-2.5 py-1 bg-slate-800/50 rounded-lg text-xs font-semibold text-slate-300 border border-slate-700/50">
                    {horse.race_aptitude}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-3 mb-6 mt-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Age & Gender</p>
                    <p className="text-sm font-medium text-slate-300">{horse.age}yo {horse.gender.toLowerCase()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fitness</p>
                    <p className="text-sm font-medium text-emerald-400">{horse.fitness}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Health</p>
                    <p className={`text-sm font-medium ${horse.healthStatus === 'INJURED' || horse.healthStatus === 'QUARANTINED' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {horse.healthStatus.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => navigate(`/plan/${horse.id}`)}
                  className="flex-1 bg-white hover:bg-slate-200 text-black py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Settings2 size={16} />
                  Plan
                </button>
                {horse.healthStatus === 'ELIGIBLE' && horse.lifecycleStatus === 'ACTIVE' && (
                  <button 
                    onClick={() => navigate(`/live-training/${horse.id}`)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Activity size={16} />
                    Live
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default TrainerHorses;