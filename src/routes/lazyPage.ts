// Tải trang theo nhu cầu (code splitting). Mỗi trang chỉ tải một lần, lỗi mạng thì lần sau thử lại;
// thanh tiến trình trên cùng chạy trong lúc tải (react-router giữ trang cũ trên màn hình khi chuyển trang).
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { track } from '../lib/progress';

export type LazyPage = LazyExoticComponent<ComponentType> & { preload: () => void };

export function lazyPage(factory: () => Promise<{ default: ComponentType }>): LazyPage {
  let promise: Promise<{ default: ComponentType }> | undefined;
  const load = () => {
    promise ??= track(factory()).catch((error: unknown) => {
      promise = undefined;
      throw error;
    });
    return promise;
  };
  const page = lazy(load) as LazyPage;
  page.preload = () => {
    load().catch(() => undefined);
  };
  return page;
}
