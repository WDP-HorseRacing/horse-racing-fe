import { useRef, useEffect } from 'react';
import { useStore } from '../store/store';
import { Activity, AlertCircle, Flag, Users, BarChart3, ArrowRight, Calendar, Heart, Zap, Trophy, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { T } from '../i18n/T';

const Dashboard = () => {
  const navigate = useNavigate();
  const currentUser = useStore(state => state.currentUser);
  const horses = useStore(state => state.horses);
  const ownerships = useStore(state => state.ownerships);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const els = containerRef.current.querySelectorAll('[data-dash-reveal]');
    gsap.fromTo(
      els,
      { opacity: 0, y: 25 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out', delay: 0.1 }
    );
  }, [currentUser?.role]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  if (!currentUser) return null;

  // Filter data based on role
  const activeHorses = horses.filter(h => h.lifecycleStatus === 'ACTIVE');
  const eligibleHorses = activeHorses.filter(h => h.healthStatus === 'ELIGIBLE');
  const injuredHorses = activeHorses.filter(h => h.healthStatus === 'INJURED');
  const monitorHorses = activeHorses.filter(h => h.healthStatus === 'UNDER_OBSERVATION');
  const raceReady = activeHorses.filter(h => h.raceReadiness === 'Peak' || h.raceReadiness === 'High');

  // Owner's horses
  const myHorseIds = ownerships.filter(o => o.ownerId === currentUser.id).map(o => o.horseId);
  const myHorses = horses.filter(h => myHorseIds.includes(h.id));
  const myTotalShare = ownerships.filter(o => o.ownerId === currentUser.id).reduce((s, o) => s + o.percentage, 0);

  // ===== HEAD_TRAINER DASHBOARD =====
  if (currentUser.role === 'HEAD_TRAINER') {
    return (
      <div ref={containerRef} className="space-y-8 pb-8">
        <div data-dash-reveal>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">{greeting}, {currentUser.name.split(' ')[0]}</h2>
          <p className="text-gray-500 font-light">Track condition is optimal. {eligibleHorses.length} horses eligible for training today.</p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
          {/* Today's Schedule - Wide */}
          <div data-dash-reveal className="md:col-span-3 bg-white rounded-2xl border border-gray-100 p-7 relative overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <h3 className="text-sm font-semibold text-gray-400 mb-5 flex items-center gap-2">
              <Calendar size={16} className="text-emerald-500" />
              Today's schedule
            </h3>
            <div className="space-y-3">
              {[
                { time: '06:30', horse: 'Thunder King', type: 'Speed work', dist: '1,200m', status: 'done' },
                { time: '08:00', horse: 'Silver Arrow', type: 'Endurance', dist: '2,400m', status: 'active' },
                { time: '10:30', horse: 'Night Eclipse', type: 'Race prep', dist: '1,600m', status: 'upcoming' },
                { time: '14:00', horse: 'Red Storm', type: 'Recovery walk', dist: '800m', status: 'upcoming' },
              ].map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-200 ${
                    s.status === 'active'
                      ? 'bg-emerald-50 border border-emerald-100'
                      : s.status === 'done'
                      ? 'opacity-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-mono text-gray-400 w-12 tabular-nums shrink-0">{s.time}</span>
                  <div className={`w-1.5 h-8 rounded-full shrink-0 ${
                    s.status === 'active' ? 'bg-emerald-500' : s.status === 'done' ? 'bg-gray-200' : 'bg-gray-200'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{s.horse}</p>
                    <p className="text-xs text-gray-400">{s.type} · {s.dist}</p>
                  </div>
                  {s.status === 'active' && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="md:col-span-2 flex flex-col gap-5">
            <div data-dash-reveal className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div>
                <p className="text-3xl font-bold text-gray-900 tabular-nums">{eligibleHorses.length}</p>
                <p className="text-sm text-gray-400 mt-1"><T>Training ready</T></p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Activity className="text-emerald-500" size={22} />
              </div>
            </div>
            <div data-dash-reveal className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div>
                <p className="text-3xl font-bold text-gray-900 tabular-nums">{raceReady.length}</p>
                <p className="text-sm text-gray-400 mt-1"><T>Race ready</T></p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                <Flag className="text-amber-500" size={22} />
              </div>
            </div>
            <div data-dash-reveal className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
              <h4 className="text-sm font-semibold text-gray-400 mb-3"><T>Quick actions</T></h4>
              <div className="space-y-2">
                <button onClick={() => navigate('/horses')} className="w-full text-left text-sm text-gray-700 hover:text-emerald-600 font-medium flex items-center justify-between py-2 px-3 rounded-lg hover:bg-emerald-50 transition-all duration-200">
                  View all horses <ArrowRight size={14} />
                </button>
                <button onClick={() => navigate('/race-registration')} className="w-full text-left text-sm text-gray-700 hover:text-emerald-600 font-medium flex items-center justify-between py-2 px-3 rounded-lg hover:bg-emerald-50 transition-all duration-200">
                  Race registration <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Requires Attention */}
        {(injuredHorses.length > 0 || monitorHorses.length > 0) && (
          <div data-dash-reveal>
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-500" />
              Requires attention
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...injuredHorses, ...monitorHorses].map(horse => (
                <div 
                  key={horse.id} 
                  onClick={() => navigate(`/horses/${horse.id}`)}
                  className="bg-white border border-gray-100 hover:border-gray-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <img src={horse.avatar} alt={horse.name} className="w-12 h-12 rounded-xl object-cover border border-gray-100" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-800 truncate">{horse.name}</h4>
                    <p className="text-xs text-gray-400"><T>{horse.currentPhase}</T></p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    horse.healthStatus === 'INJURED'
                      ? 'bg-red-50 text-red-600 border border-red-100'
                      : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {horse.healthStatus.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== CLUB_MANAGER DASHBOARD =====
  if (currentUser.role === 'CLUB_MANAGER') {
    const healthBreakdown = [
      { label: 'Eligible', count: eligibleHorses.length, color: 'bg-emerald-500', pct: Math.round((eligibleHorses.length / activeHorses.length) * 100) },
      { label: 'Observation', count: monitorHorses.length, color: 'bg-amber-400', pct: Math.round((monitorHorses.length / activeHorses.length) * 100) },
      { label: 'Injured', count: injuredHorses.length, color: 'bg-red-400', pct: Math.round((injuredHorses.length / activeHorses.length) * 100) },
    ];

    return (
      <div ref={containerRef} className="space-y-8 pb-8">
        <div data-dash-reveal>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">{greeting}, {currentUser.name.split(' ')[0]}</h2>
          <p className="text-gray-500 font-light"><T>Club overview and management tools.</T></p>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { label: 'Total horses', value: activeHorses.length, icon: Users, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
            { label: 'Race ready', value: raceReady.length, icon: Trophy, iconBg: 'bg-amber-50', iconColor: 'text-amber-500' },
            { label: 'Injured', value: injuredHorses.length, icon: Heart, iconBg: 'bg-red-50', iconColor: 'text-red-400' },
            { label: 'Active plans', value: 8, icon: ClipboardList, iconBg: 'bg-sky-50', iconColor: 'text-sky-500' },
          ].map((stat, i) => (
            <div key={i} data-dash-reveal className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                  <stat.icon size={18} className={stat.iconColor} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
          {/* Health Breakdown */}
          <div data-dash-reveal className="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-7" style={{ boxShadow: 'var(--shadow-card)' }}>
            <h3 className="text-sm font-semibold text-gray-400 mb-5 flex items-center gap-2">
              <BarChart3 size={16} className="text-emerald-500" />
              Health status breakdown
            </h3>
            {/* Stacked bar */}
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex mb-5">
              {healthBreakdown.map((h, i) => (
                <div key={i} className={`h-full ${h.color} transition-all duration-700`} style={{ width: `${h.pct}%` }} />
              ))}
            </div>
            <div className="space-y-3">
              {healthBreakdown.map((h, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${h.color}`} />
                    <span className="text-sm text-gray-600">{h.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800 tabular-nums">{h.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Horses + Actions */}
          <div data-dash-reveal className="md:col-span-3 bg-white rounded-2xl border border-gray-100 p-7" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-gray-400"><T>Horse roster</T></h3>
              <button onClick={() => navigate('/horses')} className="text-xs text-emerald-600 font-semibold hover:text-emerald-500 flex items-center gap-1">
                View all <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {activeHorses.slice(0, 5).map(horse => (
                <div
                  key={horse.id}
                  onClick={() => navigate(`/horses/${horse.id}`)}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-all duration-200"
                >
                  <img src={horse.avatar} alt={horse.name} className="w-9 h-9 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{horse.name}</p>
                    <p className="text-xs text-gray-400">{horse.breed} · {horse.age}yo</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    horse.healthStatus === 'ELIGIBLE' ? 'text-emerald-600 bg-emerald-50' :
                    horse.healthStatus === 'INJURED' ? 'text-red-600 bg-red-50' :
                    'text-amber-600 bg-amber-50'
                  }`}>
                    {horse.healthStatus.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-5 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => navigate('/horses/new')}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-all duration-200 shadow-sm shadow-emerald-600/20 active:scale-[0.98]"
              >
                Register new horse
              </button>
              <button
                onClick={() => navigate('/race-registration')}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-all duration-200 active:scale-[0.98]"
              >
                Race registration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.role === 'VETERINARIAN' || currentUser.role === 'GROOM') {
    const isVet = currentUser.role === 'VETERINARIAN';
    const queue = isVet ? [...injuredHorses, ...monitorHorses] : activeHorses.slice(0, 4);
    return (
      <div ref={containerRef} className="space-y-8 pb-8">
        <div data-dash-reveal>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">{greeting}, {currentUser.name.split(' ')[0]}</h2>
          <p className="text-gray-500 font-light">{isVet ? 'Clinical queue, medical alerts, and preventive care.' : 'Daily care, stable tasks, and veterinary instructions.'}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: isVet ? 'Critical cases' : 'Tasks today', value: isVet ? injuredHorses.length : 8, color: 'text-red-500' },
            { label: isVet ? 'Monitoring' : 'Completed', value: isVet ? monitorHorses.length : 3, color: 'text-amber-500' },
            { label: isVet ? 'Healthy' : 'Horses in care', value: eligibleHorses.length, color: 'text-emerald-600' },
            { label: 'Open alerts', value: 2, color: 'text-sky-500' },
          ].map(stat => <div key={stat.label} data-dash-reveal className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: 'var(--shadow-card)' }}><p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p><p className="text-xs text-gray-400 mt-1">{stat.label}</p></div>)}
        </div>
        <div className="grid md:grid-cols-5 gap-5">
          <div data-dash-reveal className="md:col-span-3 bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
            <h3 className="text-sm font-semibold text-gray-500 mb-5">{isVet ? 'Cases requiring attention' : 'Next care actions'}</h3>
            <div className="space-y-3">{queue.map(horse => <div key={horse.id} onClick={() => navigate(`/horses/${horse.id}`)} className="flex items-center gap-3 rounded-xl p-3 hover:bg-gray-50 cursor-pointer"><img src={horse.avatar} className="w-10 h-10 rounded-xl object-cover" /><div className="flex-1"><p className="text-sm font-semibold text-gray-800">{horse.name}</p><p className="text-xs text-gray-400"><T>{horse.currentPhase}</T></p></div><span className="text-xs font-medium text-emerald-600"><T>Open</T></span></div>)}</div>
          </div>
          <div data-dash-reveal className="md:col-span-2 bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
            <AlertCircle className="text-emerald-600 mb-4" />
            <h3 className="font-semibold text-gray-900">{isVet ? 'Preventive schedule' : 'Vet instruction'}</h3>
            <p className="text-sm text-gray-500 mt-2">{isVet ? 'Three vaccinations and one farrier review are due this week.' : 'Thunder King: walk in hand only for 20 minutes.'}</p>
            <button onClick={() => navigate(isVet ? '/medical' : '/tasks')} className="mt-6 text-sm font-semibold text-emerald-700"><T>Open workspace →</T></button>
          </div>
        </div>
      </div>
    );
  }

  // ===== HORSE_OWNER DASHBOARD =====
  return (
    <div ref={containerRef} className="space-y-8 pb-8">
      <div data-dash-reveal>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">{greeting}, {currentUser.name.split(' ')[0]}</h2>
        <p className="text-gray-500 font-light"><T>Your stable and ownership portfolio.</T></p>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div data-dash-reveal className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <Users size={18} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{myHorses.length}</p>
          <p className="text-xs text-gray-400 mt-0.5"><T>Horses owned</T></p>
        </div>
        <div data-dash-reveal className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
            <Zap size={18} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{myTotalShare}<span className="text-lg text-gray-400">%</span></p>
          <p className="text-xs text-gray-400 mt-0.5"><T>Total ownership share</T></p>
        </div>
        <div data-dash-reveal className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
            <Trophy size={18} className="text-sky-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{myHorses.filter(h => h.raceReadiness === 'Peak' || h.raceReadiness === 'High').length}</p>
          <p className="text-xs text-gray-400 mt-0.5"><T>Race ready</T></p>
        </div>
      </div>

      {/* My Horses */}
      <div data-dash-reveal>
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users size={18} className="text-emerald-500" />
          Your horses
        </h3>
        {myHorses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-gray-400 mb-2"><T>You don't own any horses yet.</T></p>
            <p className="text-sm text-gray-300"><T>Contact your club manager to get started.</T></p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {myHorses.map(horse => {
              const ownership = ownerships.find(o => o.horseId === horse.id && o.ownerId === currentUser.id);
              return (
                <div
                  key={horse.id}
                  onClick={() => navigate(`/horses/${horse.id}`)}
                  className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-100 active:scale-[0.99]"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <img src={horse.avatar} alt={horse.name} className="w-14 h-14 rounded-xl object-cover border border-gray-100" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-800 truncate">{horse.name}</h4>
                    <p className="text-xs text-gray-400">{horse.breed} · {horse.age}yo · {horse.race_aptitude}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-600 tabular-nums">{ownership?.percentage}%</p>
                    <p className="text-xs text-gray-400"><T>share</T></p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Training Updates Feed */}
      <div data-dash-reveal>
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity size={18} className="text-emerald-500" />
          Recent training updates
        </h3>
        <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="space-y-4">
            {[
              { horse: 'Thunder King', event: 'Completed speed work session — 1,200m in 1:14.3', time: '2 hours ago', type: 'training' },
              { horse: 'Night Eclipse', event: 'Fitness score updated to 88%', time: '5 hours ago', type: 'fitness' },
              { horse: 'Thunder King', event: 'Race registration submitted for Spring Sprint Cup', time: 'Yesterday', type: 'race' },
            ].map((update, i) => (
              <div key={i} className="flex items-start gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  update.type === 'training' ? 'bg-emerald-50' :
                  update.type === 'fitness' ? 'bg-sky-50' : 'bg-amber-50'
                }`}>
                  {update.type === 'training' ? <Activity size={14} className="text-emerald-500" /> :
                   update.type === 'fitness' ? <Heart size={14} className="text-sky-500" /> :
                   <Flag size={14} className="text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{update.horse}</span> — {update.event}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{update.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
