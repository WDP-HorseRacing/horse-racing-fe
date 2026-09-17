import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { ArrowLeft, Star, MessageSquare, Thermometer, Footprints } from 'lucide-react';
import { T } from '../i18n/T';
import { useI18n } from '../i18n/I18nContext';

const PostSessionEval = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const horse = useStore(state => state.horses.find(h => h.id === id) ?? state.horses[0]);
  const [score, setScore] = useState<number | null>(null);
  const [gaitQuality, setGaitQuality] = useState<string>('');
  const [temperament, setTemperament] = useState<string>('');
  const [notes, setNotes] = useState('');

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-400 hover:text-gray-600 transition-colors text-sm font-medium">
        <ArrowLeft size={16} className="mr-2" /> Back
      </button>

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1"><T>Session evaluation</T></h2>
        <p className="text-gray-500 font-light">Record performance metrics and notes for {horse?.name}.</p>
      </div>

      <div className="bg-white p-7 rounded-2xl border border-gray-100 space-y-8" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Overall Score */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
            <Star size={16} className="text-amber-500" /> Overall performance score (1–10)
          </label>
          <div className="flex gap-2">
            {[1,2,3,4,5,6,7,8,9,10].map(s => (
              <button 
                key={s}
                onClick={() => setScore(s)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.95] ${
                  score === s
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Gait Quality */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <Footprints size={16} className="text-sky-500" /> Gait quality
          </label>
          <div className="flex gap-2.5">
            {['Excellent', 'Good', 'Fair', 'Poor'].map(g => (
              <button
                key={g}
                onClick={() => setGaitQuality(g)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                  gaitQuality === g
                    ? 'bg-sky-50 border border-sky-200 text-sky-700'
                    : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Temperament */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <Thermometer size={16} className="text-amber-500" /> Temperament during session
          </label>
          <div className="flex gap-2.5">
            {['Calm', 'Responsive', 'Anxious', 'Aggressive'].map(t => (
              <button
                key={t}
                onClick={() => setTemperament(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                  temperament === t
                    ? 'bg-amber-50 border border-amber-200 text-amber-700'
                    : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <MessageSquare size={16} className="text-emerald-500" /> Trainer's notes
          </label>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-32 bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:bg-white transition-all placeholder:text-gray-300 resize-none"
            placeholder={t('E.g., Showed good stamina in the final 400m, but stride length was slightly shorter than baseline.')}
          />
        </div>
        
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button onClick={() => navigate('/horses')} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-all active:scale-[0.98]">
            Cancel
          </button>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-all shadow-sm shadow-emerald-600/20 active:scale-[0.98]">
            Save evaluation
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostSessionEval;
