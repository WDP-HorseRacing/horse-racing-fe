import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { Activity, HeartPulse, Timer, AlertTriangle } from 'lucide-react';

const RealtimeTraining = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const horse = useStore(state => state.horses.find(h => h.id === id));
  
  const [heartRate, setHeartRate] = useState(130);
  const [speed, setSpeed] = useState(45);
  const [timer, setTimer] = useState(0);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeartRate(prev => {
        const val = prev + (Math.random() * 10 - 4);
        return Math.min(210, Math.max(80, val));
      });
      setSpeed(prev => {
        const val = prev + (Math.random() * 4 - 2);
        return Math.min(72, Math.max(20, val));
      });
      setTimer(prev => prev + 1);
      setDistance(prev => prev + (speed / 3600) * 1000); // meters per second
    }, 1000);
    return () => clearInterval(interval);
  }, [speed]);

  if (!horse) return <div className="text-center py-20 text-gray-400">Horse not found</div>;

  const isCritical = heartRate > 190;

  return (
    <div className="space-y-5 h-[calc(100vh-8rem)] flex flex-col">
      {/* Top Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shrink-0" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/horses')} className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all active:scale-[0.98] text-gray-700">
            End session
          </button>
          <div className="h-8 w-px bg-gray-100" />
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Live: {horse.name}
          </h2>
        </div>
        <div className="flex gap-6 text-gray-500 text-sm">
          <span className="flex items-center gap-2 tabular-nums"><Timer size={16} /> {Math.floor(timer/60)}:{(timer%60).toString().padStart(2, '0')}</span>
          <span className="tabular-nums">{Math.round(distance)}m covered</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Main Canvas Area */}
        <div className="md:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent" />
          
          {/* Animated track visualization */}
          <div className="text-center z-10 flex flex-col items-center">
            <div className="relative w-36 h-36 mb-6">
              {/* Outer ring */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1f2937" strokeWidth="6" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${(timer % 60) * 4.4} 264`}
                  className="transition-all duration-1000"
                />
              </svg>
              {/* Speed in center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white tabular-nums">{Math.round(speed)}</span>
                <span className="text-xs text-gray-400">km/h</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm font-mono">Track position rendering...</p>
            <p className="text-xs text-gray-500 mt-1">Three.js integration ready</p>
          </div>
        </div>

        {/* Realtime Stats */}
        <div className="flex flex-col gap-5">
          <div className={`flex-1 rounded-2xl p-6 border flex flex-col items-center justify-center transition-all duration-500 ${
            isCritical
              ? 'bg-red-50 border-red-200'
              : 'bg-white border-gray-100'
          }`} style={!isCritical ? { boxShadow: 'var(--shadow-card)' } : undefined}>
            <HeartPulse size={40} className={`mb-3 ${isCritical ? 'text-red-500 animate-bounce' : 'text-emerald-500'}`} />
            <p className="text-gray-400 text-xs tracking-wide mb-2 font-medium">Heart rate</p>
            <div className="flex items-end gap-1.5">
              <span className={`text-5xl font-bold tracking-tighter tabular-nums ${isCritical ? 'text-red-500' : 'text-gray-900'}`}>
                {Math.round(heartRate)}
              </span>
              <span className="text-gray-400 pb-1 text-sm">bpm</span>
            </div>
            {isCritical && (
              <div className="mt-3 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs flex items-center gap-1.5 animate-pulse font-semibold">
                <AlertTriangle size={14} /> Danger zone: Reduce speed
              </div>
            )}
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center justify-center" style={{ boxShadow: 'var(--shadow-card)' }}>
            <Activity size={40} className="text-sky-500 mb-3" />
            <p className="text-gray-400 text-xs tracking-wide mb-2 font-medium">Current speed</p>
            <div className="flex items-end gap-1.5">
              <span className="text-5xl font-bold tracking-tighter text-gray-900 tabular-nums">{Math.round(speed)}</span>
              <span className="text-gray-400 pb-1 text-sm">km/h</span>
            </div>
          </div>

          {/* Post-session button */}
          <button
            onClick={() => navigate(`/eval/${horse.id}`)}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all duration-200 shadow-sm shadow-emerald-600/20 active:scale-[0.98]"
          >
            End & evaluate
          </button>
        </div>
      </div>
    </div>
  );
};

export default RealtimeTraining;
