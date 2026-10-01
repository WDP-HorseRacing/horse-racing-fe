// Cuộn tới một ô của biểu mẫu (theo data-field của Field) và đặt con trỏ vào đó.
export function focusField(name: string, root: ParentNode = document) {
  window.requestAnimationFrame(() => {
    const field = root.querySelector<HTMLElement>(`[data-field="${name}"]`);
    if (!field) return;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.querySelector<HTMLElement>('input, select, textarea, button')?.focus({ preventScroll: true });
  });
}
