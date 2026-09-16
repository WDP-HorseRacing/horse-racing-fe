import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';

const PostSessionEval = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const horse = useStore(state => state.horses.find(h => h.id === id)) || useStore(state => state.horses[0]);

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Session Evaluation</h2>
        <p className="text-slate-400">Record performance metrics and notes for {horse?.name}.</p>
      </div>

      <div className="bg-[#161616] p-8 rounded-2xl border border-slate-800 space-y-8">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-4">Overall Performance Score (1-10)</label>
          <div className="flex gap-2">
            {[1,2,3,4,5,6,7,8,9,10].map(score => (
              <button 
                key={score}
                className="flex-1 py-3 rounded-lg bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 font-bold transition-colors border border-slate-700"
              >
                {score}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Trainer's Notes</label>
          <textarea 
            className="w-full h-32 bg-[#0a0a0a] border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="E.g., Showed good stamina in the final 400m, but stride length was slightly shorter than baseline."
          ></textarea>
        </div>
        
        <div className="flex justify-end gap-4">
          <button onClick={() => navigate('/horses')} className="px-6 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</button>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">Save Evaluation</button>
        </div>
      </div>
    </div>
  );
};

export default PostSessionEval;
