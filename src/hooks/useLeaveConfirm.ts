import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Chặn người dùng vô tình thoát trang khi có dữ liệu chưa lưu.
 * Hoạt động cả với thao tác đóng/tải lại tab (trình duyệt tự hiện hộp thoại)
 * và chuyển trang trong SPA bằng react-router (dùng window.confirm).
 * 
 * @param isDirty Có dữ liệu chưa lưu hay không
 * @param message Tin nhắn hiển thị khi chuyển trang trong SPA
 */
export function useLeaveConfirm(isDirty: boolean, message = 'Hồ sơ có thay đổi chưa lưu. Bạn có chắc chắn muốn thoát không?') {
  // 1. Chặn người dùng đóng tab, tải lại trang (trình duyệt sẽ tự dùng thông báo mặc định)
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = ''; // Bắt buộc cho một số trình duyệt để hiện hộp thoại
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // 2. Chặn chuyển trang trong React Router
  useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => {
        if (isDirty && currentLocation.pathname !== nextLocation.pathname) {
          const confirmLeave = window.confirm(message);
          return !confirmLeave; // Chặn (return true) nếu người dùng bấm Hủy
        }
        return false;
      },
      [isDirty, message]
    )
  );
}
