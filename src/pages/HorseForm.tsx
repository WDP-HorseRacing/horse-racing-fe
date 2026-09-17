import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useStore, type Horse, type HorseGender, type RaceAptitude, type HealthStatus, type LifecycleStatus } from '../store/store';
import { ArrowLeft, Save, AlertTriangle, Info, Weight, Heart } from 'lucide-react';

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
  const canEditProfile = isManager;
  const canEditPerformance = isManager || isTrainer;

  const [formData, setFormData] = useState<Partial<Horse>>({
    name: '', dateOfBirth: '', gender: 'MALE', breed: 'Thoroughbred', color: '', microchipId: '',
    avatar: 'https://images.unsplash.com/photo-1598974357801-cbca100e65d3?q=80&w=200&h=200&auto=format&fit=crop',
    sireId: '', damId: '', healthStatus: 'ELIGIBLE', lifecycleStatus: 'ACTIVE', weight: 500, race_aptitude: 'MILER'
  });

  useEffect(() => {
    if (existingHorse) setFormData(existingHorse);
  }, [existingHorse]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && id) {
      updateHorse(id, formData);
      navigate(`/horses/${id}`);
    } else {
      const newId = `h${Date.now()}`;
      createHorse({ ...formData, id: newId, fitness: 100, currentPhase: 'Base', lastTraining: 'N/A', age: 3, raceReadiness: 'Low' } as Horse);
      navigate(`/horses/${newId}`);
    }
  };

  const handleDelete = () => {
    if (id && confirm("Are you sure you want to softly delete this horse? It will be removed from the active stable.")) {
      if (existingHorse?.healthStatus === 'ELIGIBLE' && existingHorse?.lifecycleStatus === 'ACTIVE') {
        deleteHorse(id);
        navigate('/horses');
      } else {
        alert("Cannot delete horse with active locks or injuries. Contact Vet.");
      }
    }
  };

  const inputClasses = "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all disabled:opacity-50 disabled:bg-gray-50 placeholder:text-gray-300";
  const labelClasses = "text-sm font-medium text-gray-500";

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <Link to={isEditing ? `/horses/${id}` : '/horses'} className="inline-flex items-center text-gray-400 hover:text-gray-600 mb-6 transition-colors text-sm font-medium">
        <ArrowLeft size={18} className="mr-2" /> Back
      </Link>

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{isEditing ? 'Edit horse profile' : 'Register new horse'}</h1>
          <p className="text-gray-500 font-light">Manage identity, lineage, and basic metrics.</p>
        </div>
      </div>

      {!canEditProfile && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 items-start">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="text-amber-700 font-semibold text-sm mb-0.5">Restricted access</h4>
            <p className="text-gray-600 text-sm">Your role ({currentUser?.role?.replace('_', ' ')}) only permits editing performance metrics (weight & aptitude). Identity fields are locked.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Identity */}
        <div className="bg-white border border-gray-100 rounded-2xl p-7" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Info size={18} className="text-emerald-500" /> Identity information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className={labelClasses}>Registered name</label>
              <input type="text" required disabled={!canEditProfile} value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClasses} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>Microchip ID</label>
              <input type="text" required disabled={!canEditProfile} value={formData.microchipId || ''} onChange={e => setFormData({...formData, microchipId: e.target.value})} className={inputClasses} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>Date of birth</label>
              <input type="date" required disabled={!canEditProfile} value={formData.dateOfBirth || ''} onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} className={inputClasses} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClasses}>Gender</label>
                <select disabled={!canEditProfile} value={formData.gender || 'MALE'} onChange={e => setFormData({...formData, gender: e.target.value as HorseGender})} className={inputClasses}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="GELDING">Gelding</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses}>Color</label>
                <input type="text" disabled={!canEditProfile} value={formData.color || ''} onChange={e => setFormData({...formData, color: e.target.value})} className={inputClasses} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Lineage */}
        <div className="bg-white border border-gray-100 rounded-2xl p-7" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Heart size={18} className="text-rose-400" /> Lineage (sire & dam)
          </h3>
          <p className="text-sm text-gray-400 mb-6">Parents must belong to the same racing club due to tenant isolation rules.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className={labelClasses}>Sire (father)</label>
              <select disabled={!canEditProfile} value={formData.sireId || ''} onChange={e => setFormData({...formData, sireId: e.target.value})} className={inputClasses}>
                <option value="">Unknown</option>
                {horses.filter(h => h.gender !== 'FEMALE' && h.id !== id).map(h => (<option key={h.id} value={h.id}>{h.name}</option>))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>Dam (mother)</label>
              <select disabled={!canEditProfile} value={formData.damId || ''} onChange={e => setFormData({...formData, damId: e.target.value})} className={inputClasses}>
                <option value="">Unknown</option>
                {horses.filter(h => h.gender === 'FEMALE' && h.id !== id).map(h => (<option key={h.id} value={h.id}>{h.name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Performance & Status */}
        <div className="bg-white border border-gray-100 rounded-2xl p-7" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Weight size={18} className="text-sky-500" /> Performance & status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className={labelClasses}>Weight (kg)</label>
              <input type="number" disabled={!canEditPerformance} value={formData.weight || 0} onChange={e => setFormData({...formData, weight: parseInt(e.target.value)})} className={inputClasses} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>Race aptitude</label>
              <select disabled={!canEditPerformance} value={formData.race_aptitude || 'MILER'} onChange={e => setFormData({...formData, race_aptitude: e.target.value as RaceAptitude})} className={inputClasses}>
                <option value="SPRINTER">Sprinter (1000m - 1400m)</option>
                <option value="MILER">Miler (1600m)</option>
                <option value="STAYER">Stayer (2000m+)</option>
              </select>
            </div>
            {isManager && (
              <>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Health status</label>
                  <select value={formData.healthStatus || 'ELIGIBLE'} onChange={e => setFormData({...formData, healthStatus: e.target.value as HealthStatus})} className={inputClasses}>
                    <option value="ELIGIBLE">Eligible</option>
                    <option value="UNDER_OBSERVATION">Under observation</option>
                    <option value="INJURED">Injured</option>
                    <option value="QUARANTINED">Quarantined</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Lifecycle status</label>
                  <select value={formData.lifecycleStatus || 'ACTIVE'} onChange={e => setFormData({...formData, lifecycleStatus: e.target.value as LifecycleStatus})} className={inputClasses}>
                    <option value="ACTIVE">Active</option>
                    <option value="RETIRED">Retired</option>
                    <option value="TRANSFERRED">Transferred</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t border-gray-100 justify-between">
          {isEditing && isManager ? (
            <button type="button" onClick={handleDelete} className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]">
              Soft delete
            </button>
          ) : <div />}
          
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]">
              Cancel
            </button>
            <button type="submit" className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-2 active:scale-[0.98]">
              <Save size={16} />
              {isEditing ? 'Save changes' : 'Register horse'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default HorseForm;