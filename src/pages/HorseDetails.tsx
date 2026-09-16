import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore, type Horse } from '../store/store';
import { motion } from 'motion/react';
import { ArrowLeft, Activity, Calendar, FileText, Weight, Heart, Hash, Medal, Users, Edit3, Share2 } from 'lucide-react';

const HorseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const horses = useStore(state => state.horses);
  const currentUser = useStore(state => state.currentUser);
  const horse = horses.find(h => h.id === id);
  const sire = horses.find(h => h.id === horse?.sireId);
  const dam = horses.find(h => h.id === horse?.damId);

  if (!horse) {
    return <div className="text-white p-8">Horse not found</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FIT': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'INJURED': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'TRAINING': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'MONITOR': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'LOCKED': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  const getAptitudeColor = (apt: string) => {
    switch (apt) {
      case 'SPRINTER': return 'text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20';
      case 'MILER': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20';
      case 'STAYER': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  const canEdit = currentUser?.role === 'CLUB_MANAGER' || currentUser?.role === 'HEAD_TRAINER';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
    >
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-slate-400 hover:text-white transition-colors text-sm font-medium"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to List
      </button>

      {/* Header Profile */}
      <div className="relative overflow-hidden rounded-3xl bg-[#121212] border border-slate-800 p-8 flex flex-col md:flex-row gap-8 items-start md:items-center">
        {/* Abstract Background Blur */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden shrink-0 ring-1 ring-white/10 shadow-2xl">
          <img src={horse.avatar} alt={horse.name} className="w-full h-full object-cover" />
        </div>
        
        <div className="flex-1 space-y-3 z-10">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">{horse.name}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(horse.healthStatus)}`}>
              {horse.healthStatus}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-slate-400 font-medium">
            <div className="flex items-center gap-1.5"><Hash size={16} /> {horse.microchipId}</div>
            <div className="flex items-center gap-1.5"><Calendar size={16} /> {horse.dateOfBirth} ({horse.age}yo)</div>
            <div className="flex items-center gap-1.5"><Medal size={16} /> {horse.breed}</div>
          </div>
        </div>

        {canEdit && (
          <div className="z-10 shrink-0 self-start md:self-center">
            <Link to={`/horses/${horse.id}/edit`} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              <Edit3 size={18} />
              Edit Profile
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <div className="bg-[#121212] border border-slate-800 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><FileText size={100} /></div>
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <FileText size={20} className="text-emerald-400" /> Basic Info
          </h2>
          <div className="space-y-4 text-sm relative z-10">
            <div className="flex justify-between border-b border-slate-800/50 pb-3">
              <span className="text-slate-400">Gender</span>
              <span className="font-medium text-slate-100">{horse.gender}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/50 pb-3">
              <span className="text-slate-400">Color</span>
              <span className="font-medium text-slate-100">{horse.color}</span>
            </div>
            <div className="flex justify-between pb-1">
              <span className="text-slate-400">Date of Birth</span>
              <span className="font-medium text-slate-100">{horse.dateOfBirth}</span>
            </div>
          </div>
        </div>

        {/* Racing Profile */}
        <div className="bg-[#121212] border border-slate-800 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={100} /></div>
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Activity size={20} className="text-emerald-400" /> Racing Profile
          </h2>
          <div className="space-y-4 text-sm relative z-10">
            <div className="flex justify-between border-b border-slate-800/50 pb-3 items-center">
              <span className="text-slate-400">Aptitude</span>
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getAptitudeColor(horse.race_aptitude)}`}>
                {horse.race_aptitude}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-800/50 pb-3 items-center">
              <span className="text-slate-400">Weight</span>
              <span className="font-medium text-slate-100 flex items-center gap-1.5"><Weight size={14} className="text-slate-500" /> {horse.weight} kg</span>
            </div>
            <div className="flex justify-between pb-1 items-center">
              <span className="text-slate-400">Fitness</span>
              <span className="font-medium text-emerald-400 flex items-center gap-1.5"><Heart size={14} /> {horse.fitness}%</span>
            </div>
          </div>
        </div>

        {/* Ownership */}
        <div className="bg-[#121212] border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Users size={20} className="text-emerald-400" /> Primary Owner
            </h2>
            {horse.primaryOwner ? (
              <div className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-800/50 rounded-2xl mb-4">
                <div className="font-medium text-slate-100 truncate pr-4">{horse.primaryOwner.name}</div>
                <div className="text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg shrink-0">{horse.primaryOwner.percentage}%</div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm mb-4">No primary owner assigned</p>
            )}
          </div>
          <Link to={`/horses/${horse.id}/owners`} className="w-full py-3 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 hover:text-white transition-colors text-center text-sm flex items-center justify-center gap-2">
            <Users size={16} /> Manage Syndicate
          </Link>
        </div>
      </div>

      {/* Lineage */}
      <div className="bg-[#121212] border border-slate-800 rounded-3xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Share2 size={20} className="text-emerald-400" /> Bloodline Lineage
          </h2>
          <Link to={`/horses/${horse.id}/pedigree`} className="text-sm font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            View Full Pedigree <ArrowRight size={14} />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sire */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 overflow-hidden">
              {sire ? <img src={sire.avatar} alt="Sire" className="w-full h-full object-cover" /> : <span className="text-slate-500 font-bold">S</span>}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sire (Father)</p>
              {sire ? (
                <>
                  <p className="text-slate-100 font-medium">{sire.name}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getAptitudeColor(sire.race_aptitude)}`}>{sire.race_aptitude}</span>
                </>
              ) : (
                <p className="text-slate-500 italic text-sm">Unknown Sire</p>
              )}
            </div>
          </div>

          {/* Dam */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 overflow-hidden">
              {dam ? <img src={dam.avatar} alt="Dam" className="w-full h-full object-cover" /> : <span className="text-slate-500 font-bold">D</span>}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dam (Mother)</p>
              {dam ? (
                <>
                  <p className="text-slate-100 font-medium">{dam.name}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getAptitudeColor(dam.race_aptitude)}`}>{dam.race_aptitude}</span>
                </>
              ) : (
                <p className="text-slate-500 italic text-sm">Unknown Dam</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HorseDetails;
const ArrowRight = ({size, className}: {size?: number, className?: string}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);