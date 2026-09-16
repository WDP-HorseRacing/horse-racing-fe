import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore, type Ownership } from '../store/store';
import { motion } from 'motion/react';
import { ArrowLeft, Users, AlertTriangle, Plus, Save, Trash2 } from 'lucide-react';

const HorseOwners = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const horses = useStore(state => state.horses);
  const users = useStore(state => state.users);
  const ownerships = useStore(state => state.ownerships);
  const updateOwnerships = useStore(state => state.updateOwnerships);
  const currentUser = useStore(state => state.currentUser);
  
  const horse = horses.find(h => h.id === id);
  const currentHorseOwnerships = ownerships.filter(o => o.horseId === id);
  
  const [localOwnerships, setLocalOwnerships] = useState<Ownership[]>(currentHorseOwnerships);
  
  if (!horse) return <div className="p-8 text-white">Horse not found</div>;

  const totalPercentage = localOwnerships.reduce((sum, o) => sum + o.percentage, 0);
  const isTotalValid = totalPercentage === 100;
  const canEdit = currentUser?.role === 'CLUB_MANAGER';

  const handlePercentageChange = (ownerId: string, newVal: string) => {
    let val = parseFloat(newVal);
    if (isNaN(val)) val = 0;
    
    setLocalOwnerships(prev => prev.map(o => 
      o.ownerId === ownerId ? { ...o, percentage: val } : o
    ));
  };

  const removeOwner = (ownerId: string) => {
    setLocalOwnerships(prev => prev.filter(o => o.ownerId !== ownerId));
  };

  const addOwner = (ownerId: string) => {
    if (localOwnerships.some(o => o.ownerId === ownerId)) return;
    setLocalOwnerships(prev => [...prev, { horseId: horse.id, ownerId, percentage: 0 }]);
  };

  const handleSave = () => {
    if (!isTotalValid) return;
    updateOwnerships(horse.id, localOwnerships);
    navigate(-1);
  };

  const availableUsers = users.filter(u => !localOwnerships.some(o => o.ownerId === u.id));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto pb-20"
    >
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-slate-400 hover:text-white transition-colors text-sm font-medium mb-6"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Profile
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-700">
          <img src={horse.avatar} alt={horse.name} className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Syndicate Allocation
          </h1>
          <p className="text-slate-400 mt-1">Manage ownership percentages for {horse.name}</p>
        </div>
      </div>

      <div className="bg-[#121212] border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
        {/* Progress Bar Header */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium text-slate-300">Total Allocation</span>
            <span className={`text-2xl font-bold ${isTotalValid ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalPercentage}%
            </span>
          </div>
          <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
            {localOwnerships.map((o, idx) => {
              const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-fuchsia-500', 'bg-amber-500', 'bg-cyan-500'];
              return (
                <motion.div 
                  key={o.ownerId}
                  className={`h-full ${colors[idx % colors.length]}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, o.percentage)}%` }}
                  transition={{ duration: 0.5 }}
                  title={`${users.find(u => u.id === o.ownerId)?.name}: ${o.percentage}%`}
                />
              );
            })}
          </div>
          {!isTotalValid && (
            <div className="mt-3 flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">
              <AlertTriangle size={16} />
              Total percentage must equal exactly 100%. Currently at {totalPercentage}%.
            </div>
          )}
        </div>

        {/* Owners List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users size={18} className="text-emerald-400" /> Current Owners
          </h2>
          
          {localOwnerships.length === 0 ? (
            <p className="text-slate-500 italic">No owners assigned.</p>
          ) : (
            localOwnerships.map((ownership, idx) => {
              const user = users.find(u => u.id === ownership.ownerId);
              return (
                <div key={ownership.ownerId} className="flex items-center gap-4 bg-[#0a0a0a] border border-slate-800 p-4 rounded-2xl group">
                  <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden shrink-0">
                    <img src={user?.avatar} alt={user?.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-100 font-medium">{user?.name}</p>
                    <p className="text-slate-500 text-xs">{user?.role.replace('_', ' ')}</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        disabled={!canEdit}
                        value={ownership.percentage}
                        onChange={(e) => handlePercentageChange(ownership.ownerId, e.target.value)}
                        className="w-24 bg-[#121212] border border-slate-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 text-right pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                    {canEdit && (
                      <button 
                        onClick={() => removeOwner(ownership.ownerId)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Owner & Save */}
        {canEdit && (
          <div className="mt-8 pt-8 border-t border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Add Owner to Syndicate</h3>
            <div className="flex gap-4">
              <select 
                id="add-owner-select"
                className="flex-1 bg-[#0a0a0a] border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
                defaultValue=""
              >
                <option value="" disabled>Select a user...</option>
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
                ))}
              </select>
              <button 
                onClick={() => {
                  const select = document.getElementById('add-owner-select') as HTMLSelectElement;
                  if (select.value) addOwner(select.value);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <Plus size={18} /> Add
              </button>
            </div>

            <div className="mt-12 flex justify-end">
              <button 
                onClick={handleSave}
                disabled={!isTotalValid}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:shadow-none"
              >
                <Save size={18} /> Save Allocation
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default HorseOwners;