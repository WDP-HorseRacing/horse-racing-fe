import React, { useState, useEffect } from 'react';
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

  // GSAP/Framer-motion style mockup animation
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartRate(prev => {
        const val = prev + (Math.random() * 10 - 4);
        return val > 210 ? 210 : val;
      });
      setSpeed(prev => prev + (Math.random() * 4 - 2));
      setTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!horse) return <div>Horse not found</div>;

  const isCritical = heartRate > 190;

  return (
    <div className="space-y-6 animate-in zoom-in-95 duration-700 h-[80vh] flex flex-col">
      <div className="flex justify-between items-center bg-[#161616] p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/horses')} className="px-4 py-2 bg-slate-800 rounded-lg text-sm hover:bg-slate-700 transition-colors">End Session</button>
          <div className="h-8 w-[1px] bg-slate-800"></div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            LIVE: {horse.name}
          </h2>
        </div>
        <div className="flex gap-6 text-slate-400">
          <div className="flex items-center gap-2"><Timer size={18} /> {Math.floor(timer/60)}:{(timer%60).toString().padStart(2, '0')}</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main 3D Canvas Area (Mockup) */}
        <div className="md:col-span-2 bg-[#0a0a0a] border border-slate-800 rounded-2xl relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent"></div>
          
          <div className="text-center z-10">
            <div className="w-32 h-32 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4 mx-auto"></div>
            <p className="text-slate-500 font-mono">[ Three.js Canvas Placeholder ]</p>
            <p className="text-sm text-slate-600 mt-2">Rendering Track Position...</p>
          </div>
        </div>

        {/* Realtime Stats Area */}
        <div className="flex flex-col gap-6">
          <div className={`flex-1 rounded-2xl p-6 border flex flex-col items-center justify-center transition-colors duration-500 ${isCritical ? 'bg-rose-500/10 border-rose-500/50' : 'bg-[#161616] border-slate-800'}`}>
            <HeartPulse size={48} className={`mb-4 ${isCritical ? 'text-rose-500 animate-bounce' : 'text-emerald-400'}`} />
            <p className="text-slate-400 text-sm uppercase tracking-wider mb-2">Heart Rate</p>
            <div className="flex items-end gap-2">
              <span className={`text-6xl font-bold tracking-tighter ${isCritical ? 'text-rose-400' : 'text-white'}`}>{Math.round(heartRate)}</span>
              <span className="text-slate-500 pb-2">bpm</span>
            </div>
            {isCritical && (
              <div className="mt-4 px-4 py-2 bg-rose-500/20 text-rose-400 rounded-lg text-sm flex items-center gap-2 animate-pulse">
                <AlertTriangle size={16} /> Danger Zone: Reduce speed
              </div>
            )}
          </div>

          <div className="flex-1 bg-[#161616] rounded-2xl border border-slate-800 p-6 flex flex-col items-center justify-center">
            <Activity size={48} className="text-blue-400 mb-4" />
            <p className="text-slate-400 text-sm uppercase tracking-wider mb-2">Current Speed</p>
            <div className="flex items-end gap-2">
              <span className="text-6xl font-bold tracking-tighter text-white">{Math.round(speed)}</span>
              <span className="text-slate-500 pb-2">km/h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeTraining;
