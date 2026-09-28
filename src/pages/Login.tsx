import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Flag, KeyRound, Mail, Users } from 'lucide-react';
import gsap from 'gsap';
import { useStore } from '../store/store';
import { listAccounts, SHARED_PASSWORD } from '../services/auth.service';
import { roleLabel } from '../lib/labels';
import { getDb } from '../services/db';
import { managedZoneIds } from '../services/selectors';
import { Avatar } from '../components/ui';
import type { UserRole } from '../types/domain';

const roleOrder: UserRole[] = ['CLUB_MANAGER', 'HEAD_TRAINER', 'VETERINARIAN', 'GROOM', 'HORSE_OWNER'];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useStore((state) => state.login);
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);

  const accounts = useMemo(() => listAccounts(), []);
  const grouped = useMemo(
    () =>
      roleOrder.map((role) => ({
        role,
        users: accounts.filter((user) => user.role === role),
      })),
    [accounts],
  );

  useEffect(() => {
    if (!formRef.current) return;
    const elements = formRef.current.querySelectorAll('[data-form-reveal]');
    const tween = gsap.fromTo(
      elements,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out', delay: 0.15 },
    );
    return () => {
      tween.kill();
    };
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không đăng nhập được, vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const quickFill = (value: string) => {
    setEmail(value);
    setPassword(SHARED_PASSWORD);
    setError('');
  };

  return (
    <div className="flex min-h-screen font-sans">
      {/* Bên trái — ảnh */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        <img
          src="/mike-kotsch-aZ4HBJf8Gmc-unsplash.jpg"
          alt="Ngựa trên đồng cỏ của trường đua"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/60 to-emerald-800/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        <div className="relative z-10 flex flex-col justify-end p-12 pb-16">
          <Link
            to="/"
            className="absolute left-8 top-8 flex items-center gap-2.5 text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Về trang chủ</span>
          </Link>

          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 backdrop-blur-sm">
              <Flag size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">HorseRacing</span>
          </div>
          <p className="max-w-sm text-base font-light leading-relaxed text-white/70">
            Hệ thống quản lý huấn luyện ngựa đua. Hồ sơ đàn ngựa, lớp huấn luyện theo giáo án và y tế trong
            một nơi duy nhất.
          </p>
        </div>
      </div>

      {/* Bên phải — biểu mẫu */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12 sm:px-12">
        <div className="w-full max-w-md" ref={formRef}>
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-600 lg:hidden"
            data-form-reveal
          >
            <ArrowLeft size={16} />
            Về trang chủ
          </Link>

          <div className="mb-10" data-form-reveal>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">Đăng nhập</h1>
            <p className="font-light text-gray-500">Dùng tài khoản câu lạc bộ cấp cho bạn.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5" data-form-reveal>
            <div className="space-y-4">
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-300 transition-colors group-focus-within:text-emerald-500">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 font-light text-gray-900 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                  placeholder="ten@horseracing.vn"
                  required
                />
              </div>

              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-300 transition-colors group-focus-within:text-emerald-500">
                  <KeyRound className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 font-light text-gray-900 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                  placeholder="••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="group flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3.5 font-semibold text-white shadow-md shadow-emerald-600/20 transition-all duration-200 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 border-t border-gray-100 pt-8" data-form-reveal>
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs font-semibold tracking-wide text-gray-400">Chọn nhanh tài khoản</span>
            </div>
            <div className="max-h-72 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
              {grouped.map((group) => (
                <div key={group.role}>
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-gray-300">
                    {roleLabel[group.role]}
                  </p>
                  <div className="space-y-1">
                    {group.users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => quickFill(user.email)}
                        className={`group flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all duration-200 ${
                          email === user.email
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-transparent hover:border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <Avatar name={user.name} size={30} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-700">{user.name}</p>
                          <p className="truncate font-mono text-xs text-gray-400">{user.email}</p>
                        </div>
                        {user.role === 'HEAD_TRAINER' && (
                          <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                            {managedZoneIds(getDb(), user.id)
                              .map((zoneId) => getDb().zones.find((zone) => zone.id === zoneId)?.code)
                              .join(' · ') || 'Chưa có khu'}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
