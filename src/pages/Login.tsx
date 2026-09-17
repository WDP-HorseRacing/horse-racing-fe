import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/store';
import { KeyRound, Mail, ArrowRight, ArrowLeft, ShieldCheck, Flag } from 'lucide-react';
import gsap from 'gsap';
import { T } from '../i18n/T';
import { LanguageSwitch } from '../i18n/LanguageSwitch';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useStore(state => state.login);
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!formRef.current) return;
    const elements = formRef.current.querySelectorAll('[data-form-reveal]');
    gsap.fromTo(
      elements,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out', delay: 0.2 }
    );
  }, []);

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
    } catch {
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
    <div className="min-h-screen flex font-sans">
      <div className="fixed right-5 top-5 z-50"><LanguageSwitch /></div>
      {/* Left — Image Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="/mike-kotsch-aZ4HBJf8Gmc-unsplash.jpg"
          alt="Horse on green meadow"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/60 to-emerald-800/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        <div className="relative z-10 flex flex-col justify-end p-12 pb-16">
          <Link to="/" className="absolute top-8 left-8 flex items-center gap-2.5 text-white/80 hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm font-medium"><T>Back to home</T></span>
          </Link>

          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Flag size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white"><T>HorseRacing</T></span>
          </div>
          <p className="text-white/70 text-base font-light max-w-sm leading-relaxed">
            <T>Professional equine training management. Built for trainers, managers, and owners who demand precision.</T>
          </p>
        </div>
      </div>

      {/* Right — Form Panel */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-12 bg-white">
        <div className="w-full max-w-md" ref={formRef}>
          {/* Mobile back link */}
          <Link
            to="/"
            className="lg:hidden inline-flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors mb-8 text-sm"
            data-form-reveal
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>

          <div className="mb-10" data-form-reveal>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2"><T>Welcome back</T></h1>
            <p className="text-gray-500 font-light"><T>Sign in to your account to continue.</T></p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5" data-form-reveal>
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-300 group-focus-within:text-emerald-500 transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:bg-white transition-all placeholder:text-gray-400 font-light"
                  placeholder="name@gmail.com"
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-300 group-focus-within:text-emerald-500 transition-colors">
                  <KeyRound className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:bg-white transition-all placeholder:text-gray-400 font-light"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm font-medium flex items-center bg-red-50 p-3 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center group disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-10 pt-8 border-t border-gray-100" data-form-reveal>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-400 tracking-wide"><T>Demo credentials</T></span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Head Trainer', email: 'trainer@gmail.com', color: 'emerald' },
                { label: 'Club Manager', email: 'manager@gmail.com', color: 'sky' },
                { label: 'Horse Owner', email: 'owner@gmail.com', color: 'amber' },
                { label: 'Veterinarian', email: 'vet@gmail.com', color: 'red' },
                { label: 'Groom', email: 'groom@gmail.com', color: 'emerald' },
              ].map((demo) => (
                <button
                  key={demo.email}
                  onClick={() => handleDemoClick(demo.email)}
                  className="flex items-center justify-between w-full p-3 rounded-xl hover:bg-gray-50 text-left transition-all duration-200 group border border-transparent hover:border-gray-100"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700">{demo.label}</span>
                    <span className="text-xs text-gray-400 font-mono">{demo.email}</span>
                  </div>
                  <span className="text-xs text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-50 px-2.5 py-1 rounded-lg font-medium">
                    Auto-fill
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
