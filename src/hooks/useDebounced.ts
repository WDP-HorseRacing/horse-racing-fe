import { useEffect, useState } from 'react';

/**
 * Trả về giá trị chỉ sau khi `value` ngừng đổi `delay` ms.
 * Dùng cho ô tìm kiếm gọi API: gõ liền mạch chỉ tạo một lời gọi, không bắn một lời gọi mỗi phím.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
