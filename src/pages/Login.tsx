import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useStore } from '../store/store';
import { KeyRound, Mail, ArrowRight, ShieldCheck, Flag } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useStore(state => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const success = await login(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoClick = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center relative overflow-hidden font-sans">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#10b981] opacity-20 rounded-full blur-[150px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#0ea5e9] opacity-10 rounded-full blur-[150px] mix-blend-screen pointer-events-none" />
      
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md p-8 relative z-10"
      >
        <div className="mb-10 text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#10b981] to-[#059669] mb-6 shadow-[0_0_40px_rgba(16,185,129,0.3)] border border-[#34d399]/30"
          >
            <Flag className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">HorseRacing</h1>
          <p className="text-[#a1a1aa] font-light tracking-wide">Elite Equine Management System</p>
        </div>

        <div className="bg-[#18181b]/80 backdrop-blur-xl border border-[#27272a] rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#52525b] group-focus-within:text-[#10b981] transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#09090b] text-white border border-[#27272a] rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all placeholder:text-[#52525b] font-light"
                  placeholder="name@gmail.com"
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#52525b] group-focus-within:text-[#10b981] transition-colors">
                  <KeyRound className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#09090b] text-white border border-[#27272a] rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all placeholder:text-[#52525b] font-light"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-red-400 text-sm font-medium flex items-center bg-red-400/10 p-3 rounded-lg border border-red-400/20"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white hover:bg-[#f4f4f5] text-black font-medium py-3.5 px-4 rounded-xl transition-all flex items-center justify-center group disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Demo Accounts Section */}
          <div className="mt-8 pt-6 border-t border-[#27272a]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#71717a] flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                Demo Credentials
              </span>
            </div>
            <div className="grid gap-2">
              <button 
                onClick={() => handleDemoClick('trainer@gmail.com')}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#27272a]/50 text-left transition-colors group border border-transparent hover:border-[#3f3f46]/50"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#e4e4e7]">Head Trainer</span>
                  <span className="text-xs text-[#a1a1aa] font-mono">trainer@gmail.com</span>
                </div>
                <div className="text-xs text-[#10b981] opacity-0 group-hover:opacity-100 transition-opacity bg-[#10b981]/10 px-2 py-1 rounded">Auto-fill</div>
              </button>
              <button 
                onClick={() => handleDemoClick('manager@gmail.com')}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#27272a]/50 text-left transition-colors group border border-transparent hover:border-[#3f3f46]/50"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#e4e4e7]">Club Manager</span>
                  <span className="text-xs text-[#a1a1aa] font-mono">manager@gmail.com</span>
                </div>
                <div className="text-xs text-[#10b981] opacity-0 group-hover:opacity-100 transition-opacity bg-[#10b981]/10 px-2 py-1 rounded">Auto-fill</div>
              </button>
              <button 
                onClick={() => handleDemoClick('owner@gmail.com')}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#27272a]/50 text-left transition-colors group border border-transparent hover:border-[#3f3f46]/50"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#e4e4e7]">Horse Owner</span>
                  <span className="text-xs text-[#a1a1aa] font-mono">owner@gmail.com</span>
                </div>
                <div className="text-xs text-[#10b981] opacity-0 group-hover:opacity-100 transition-opacity bg-[#10b981]/10 px-2 py-1 rounded">Auto-fill</div>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};