// Đăng nhập: bên trái video trường đua phủ xanh rừng, bên phải biểu mẫu. Hai cách đăng nhập:
// Google (Keycloak, tài khoản Google phải trùng email đã được cấp) hoặc email + mật khẩu.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Clock, HeartPulse, KeyRound, Mail, MapPinned, ScrollText } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Logo } from '../components/Logo';
import { PasswordInput } from '../components/ui';
import { useStore } from '../store/store';
import { oidcStartUrl } from '../api/auth';
import { rememberOidc, safeNextPath, takeOidcError } from '../lib/oidc';
import { prefersReducedMotion } from '../lib/motion';

gsap.registerPlugin(useGSAP);

const REASON_TEXT: Record<string, string> = {
  expired: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.',
  elsewhere: 'Bạn đã đăng xuất ở một tab khác. Đăng nhập lại để tiếp tục.',
};

const HIGHLIGHTS = [
  { icon: ScrollText, label: 'Hồ sơ và phả hệ ngựa' },
  { icon: MapPinned, label: 'Sơ đồ chuồng theo khu' },
  { icon: HeartPulse, label: 'Y tế và khóa huấn luyện' },
];

/** Chữ G nhiều màu của Google. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export const Login = () => {
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const reason = REASON_TEXT[params.get('reason') ?? ''];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  // Lỗi từ trang /auth/callback (hủy đăng nhập, tài khoản chưa được cấp…), lấy một lần.
  const [oidcError] = useState(() => takeOidcError());
  const [reduced] = useState(() => prefersReducedMotion());
  const login = useStore((state) => state.login);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reduced) return;
      gsap.from('[data-hero-line]', { yPercent: 60, opacity: 0, duration: 0.9, stagger: 0.09, ease: 'power4.out', delay: 0.15 });
      gsap.from('[data-hero-chip]', { y: 12, opacity: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out', delay: 0.5 });
      gsap.from('[data-form-reveal]', { y: 18, opacity: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out', delay: 0.1 });
    },
    { scope: root },
  );

  // Quay lại bằng nút Back sau khi đã sang Google: bỏ trạng thái "đang chuyển".
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setGooglePending(false);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
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

  const loginWithGoogle = () => {
    setGooglePending(true);
    rememberOidc('google', next);
    window.location.assign(oidcStartUrl('google'));
  };

  if (isAuthenticated && !isLoading) return <Navigate to={next} replace />;

  return (
    <div ref={root} className="flex min-h-screen bg-white font-sans">
      {/* Bên trái — video trường đua, phủ xanh rừng */}
      <div className="relative hidden overflow-hidden bg-emerald-950 lg:flex lg:w-[56%]">
        {reduced ? (
          <img src="/mike-kotsch-aZ4HBJf8Gmc-unsplash.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="/13486027_1920_1080_25fps.mp4"
            poster="/mike-kotsch-aZ4HBJf8Gmc-unsplash.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-emerald-950 via-emerald-950/55 to-emerald-950/25" />
        <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center justify-between">
            <Logo size={40} textClassName="text-xl text-white" />
            <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white/85 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15 hover:text-white">
              <ArrowLeft size={15} /> Về trang chủ
            </Link>
          </div>

          <div className="max-w-xl">
            <h2 className="overflow-hidden text-5xl font-bold leading-[1.05] tracking-tight text-white xl:text-6xl">
              <span data-hero-line className="block">
                Đàn ngựa của bạn,
              </span>
              <span data-hero-line className="block text-emerald-300">
                trong một tầm nhìn.
              </span>
            </h2>
            <p data-hero-line className="mt-5 max-w-md text-base leading-relaxed text-white/75">
              Hồ sơ lý lịch, chuồng trại và y tế của câu lạc bộ — mỗi vai trò thấy đúng phần việc của mình.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {HIGHLIGHTS.map(({ icon: Icon, label }) => (
                <span key={label} data-hero-chip className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-sm text-white/90 ring-1 ring-white/15 backdrop-blur">
                  <Icon size={15} className="text-emerald-300" /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bên phải — biểu mẫu */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-between lg:hidden" data-form-reveal>
            <Logo size={36} />
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-600">
              <ArrowLeft size={16} /> Trang chủ
            </Link>
          </div>

          <div className="mb-8" data-form-reveal>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">Đăng nhập</h1>
            <p className="text-gray-500">Dùng tài khoản câu lạc bộ cấp cho bạn.</p>
          </div>

          {reason && (
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-amber-50/70 p-3.5 text-sm text-amber-900 ring-1 ring-amber-200/70" data-form-reveal role="status">
              <Clock size={17} className="mt-0.5 shrink-0" />
              {reason}
            </div>
          )}
          {oidcError && (
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-red-50/70 p-3.5 text-sm text-red-800 ring-1 ring-red-200/70" data-form-reveal role="alert">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              {oidcError}
            </div>
          )}

          <div data-form-reveal>
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={googlePending || isLoading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-[15px] font-semibold text-gray-800 ring-1 ring-gray-200 transition hover:bg-emerald-50/40 hover:shadow-[0_14px_30px_-20px_rgba(6,78,59,0.55)] hover:ring-emerald-300 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
            >
              {googlePending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" /> : <GoogleMark />}
              {googlePending ? 'Đang chuyển tới Google…' : 'Tiếp tục với Google'}
            </button>
          </div>

          <div className="my-6 flex items-center gap-4 text-xs text-gray-400" data-form-reveal>
            <span className="h-px flex-1 bg-gray-200" />
            hoặc dùng email
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleLogin} className="space-y-5" data-form-reveal>
            <div className="space-y-4">
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-300 transition-colors group-focus-within:text-emerald-600">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 text-gray-900 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                  placeholder="ten@horseracing.vn"
                  aria-label="Email"
                  required
                />
              </div>

              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-4 text-gray-300 transition-colors group-focus-within:text-emerald-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <PasswordInput
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="rounded-xl bg-gray-50 py-3.5 pl-12 text-base focus:bg-white focus:ring-emerald-500/10"
                  placeholder="Mật khẩu"
                  aria-label="Mật khẩu"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-white p-3 text-sm font-medium text-red-700 shadow-[inset_3px_0_0_0_#ef4444] ring-1 ring-red-200" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || googlePending}
              className="group flex h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 font-semibold text-white shadow-[0_16px_30px_-18px_rgba(6,78,59,0.9)] transition-colors duration-150 hover:bg-emerald-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
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
            Đăng nhập Google chỉ dùng được với email đã được Quản lý câu lạc bộ cấp tài khoản. Chưa có tài khoản hoặc quên mật khẩu? Liên hệ Quản lý câu lạc bộ.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
