// Bắt lỗi khi vẽ một trang: lỗi tải mã trang (thường do vừa có bản cập nhật) thì mời tải lại trang,
// lỗi khác thì cho thử lại mà không làm trắng cả ứng dụng.
import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface State {
  error?: Error;
}

export class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = /dynamically imported module|Loading chunk|Failed to fetch/i.test(error.message);
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-gray-200/80">
        <p className="text-lg font-semibold text-gray-900">{chunk ? 'Có phiên bản mới của trang' : 'Trang gặp lỗi khi hiển thị'}</p>
        <p className="text-sm text-gray-500">{chunk ? 'Tải lại trang để dùng bản mới nhất.' : 'Thử lại; nếu vẫn lỗi, tải lại trang hoặc báo nhóm phát triển.'}</p>
        <button
          type="button"
          onClick={() => (chunk ? window.location.reload() : this.setState({ error: undefined }))}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          <RefreshCw size={15} /> {chunk ? 'Tải lại trang' : 'Thử lại'}
        </button>
      </div>
    );
  }
}
