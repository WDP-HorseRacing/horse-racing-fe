// Đếm số việc đang tải (gọi API qua useService, tải trang lazy) để thanh tiến trình trên cùng biết khi nào chạy.
type Listener = (active: number) => void;

let active = 0;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((listener) => listener(active));

export function trackStart() {
  active += 1;
  emit();
}

export function trackDone() {
  active = Math.max(0, active - 1);
  emit();
}

/** Theo dõi một promise: bắt đầu ngay, kết thúc khi xong (kể cả lỗi). */
export function track<T>(promise: Promise<T>): Promise<T> {
  trackStart();
  return promise.finally(trackDone);
}

export function subscribeProgress(listener: Listener) {
  listeners.add(listener);
  listener(active);
  return () => {
    listeners.delete(listener);
  };
}
