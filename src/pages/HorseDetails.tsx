import { useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/store';
import { ArrowLeft, Activity, Calendar, FileText, Weight, Heart, Hash, Medal, Users, Edit3, Share2, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { T } from '../i18n/T';

const HorseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const horses = useStore(state => state.horses);
  const currentUser = useStore(state => state.currentUser);
  const horse = horses.find(h => h.id === id);
  const sire = horses.find(h => h.id === horse?.sireId);
  const dam = horses.find(h => h.id === horse?.damId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const els = containerRef.current.querySelectorAll('[data-detail-reveal]');
    gsap.fromTo(
      els,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out', delay: 0.1 }
    );
  }, [id]);

  if (!horse) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg"><T>Horse not found</T></p>
        <button onClick={() => navigate('/horses')} className="mt-4 text-emerald-600 text-sm font-medium hover:underline">
          Back to stable
        </button>
      </div>
    );
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'ELIGIBLE': return 'text-emerald-700 bg-emerald-50 border-emerald-100';
      case 'INJURED': return 'text-red-600 bg-red-50 border-red-100';
      case 'UNDER_OBSERVATION': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'QUARANTINED': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getAptitudeStyle = (apt: string) => {
    switch (apt) {
      case 'SPRINTER': return 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100';
      case 'MILER': return 'text-cyan-600 bg-cyan-50 border-cyan-100';
      case 'STAYER': return 'text-orange-600 bg-orange-50 border-orange-100';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const canEdit = currentUser?.role === 'CLUB_MANAGER' || currentUser?.role === 'HEAD_TRAINER';

  return (
    <div ref={containerRef} className="space-y-6 pb-12">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-400 hover:text-gray-600 transition-colors text-sm font-medium"
        data-detail-reveal
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to list
      </button>

      {/* Header Profile */}
      <div data-detail-reveal className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 p-7 flex flex-col md:flex-row gap-6 items-start md:items-center" style={{ boxShadow: 'var(--shadow-lg)' }}>
        {/* Background accent */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-100 rounded-full blur-[100px] pointer-events-none opacity-50" />
        
        <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden shrink-0 ring-1 ring-gray-100 shadow-lg">
          <img src={horse.avatar} alt={horse.name} className="w-full h-full object-cover" />
        </div>
        
        <div className="flex-1 space-y-2.5 z-10">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">{horse.name}</h1>
            <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getStatusStyle(horse.healthStatus)}`}>
              {horse.healthStatus.replace('_', ' ')}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5"><Hash size={14} className="text-gray-300" /> {horse.microchipId}</span>
            <span className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-300" /> {horse.dateOfBirth} ({horse.age}yo)</span>
            <span className="flex items-center gap-1.5"><Medal size={14} className="text-gray-300" /> {horse.breed}</span>
          </div>
        </div>

        {canEdit && (
          <div className="z-10 shrink-0 self-start md:self-center">
            <Link to={`/horses/${horse.id}/edit`} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-all duration-200 shadow-sm shadow-emerald-600/20 active:scale-[0.98]">
              <Edit3 size={16} />
              Edit profile
            </Link>
          </div>
        )}
      </div>

      {/* Info Cards — Bento (2 + 1 layout instead of 3 equal) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        {/* Basic Info — Wider */}
        <div data-detail-reveal className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 relative overflow-hidden group" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity"><FileText size={100} /></div>
          <h2 className="text-sm font-semibold text-gray-400 mb-5 flex items-center gap-2">
            <FileText size={16} className="text-emerald-500" /> Basic info
          </h2>
          <div className="space-y-3.5 text-sm relative z-10">
            {[
              ['Gender', horse.gender],
              ['Color', horse.color],
              ['Date of birth', horse.dateOfBirth],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                <span className="text-gray-400"><T>{label}</T></span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Racing Profile */}
        <div data-detail-reveal className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 relative overflow-hidden group" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity"><Activity size={100} /></div>
          <h2 className="text-sm font-semibold text-gray-400 mb-5 flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" /> Racing profile
          </h2>
          <div className="space-y-3.5 text-sm relative z-10">
            <div className="flex justify-between border-b border-gray-50 pb-3 items-center">
              <span className="text-gray-400"><T>Aptitude</T></span>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${getAptitudeStyle(horse.race_aptitude)}`}>
                {horse.race_aptitude}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-50 pb-3 items-center">
              <span className="text-gray-400"><T>Weight</T></span>
              <span className="font-medium text-gray-800 flex items-center gap-1.5"><Weight size={14} className="text-gray-300" /> {horse.weight} kg</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400"><T>Fitness</T></span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1.5"><Heart size={14} /> {horse.fitness}%</span>
            </div>
          </div>
        </div>

        {/* Ownership — Narrow */}
        <div data-detail-reveal className="md:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 flex flex-col justify-between" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-5 flex items-center gap-2">
              <Users size={16} className="text-emerald-500" /> Owner
            </h2>
            {horse.primaryOwner ? (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-4">
                <p className="font-medium text-gray-800 truncate text-sm">{horse.primaryOwner.name}</p>
                <p className="text-emerald-600 font-bold text-lg tabular-nums mt-1">{horse.primaryOwner.percentage}%</p>
              </div>
            ) : (
              <p className="text-gray-400 text-sm mb-4"><T>No primary owner assigned</T></p>
            )}
          </div>
          <Link to={`/horses/${horse.id}/owners`} className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-800 transition-all text-center text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
            <Users size={14} /> Manage
          </Link>
        </div>
      </div>

      {/* Lineage */}
      <div data-detail-reveal className="bg-white border border-gray-100 rounded-2xl p-7" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
            <Share2 size={16} className="text-emerald-500" /> Bloodline lineage
          </h2>
          <Link to={`/horses/${horse.id}/pedigree`} className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 flex items-center gap-1">
            View full pedigree <ArrowRight size={12} />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sire */}
          <div className="p-4 rounded-xl border border-blue-50 bg-blue-50/30 flex items-center gap-4 hover:bg-blue-50/60 transition-colors cursor-pointer" onClick={() => sire && navigate(`/horses/${sire.id}`)}>
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 border border-blue-100 overflow-hidden shadow-sm">
              {sire ? <img src={sire.avatar} alt="Sire" className="w-full h-full object-cover" /> : <span className="text-gray-300 font-bold text-sm"><T>S</T></span>}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-blue-400 tracking-wide mb-0.5"><T>Sire (father)</T></p>
              {sire ? (
                <>
                  <p className="text-sm font-semibold text-gray-800">{sire.name}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${getAptitudeStyle(sire.race_aptitude)}`}>{sire.race_aptitude}</span>
                </>
              ) : (
                <p className="text-gray-400 italic text-sm"><T>Unknown sire</T></p>
              )}
            </div>
          </div>

          {/* Dam */}
          <div className="p-4 rounded-xl border border-rose-50 bg-rose-50/30 flex items-center gap-4 hover:bg-rose-50/60 transition-colors cursor-pointer" onClick={() => dam && navigate(`/horses/${dam.id}`)}>
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 border border-rose-100 overflow-hidden shadow-sm">
              {dam ? <img src={dam.avatar} alt="Dam" className="w-full h-full object-cover" /> : <span className="text-gray-300 font-bold text-sm"><T>D</T></span>}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-rose-400 tracking-wide mb-0.5"><T>Dam (mother)</T></p>
              {dam ? (
                <>
                  <p className="text-sm font-semibold text-gray-800">{dam.name}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${getAptitudeStyle(dam.race_aptitude)}`}>{dam.race_aptitude}</span>
                </>
              ) : (
                <p className="text-gray-400 italic text-sm"><T>Unknown dam</T></p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HorseDetails;