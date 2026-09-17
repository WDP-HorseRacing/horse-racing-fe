import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore, type Ownership } from '../store/store';
import { ArrowLeft, Users, AlertTriangle, Plus, Save, Trash2 } from 'lucide-react';
import { T } from '../i18n/T';

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
  
  if (!horse) return <div className="p-8 text-gray-400"><T>Horse not found</T></div>;

  const totalPercentage = localOwnerships.reduce((sum, o) => sum + o.percentage, 0);
  const isTotalValid = totalPercentage === 100;
  const canEdit = currentUser?.role === 'CLUB_MANAGER';

  const handlePercentageChange = (ownerId: string, newVal: string) => {
    let val = parseFloat(newVal);
    if (isNaN(val)) val = 0;
    setLocalOwnerships(prev => prev.map(o => o.ownerId === ownerId ? { ...o, percentage: val } : o));
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

  const barColors = ['bg-emerald-500', 'bg-sky-500', 'bg-fuchsia-500', 'bg-amber-500', 'bg-cyan-500'];

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-400 hover:text-gray-600 transition-colors text-sm font-medium mb-6">
        <ArrowLeft size={16} className="mr-2" /> Back to profile
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-gray-100">
          <img src={horse.avatar} alt={horse.name} className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900"><T>Syndicate allocation</T></h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage ownership percentages for {horse.name}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-7" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium text-gray-600"><T>Total allocation</T></span>
            <span className={`text-2xl font-bold tabular-nums ${isTotalValid ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalPercentage}%
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            {localOwnerships.map((o, idx) => (
              <div
                key={o.ownerId}
                className={`h-full ${barColors[idx % barColors.length]} transition-all duration-500`}
                style={{ width: `${Math.min(100, o.percentage)}%` }}
                title={`${users.find(u => u.id === o.ownerId)?.name}: ${o.percentage}%`}
              />
            ))}
          </div>
          {!isTotalValid && (
            <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-100">
              <AlertTriangle size={16} />
              Total percentage must equal exactly 100%. Currently at {totalPercentage}%.
            </div>
          )}
        </div>

        {/* Owners List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Users size={16} className="text-emerald-500" /> Current owners
          </h2>
          
          {localOwnerships.length === 0 ? (
            <p className="text-gray-400 italic text-sm py-4"><T>No owners assigned.</T></p>
          ) : (
            localOwnerships.map((ownership) => {
              const user = users.find(u => u.id === ownership.ownerId);
              return (
                <div key={ownership.ownerId} className="flex items-center gap-4 bg-gray-50 border border-gray-100 p-4 rounded-xl group">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 overflow-hidden shrink-0">
                    <img src={user?.avatar} alt={user?.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-400">{user?.role?.replace('_', ' ')}</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input 
                        type="number" min="0" max="100"
                        disabled={!canEdit}
                        value={ownership.percentage}
                        onChange={(e) => handlePercentageChange(ownership.ownerId, e.target.value)}
                        className="w-20 bg-white border border-gray-200 text-gray-900 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:opacity-50 text-right pr-7 text-sm tabular-nums"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    </div>
                    {canEdit && (
                      <button onClick={() => removeOwner(ownership.ownerId)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 size={16} />
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
          <div className="mt-8 pt-8 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-3"><T>Add owner to syndicate</T></h3>
            <div className="flex gap-3">
              <select 
                id="add-owner-select"
                className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 text-sm"
                defaultValue=""
              >
                <option value="" disabled><T>Select a user...</T></option>
                {availableUsers.map(u => (<option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>))}
              </select>
              <button 
                onClick={() => {
                  const select = document.getElementById('add-owner-select') as HTMLSelectElement;
                  if (select.value) addOwner(select.value);
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 rounded-xl font-medium transition-all text-sm flex items-center gap-2 active:scale-[0.98]"
              >
                <Plus size={16} /> Add
              </button>
            </div>

            <div className="mt-10 flex justify-end">
              <button 
                onClick={handleSave}
                disabled={!isTotalValid}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400 text-white px-7 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-sm shadow-emerald-600/20 disabled:shadow-none active:scale-[0.98]"
              >
                <Save size={16} /> Save allocation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HorseOwners;