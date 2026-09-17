import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/store';
import { useNavigate, Link } from 'react-router-dom';
import { Settings2, Activity, Plus, Filter, Search } from 'lucide-react';
import gsap from 'gsap';
import { T } from '../i18n/T';
import { useI18n } from '../i18n/I18nContext';

const TrainerHorses = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const horses = useStore(state => state.horses);
  const currentUser = useStore(state => state.currentUser);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredHorses = horses.filter(h => {
    const matchesFilter = filter === 'ALL' || h.healthStatus === filter || h.lifecycleStatus === filter;
    const matchesSearch = search === '' || h.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('[data-horse-card]');
    gsap.fromTo(
      cards,
      { opacity: 0, y: 20, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.06, ease: 'power3.out', delay: 0.15 }
    );
  }, [filter, search]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1"><T>My stable</T></h2>
          <p className="text-gray-500 font-light"><T>Manage horse profiles, training plans, and medical status.</T></p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:flex-none">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search horses...')}
              className="w-full md:w-48 bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-gray-300"
            />
          </div>

          {/* Filter */}
          <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent text-gray-600 text-sm focus:outline-none appearance-none cursor-pointer pr-4"
            >
              <option value="ALL"><T>All status</T></option>
              <option value="ELIGIBLE"><T>Eligible</T></option>
              <option value="INJURED"><T>Injured</T></option>
              <option value="UNDER_OBSERVATION"><T>Under observation</T></option>
              <option value="RETIRED"><T>Retired</T></option>
            </select>
          </div>
          
          {currentUser?.role === 'CLUB_MANAGER' && (
            <Link 
              to="/horses/new"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 whitespace-nowrap shadow-sm shadow-emerald-600/20 active:scale-[0.98]"
            >
              <Plus size={16} /> Register horse
            </Link>
          )}
        </div>
      </div>

      <div ref={containerRef} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredHorses.map((horse) => (
          <div 
            data-horse-card
            key={horse.id} 
            className="bg-white border border-gray-100 rounded-2xl overflow-hidden flex flex-col md:flex-row transition-all duration-300 hover:border-emerald-100 hover:-translate-y-1 group"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div 
              className="md:w-2/5 h-48 md:h-auto relative cursor-pointer overflow-hidden"
              onClick={() => navigate(`/horses/${horse.id}`)}
            >
              <img src={horse.avatar} alt={horse.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-white/80 md:from-transparent md:bg-gradient-to-r to-transparent" />
            </div>
            
            <div className="flex-1 p-5 flex flex-col justify-between relative z-10">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <Link to={`/horses/${horse.id}`} className="text-lg font-bold text-gray-900 hover:text-emerald-600 transition-colors">
                    {horse.name}
                  </Link>
                  <span className="px-2.5 py-1 bg-gray-50 rounded-lg text-xs font-semibold text-gray-500 border border-gray-100">
                    {horse.race_aptitude}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mb-5 mt-3">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 tracking-wide mb-0.5"><T>Age & gender</T></p>
                    <p className="text-sm font-medium text-gray-700">{horse.age}yo {horse.gender.toLowerCase()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 tracking-wide mb-0.5"><T>Fitness</T></p>
                    <p className="text-sm font-semibold text-emerald-600 tabular-nums">{horse.fitness}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 tracking-wide mb-0.5"><T>Health</T></p>
                    <p className={`text-sm font-medium ${horse.healthStatus === 'INJURED' || horse.healthStatus === 'QUARANTINED' ? 'text-red-500' : 'text-emerald-600'}`}>
                      {horse.healthStatus.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => navigate(`/plan/${horse.id}`)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
                >
                  <Settings2 size={15} />
                  Plan
                </button>
                {horse.healthStatus === 'ELIGIBLE' && horse.lifecycleStatus === 'ACTIVE' && (
                  <button 
                    onClick={() => navigate(`/live-training/${horse.id}`)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 shadow-sm shadow-emerald-600/20 active:scale-[0.98]"
                  >
                    <Activity size={15} />
                    Live
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredHorses.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg"><T>No horses found matching your criteria.</T></p>
          <p className="text-gray-300 text-sm mt-1"><T>Try adjusting your filters.</T></p>
        </div>
      )}
    </div>
  );
};

export default TrainerHorses;
