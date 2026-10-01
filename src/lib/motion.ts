// Người dùng bật "giảm chuyển động" trong hệ điều hành thì bỏ qua hiệu ứng gsap.
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
