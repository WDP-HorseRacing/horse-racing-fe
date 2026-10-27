// Hiện lỗi của từng ô theo cách của HorseForm: ô đã rời (blur) hoặc đã bấm gửi thì hiện, chưa chạm thì im.
// Lỗi backend gắn với một ô luôn hiện; form tự gọi action.clearError() khi người dùng sửa ô đó.
import { useCallback, useState } from 'react';
import { scrollToFirstError } from '../components/ui';

interface ServerErrors {
  fieldErrors?: Record<string, string>;
  field?: string;
  error?: string;
}

export function useFormErrors<K extends string>(errors: Partial<Record<K, string>>, server?: ServerErrors) {
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [attempted, setAttempted] = useState(false);

  const touch = useCallback((key: K) => setTouched((current) => (current[key] ? current : { ...current, [key]: true })), []);

  /** Lỗi đang hiện của một ô. */
  const show = (key: K): string | undefined =>
    server?.fieldErrors?.[key] ?? (server?.field === key ? server.error : touched[key] || attempted ? errors[key] : undefined);

  /** Handler cho Field onBlur. */
  const blur = (key: K) => () => touch(key);

  const hasErrors = Object.values(errors).some(Boolean);

  /** Bấm gửi: bật hiện mọi lỗi, cuộn tới ô lỗi đầu tiên. Trả true khi gửi được. */
  const attempt = (root?: ParentNode) => {
    setAttempted(true);
    if (hasErrors) {
      scrollToFirstError(root);
      return false;
    }
    return true;
  };

  const reset = useCallback(() => {
    setTouched({});
    setAttempted(false);
  }, []);

  return { show, touch, blur, attempt, reset, attempted, hasErrors };
}
