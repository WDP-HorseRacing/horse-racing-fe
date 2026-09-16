import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useStore, type Horse, type HorseGender, type RaceAptitude, type HealthStatus, type LifecycleStatus } from '../store/store';
import { ArrowLeft, Save, AlertTriangle, Info, Weight, Heart } from 'lucide-react';
import { motion } from 'motion/react';

const HorseForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const horses = useStore(state => state.horses);
  const currentUser = useStore(state => state.currentUser);
  const createHorse = useStore(state => state.createHorse);
  const updateHorse = useStore(state => state.updateHorse);
  const deleteHorse = useStore(state => state.deleteHorse);

  const isEditing = !!id;
  const existingHorse = isEditing ? horses.find(h => h.id === id) : null;
  const isManager = currentUser?.role === 'CLUB_MANAGER';
  const isTrainer = currentUser?.role === 'HEAD_TRAINER';
  const canEditProfile = isManager; // Manager can edit everything
  const canEditPerformance = isManager || isTrainer; // Trainer can only edit weight & aptitude

  const [formData, setFormData] = useState<Partial<Horse>>({
    name: '',
    dateOfBirth: '',
    gender: 'MALE',
    breed: 'Thoroughbred',
    color: '',
    microchipId: '',
    avatar: 'https://images.unsplash.com/photo-1598974357801-cbca100e65d3?q=80&w=200&h=200&auto=format&fit=crop',
    sireId: '',
    damId: '',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'ACTIVE',
    weight: 500,
    race_aptitude: 'MILER'
  });

  useEffect(() => {
    if (existingHorse) {
      setFormData(existingHorse);
    }
  }, [existingHorse]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && id) {
      updateHorse(id, formData);
      navigate(`/horses/${id}`);
    } else {
      const newId = `h${Date.now()}`;
      createHorse({
        ...formData,
        id: newId,
        fitness: 100,
        currentPhase: 'Base',
        lastTraining: 'N/A',
        age: 3,
        raceReadiness: 'Low'
      } as Horse);
      navigate(`/horses/${newId}`);
    }
  };

  const handleDelete = () => {
    if (id && confirm("Are you sure you want to softly delete this horse? It will be removed from the active stable.")) {
      // simulate soft delete check
      if (existingHorse?.healthStatus === 'ELIGIBLE' && existingHorse?.lifecycleStatus === 'ACTIVE') {
         // In reality backend handles this.
         deleteHorse(id);
         navigate('/horses');
      } else {
         alert("Cannot delete horse with active locks or injuries. Contact Vet.");
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto pb-20">
      <Link to={isEditing ? `/horses/${id}` : '/horses'} className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={20} className="mr-2" /> Back
      </Link>

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{isEditing ? 'Edit Horse Profile' : 'Register New Horse'}</h1>
          <p className="text-slate-400">Manage identity, lineage, and basic metrics.</p>
        </div>
      </div>

      {!canEditProfile && (
        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-start">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-amber-500 font-semibold mb-1">Restricted Access</h4>
            <p className="text-slate-300 text-sm">Your role ({currentUser?.role}) only permits editing performance metrics (Weight & Aptitude). Identity fields are locked.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Identity */}
        <div className="bg-[#121212] border border-slate-800 rounded-3xl p-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Info size={20} className="text-emerald-500" /> Identity Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Registered Name</label>
              <input 
                type="text" 
                required
                disabled={!canEditProfile}
                value={formData.name || ''}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Microchip ID</label>
              <input 
                type="text" 
                required
                disabled={!canEditProfile}
                value={formData.microchipId || ''}
                onChange={e => setFormData({...formData, microchipId: e.target.value})}
                className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Date of Birth</label>
              <input 
                type="date" 
                required
                disabled={!canEditProfile}
                value={formData.dateOfBirth || ''}
                onChange={e => setFormData({...formData, dateOfBirth: e.target.value})}
                className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 [color-scheme:dark]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Gender</label>
                <select 
                  disabled={!canEditProfile}
                  value={formData.gender || 'MALE'}
                  onChange={e => setFormData({...formData, gender: e.target.value as HorseGender})}
                  className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="GELDING">Gelding</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Color</label>
                <input 
                  type="text" 
                  disabled={!canEditProfile}
                  value={formData.color || ''}
                  onChange={e => setFormData({...formData, color: e.target.value})}
                  className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Lineage */}
        <div className="bg-[#121212] border border-slate-800 rounded-3xl p-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Heart size={20} className="text-rose-500" /> Lineage (Sire & Dam)
          </h3>
          <p className="text-sm text-slate-500 mb-6">Note: Parents must belong to the same racing club due to tenant isolation rules.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Sire (Father)</label>
              <select 
                disabled={!canEditProfile}
                value={formData.sireId || ''}
                onChange={e => setFormData({...formData, sireId: e.target.value})}
                className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                <option value="">Unknown</option>
                {horses.filter(h => h.gender !== 'FEMALE' && h.id !== id).map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Dam (Mother)</label>
              <select 
                disabled={!canEditProfile}
                value={formData.damId || ''}
                onChange={e => setFormData({...formData, damId: e.target.value})}
                className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                <option value="">Unknown</option>
                {horses.filter(h => h.gender === 'FEMALE' && h.id !== id).map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Performance & Status */}
        <div className="bg-[#121212] border border-slate-800 rounded-3xl p-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Weight size={20} className="text-blue-500" /> Performance & Status
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Weight (kg)</label>
              <input 
                type="number" 
                disabled={!canEditPerformance}
                value={formData.weight || 0}
                onChange={e => setFormData({...formData, weight: parseInt(e.target.value)})}
                className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Race Aptitude</label>
              <select 
                disabled={!canEditPerformance}
                value={formData.race_aptitude || 'MILER'}
                onChange={e => setFormData({...formData, race_aptitude: e.target.value as RaceAptitude})}
                className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                <option value="SPRINTER">Sprinter (1000m - 1400m)</option>
                <option value="MILER">Miler (1600m)</option>
                <option value="STAYER">Stayer (2000m+)</option>
              </select>
            </div>

            {isManager && (
               <>
                 <div className="space-y-2">
                   <label className="text-sm font-medium text-slate-400">Health Status</label>
                   <select 
                     value={formData.healthStatus || 'ELIGIBLE'}
                     onChange={e => setFormData({...formData, healthStatus: e.target.value as HealthStatus})}
                     className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                   >
                     <option value="ELIGIBLE">Eligible</option>
                     <option value="UNDER_OBSERVATION">Under Observation</option>
                     <option value="INJURED">Injured</option>
                     <option value="QUARANTINED">Quarantined</option>
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-medium text-slate-400">Lifecycle Status</label>
                   <select 
                     value={formData.lifecycleStatus || 'ACTIVE'}
                     onChange={e => setFormData({...formData, lifecycleStatus: e.target.value as LifecycleStatus})}
                     className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                   >
                     <option value="ACTIVE">Active</option>
                     <option value="RETIRED">Retired</option>
                     <option value="TRANSFERRED">Transferred</option>
                   </select>
                 </div>
               </>
            )}
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-800 justify-between">
          {isEditing && isManager ? (
            <button 
              type="button"
              onClick={handleDelete}
              className="px-6 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl font-bold transition-all"
            >
              Soft Delete
            </button>
          ) : <div></div>}
          
          <div className="flex gap-4">
            <button 
              type="button" 
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-[#1a1a1a] hover:bg-[#252525] text-white rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2"
            >
              <Save size={20} />
              {isEditing ? 'Save Changes' : 'Register Horse'}
            </button>
          </div>
        </div>
      </form>
    </motion.div>
  );
};

export default HorseForm;