// Trang Keycloak quay về sau khi đăng nhập Google: /auth/callback?code&state (hoặc ?error=).
// Đổi mã lấy token qua BE rồi vào trang đích. Mã PKCE chỉ dùng được một lần, mà StrictMode chạy effect hai lần,
// nên mỗi `state` chỉ gọi BE một lần (Map ở mức module) và chỉ xóa thông tin chờ khi đã có kết quả.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useStore } from '../store/store';
import type { User } from '../types/domain';
import { clearPendingOidc, oidcErrorMessage, peekPendingOidc, safeNextPath, setOidcError } from '../lib/oidc';

const inflight = new Map<string, Promise<User>>();

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const loginWithOidc = useStore((state) => state.loginWithOidc);
  const [failed, setFailed] = useState<string>();

  useEffect(() => {
    let active = true;
    const pending = peekPendingOidc();
    const provider = pending?.provider ?? 'google';
    const fail = (message: string) => {
      clearPendingOidc();
      if (!active) return;
      setOidcError(message);
      const next = pending?.next && pending.next !== '/dashboard' ? `?next=${encodeURIComponent(pending.next)}` : '';
      navigate(`/login${next}`, { replace: true });
    };

    const keycloakError = params.get('error');
    if (keycloakError) {
      fail(oidcErrorMessage(undefined, keycloakError));
      return () => {
        active = false;
      };
    }
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) {
      setFailed('Liên kết đăng nhập không hợp lệ.');
      return () => {
        active = false;
      };
    }

    let job = inflight.get(state);
    if (!job) {
      job = loginWithOidc(provider, {
        code,
        state,
        session_state: params.get('session_state') ?? undefined,
        iss: params.get('iss') ?? undefined,
      });
      inflight.set(state, job);
    }
    job
      .then(() => {
        clearPendingOidc();
        // replace: bỏ mã khỏi lịch sử trình duyệt.
        if (active) navigate(safeNextPath(pending?.next), { replace: true });
      })
      .catch((caught: unknown) => fail(oidcErrorMessage(caught)));
    return () => {
      active = false;
    };
  }, [params, navigate, loginWithOidc]);

  return (
    <div className="turf-dark flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center text-white">
      <Logo size={44} textClassName="text-xl text-white" />
      {failed ? (
        <div className="max-w-sm space-y-4">
          <p className="text-base text-white/85">{failed}</p>
          <Link to="/login" className="inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">
            Về trang đăng nhập
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3" role="status">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          <p className="text-sm text-white/80">Đang hoàn tất đăng nhập với Google…</p>
        </div>
      )}
    </div>
  );
}
