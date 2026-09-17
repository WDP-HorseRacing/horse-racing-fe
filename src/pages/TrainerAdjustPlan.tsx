import { Activity, Clock } from 'lucide-react';

const TrainerAdjustPlan = () => {
  // Mock week schedule
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const timeSlots = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00'];
  
  const sessions: Record<string, { horse: string; type: string; color: string }[]> = {
    'Mon-06:00': [{ horse: 'Thunder King', type: 'Speed work', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' }],
    'Mon-10:00': [{ horse: 'Silver Arrow', type: 'Endurance', color: 'bg-sky-50 text-sky-700 border-sky-100' }],
    'Tue-08:00': [{ horse: 'Night Eclipse', type: 'Race prep', color: 'bg-amber-50 text-amber-700 border-amber-100' }],
    'Tue-14:00': [{ horse: 'Red Storm', type: 'Recovery', color: 'bg-rose-50 text-rose-600 border-rose-100' }],
    'Wed-06:00': [{ horse: 'Thunder King', type: 'Interval', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' }],
    'Wed-10:00': [{ horse: 'Night Eclipse', type: 'Speed work', color: 'bg-amber-50 text-amber-700 border-amber-100' }],
    'Thu-08:00': [{ horse: 'Silver Arrow', type: 'Light jog', color: 'bg-sky-50 text-sky-700 border-sky-100' }],
    'Fri-06:00': [{ horse: 'Thunder King', type: 'Race prep', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' }],
    'Fri-10:00': [{ horse: 'Night Eclipse', type: 'Endurance', color: 'bg-amber-50 text-amber-700 border-amber-100' }],
    'Sat-08:00': [{ horse: 'Red Storm', type: 'Walk', color: 'bg-rose-50 text-rose-600 border-rose-100' }],
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Schedule & adjustments</h2>
        <p className="text-gray-500 font-light">View weekly training calendar and manage groom assignments.</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { horse: 'Thunder King', color: 'bg-emerald-500' },
          { horse: 'Silver Arrow', color: 'bg-sky-500' },
          { horse: 'Night Eclipse', color: 'bg-amber-500' },
          { horse: 'Red Storm', color: 'bg-rose-500' },
        ].map(l => (
          <div key={l.horse} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
            <span className="text-xs text-gray-500 font-medium">{l.horse}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Header Row */}
        <div className="grid grid-cols-8 border-b border-gray-100">
          <div className="p-3 flex items-center justify-center">
            <Clock size={14} className="text-gray-300" />
          </div>
          {days.map(day => (
            <div key={day} className="p-3 text-center text-xs font-semibold text-gray-500 border-l border-gray-50">
              {day}
            </div>
          ))}
        </div>

        {/* Time Slots */}
        {timeSlots.map(time => (
          <div key={time} className="grid grid-cols-8 border-b border-gray-50 last:border-0 min-h-[64px]">
            <div className="p-3 flex items-start justify-center text-xs text-gray-400 font-mono tabular-nums pt-4">
              {time}
            </div>
            {days.map(day => {
              const key = `${day}-${time}`;
              const cellSessions = sessions[key] || [];
              return (
                <div key={key} className="p-1.5 border-l border-gray-50 min-h-[64px]">
                  {cellSessions.map((s, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition-all duration-200 hover:shadow-sm ${s.color}`}
                    >
                      <p className="font-semibold truncate">{s.horse}</p>
                      <p className="opacity-70 truncate">{s.type}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <Activity size={16} className="text-emerald-500" />
        <span>10 sessions scheduled this week across 4 horses.</span>
      </div>
    </div>
  );
};

export default TrainerAdjustPlan;
