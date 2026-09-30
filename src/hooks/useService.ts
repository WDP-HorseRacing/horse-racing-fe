import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError } from '../lib/errors';

interface State<T> {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
}

/**
 * Gọi một hàm service và theo dõi trạng thái tải.
 * `deps` đổi thì gọi lại; `reload()` để gọi lại thủ công sau khi ghi dữ liệu.
 */
export function useService<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: undefined, loading: true, error: undefined });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    fnRef
      .current()
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
  return { ...state, reload };
}

/** Bọc một thao tác ghi: trả về hàm chạy, trạng thái đang gửi và lỗi tiếng Việt. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [field, setField] = useState<string | undefined>();

  const run = useCallback(async <T,>(fn: () => Promise<T>, onDone?: (result: T) => void) => {
    setPending(true);
    setError(undefined);
    setField(undefined);
    try {
      const result = await fn();
      onDone?.(result);
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Đã xảy ra lỗi');
      if (caught instanceof AppError) setField(caught.field);
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, field, clearError: () => setError(undefined) };
}
