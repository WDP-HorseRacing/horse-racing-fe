// Nút "Quay lại" phía trên tiêu đề trang: về đúng trang người dùng vừa ở (lịch sử điều hướng trong app).
// Mở thẳng bằng link (chưa có lịch sử) thì về trang mặc định `fallback`. Ctrl/Cmd + bấm vẫn mở trang mặc định ở tab mới.
import type { MouseEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from './ui';

/**
 * react-router ghi số thứ tự trang trong tab vào `history.state.idx`: 0 là trang đầu tiên mở trong app.
 * Không dùng `location.key` vì đổi URL kiểu replace (chuyển tab, tạo xong rồi chuyển trang) cũng đổi key
 * dù phía trước không có trang nào của app.
 */
function hasAppHistory() {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' && state.idx > 0;
}

export function BackLink({ fallback, children = 'Quay lại', className }: { fallback: string; children?: ReactNode; className?: string }) {
  const navigate = useNavigate();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (hasAppHistory()) navigate(-1);
    else navigate(fallback);
  };

  return (
    <Link to={fallback} onClick={onClick} className={cn('inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900', className)}>
      <ArrowLeft size={15} /> {children}
    </Link>
  );
}
