import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError } from '../lib/errors';
import { track } from '../lib/progress';

interface State<T> {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
}

export interface ServiceOptions {
  /** Không chạy thanh tiến trình trên cùng (ví dụ hộp thoại xem trước). */
  silent?: boolean;
}

/**
 * Gọi một hàm service và theo dõi trạng thái tải.
 * `deps` đổi thì gọi lại; `reload()` để gọi lại thủ công sau khi ghi dữ liệu.
 * Đang tải lại thì giữ dữ liệu cũ (`refreshing`), thanh tiến trình trên cùng báo đang tải.
 */
export function useService<T>(fn: () => Promise<T>, deps: unknown[] = [], options: ServiceOptions = {}) {
  const silent = options.silent ?? false;
  const [state, setState] = useState<State<T>>({ data: undefined, loading: true, error: undefined });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    const run = fnRef.current();
    (silent ? run : track(run))
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: undefined });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          data: undefined,
          loading: false,
          error: error instanceof Error ? error.message : 'Đã xảy ra lỗi',
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { ...state, refreshing: state.loading && state.data !== undefined, reload };
}

const NO_FIELD_ERRORS: Record<string, string> = {};

/**
 * Bọc một thao tác ghi: trả về hàm chạy, trạng thái đang gửi và lỗi tiếng Việt.
 * `fieldErrors` là lỗi theo từng ô backend trả về (tên ô trong body → câu lỗi).
 */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [field, setField] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>(NO_FIELD_ERRORS);

  const run = useCallback(async <T,>(fn: () => Promise<T>, onDone?: (result: T) => void) => {
    setPending(true);
    setError(undefined);
    setField(undefined);
    setFieldErrors(NO_FIELD_ERRORS);
    try {
      const result = await track(fn());
      onDone?.(result);
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Đã xảy ra lỗi');
      if (caught instanceof AppError) {
        setField(caught.field);
        setFieldErrors(caught.fieldErrors);
      }
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(undefined);
    setField(undefined);
    setFieldErrors(NO_FIELD_ERRORS);
  }, []);

  return { run, pending, error, field, fieldErrors, clearError };
}
