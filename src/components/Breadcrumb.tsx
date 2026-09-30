// Đường dẫn vị trí trên header, bấm được từng đoạn như thanh địa chỉ của File Explorer.
// Mặc định suy ra từ menu (nhóm › mục khớp URL dài nhất). Trang chi tiết khai báo phần đuôi bằng tên thật
// (tên ngựa, tên bệnh án…) qua useCrumbs(); trang nằm ngoài menu khai báo thêm phần gốc.
import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import { create } from 'zustand';
import { cn } from './ui';

export interface Crumb {
  label: string;
  /** Bỏ trống ở đoạn cuối (trang đang xem). */
  to?: string;
}

interface NavLike {
  group?: string;
  items: { name: string; path: string }[];
}

interface Declared {
  path: string;
  tail: Crumb[];
  root?: Crumb[];
}

const useCrumbStore = create<{ declared: Declared | null }>(() => ({ declared: null }));

/**
 * Trang khai báo đoạn cuối của đường dẫn. `root` dùng khi URL không khớp mục menu nào.
 * Truyền null khi dữ liệu chưa tải xong để giữ đường dẫn suy ra từ menu.
 */
export function useCrumbs(tail: Crumb[] | null, root?: Crumb[]) {
  const { pathname } = useLocation();
  const key = JSON.stringify([tail, root]);
  useEffect(() => {
    if (!tail) return;
    useCrumbStore.setState({ declared: { path: pathname, tail, root } });
    return () => {
      if (useCrumbStore.getState().declared?.path === pathname) useCrumbStore.setState({ declared: null });
    };
    // key gói nội dung tail/root: khai báo lại chỉ khi chữ hoặc link đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pathname]);
}

function defaultTail(pathname: string, basePath: string): Crumb[] {
  if (pathname === basePath) return [];
  if (pathname.endsWith('/new')) return [{ label: 'Tạo mới' }];
  if (pathname.endsWith('/edit')) return [{ label: 'Chỉnh sửa' }];
  return [{ label: 'Chi tiết' }];
}

export function Breadcrumbs({ groups }: { groups: NavLike[] }) {
  const { pathname } = useLocation();
  const declared = useCrumbStore((state) => state.declared);

  const { trail, siblings } = useMemo(() => {
    let best: { group?: NavLike; name: string; path: string } | null = null;
    groups.forEach((group) =>
      group.items.forEach((item) => {
        const hit = pathname === item.path || pathname.startsWith(`${item.path}/`);
        if (hit && (!best || item.path.length > best.path.length)) best = { group, name: item.name, path: item.path };
      }),
    );
    const match = best as { group?: NavLike; name: string; path: string } | null;
    const own = declared && declared.path === pathname ? declared : null;

    let base: Crumb[] = [];
    if (own?.root) base = own.root;
    else if (match) {
      if (match.group?.group) base.push({ label: match.group.group, to: match.group.items[0]?.path });
      base.push({ label: match.name, to: match.path });
    }
    const tail = own ? own.tail : match ? defaultTail(pathname, match.path) : [];
    const all = [...base, ...tail];
    // Đoạn cuối là trang đang xem: không bấm.
    const trail = all.map((crumb, index) => (index === all.length - 1 || crumb.to === pathname ? { label: crumb.label } : crumb));
    return { trail, siblings: !own?.root && match?.group?.group ? match.group.items : undefined };
  }, [groups, pathname, declared]);

  if (trail.length === 0) return <span className="truncate text-sm font-semibold text-gray-900">HorseRacing</span>;

  return (
    <nav aria-label="Vị trí trang" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-0.5 text-sm">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          // Màn hẹp chỉ giữ hai đoạn cuối; đoạn đầu tiên còn hiện thì bỏ mũi tên phía trước.
          const hideOnSmall = index < trail.length - 2;
          const separatorClass = index === trail.length - 2 ? 'hidden sm:flex' : '';
          return (
            <li key={`${index}-${crumb.label}`} className={cn('flex min-w-0 items-center gap-0.5', hideOnSmall && 'hidden sm:flex', !last && 'shrink-0')}>
              {index > 0 &&
                (index === 1 && siblings ? (
                  <SiblingMenu items={siblings} pathname={pathname} className={separatorClass} />
                ) : (
                  <ChevronRight size={14} className={cn('shrink-0 text-gray-300', separatorClass)} aria-hidden />
                ))}
              {crumb.to ? (
                <Link
                  to={crumb.to}
                  className="max-w-[14rem] truncate rounded-md px-1.5 py-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn('truncate px-1.5 py-1', last ? 'font-semibold text-gray-900' : 'text-gray-500')}>
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Mũi tên sau tên nhóm: bấm để mở các trang cùng nhóm (như mũi tên giữa hai thư mục trong Explorer). */
function SiblingMenu({ items, pathname, className = '' }: { items: { name: string; path: string }[]; pathname: string; className?: string }) {
  return (
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger
        aria-label="Các trang cùng nhóm"
        className={cn(
          'flex h-6 w-5 shrink-0 items-center justify-center rounded text-gray-300 outline-none transition hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-emerald-500/30 data-[state=open]:rotate-90 data-[state=open]:text-gray-600',
          className,
        )}
      >
        <ChevronRight size={14} />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="start" sideOffset={6} className="anim-pop z-50 min-w-52 rounded-xl bg-white p-1.5 shadow-float ring-1 ring-gray-200">
          {items.map((item) => {
            const current = pathname === item.path || pathname.startsWith(`${item.path}/`);
            return (
              <Dropdown.Item key={item.path} asChild>
                <Link
                  to={item.path}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm outline-none data-highlighted:bg-gray-100',
                    current ? 'font-semibold text-emerald-800' : 'text-gray-700',
                  )}
                >
                  {item.name}
                  {current && <Check size={14} />}
                </Link>
              </Dropdown.Item>
            );
          })}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
