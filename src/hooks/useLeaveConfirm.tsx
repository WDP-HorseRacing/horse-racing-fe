import { useEffect, useCallback, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmDialog } from '../components/ui';

/**
 * Chặn người dùng vô tình thoát trang khi có dữ liệu chưa lưu.
 * Hoạt động cả với thao tác đóng/tải lại tab (trình duyệt tự hiện hộp thoại)
 * và chuyển trang trong SPA bằng react-router (dùng Modal).
 * 
 * @param isDirty Có dữ liệu chưa lưu hay không
 * @param message Tin nhắn hiển thị khi chuyển trang trong SPA
 */
export function useLeaveConfirm(isDirty: boolean, message = 'Hồ sơ có thay đổi chưa lưu. Bạn có chắc chắn muốn rời khỏi trang này? Những thay đổi của bạn sẽ bị mất.') {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // 1. Chặn người dùng đóng tab, tải lại trang (trình duyệt sẽ tự dùng thông báo mặc định)
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        event.preventDefault();
        event.returnValue = ''; // Bắt buộc cho một số trình duyệt để hiện hộp thoại
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // 2. Chặn chuyển trang trong React Router
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => {
        if (isDirtyRef.current && currentLocation.pathname !== nextLocation.pathname) {
          return true; // Block the navigation
        }
        return false;
      },
      []
    )
  );

  const confirmModal = (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onClose={() => blocker.state === 'blocked' && blocker.reset()}
      title="Dữ liệu chưa được lưu"
      message={message}
      confirmLabel="Vẫn rời đi"
      danger
      onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
    />
  );

  return confirmModal;
}
