import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, KeyRound, Mail } from 'lucide-react';
import { Logo } from '../components/Logo';
import { PasswordInput } from '../components/ui';
import gsap from 'gsap';
import { useStore } from '../store/store';
import { safeInternalPath } from '../lib/links';

const REASON_TEXT: Record<string, string> = {
  expired: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.',
  elsewhere: 'Bạn đã đăng xuất ở một tab khác. Đăng nhập lại để tiếp tục.',
};

/** Trang quay lại sau khi đăng nhập: chỉ đường dẫn nội bộ, không quay lại chính trang đăng nhập. */
function safeNext(value: string | null) {
  const path = safeInternalPath(value);
  return path && !path.startsWith('/login') ? path : '/dashboard';
}

export const Login = () => {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const reason = REASON_TEXT[params.get('reason') ?? ''];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useStore((state) => state.login);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);

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
      navigate(next, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không đăng nhập được, vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated && !isLoading) return <Navigate to={next} replace />;

  return (
    <div className="flex min-h-screen font-sans">
      {/* Bên trái — ảnh */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        <img
          src="/mike-kotsch-aZ4HBJf8Gmc-unsplash.jpg"
          alt="Ngựa trên đồng cỏ của trường đua"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gray-950/45" />

        <div className="relative z-10 flex flex-col justify-end p-12 pb-16">
          <Link
            to="/"
            className="absolute left-8 top-8 flex items-center gap-2.5 text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Về trang chủ</span>
          </Link>

          <div className="mb-6">
            <Logo size={40} textClassName="text-xl text-white" />
          </div>
          <p className="max-w-sm text-base leading-relaxed text-white/85">
            Hệ thống quản lý câu lạc bộ ngựa đua. Hồ sơ đàn ngựa, chuồng trại và y tế trong một nơi duy nhất.
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
            <p className="text-gray-500">Dùng tài khoản câu lạc bộ cấp cho bạn.</p>
          </div>

          {reason && (
            <div className="mb-6 flex items-start gap-3 rounded-xl bg-amber-50/70 p-3.5 text-sm text-amber-900 ring-1 ring-amber-200/70" data-form-reveal role="status">
              <Clock size={17} className="mt-0.5 shrink-0" />
              {reason}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5" data-form-reveal>
            <div className="space-y-4">
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-300 transition-colors group-focus-within:text-gray-500">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 text-gray-900 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                  placeholder="ten@horseracing.vn"
                  required
                />
              </div>

              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-4 text-gray-300 transition-colors group-focus-within:text-gray-500">
                  <KeyRound className="h-5 w-5" />
                </div>
                <PasswordInput
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="rounded-xl bg-gray-50 py-3.5 pl-12 text-base focus:bg-white focus:ring-emerald-500/10"
                  placeholder="••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-white p-3 text-sm font-medium text-red-700 shadow-[inset_3px_0_0_0_#ef4444] ring-1 ring-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="group flex w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-3.5 font-semibold text-white transition-colors duration-150 hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
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

          <p className="mt-8 text-xs leading-relaxed text-gray-400" data-form-reveal>
            Chưa có tài khoản hoặc quên mật khẩu? Liên hệ Quản lý câu lạc bộ để được cấp lại.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
