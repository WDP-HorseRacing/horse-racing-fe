// Màu nhận diện vai trò, chỉ dùng ở khung giao diện: ô logo, favicon, nhãn vai trò, vạch menu đang chọn.
// Nút bấm, màu trạng thái và biểu đồ vẫn giữ xanh cỏ để cùng một trạng thái có cùng màu ở mọi vai trò.
import type { CSSProperties } from 'react';
import type { UserRole } from '../types/domain';
import { HORSE_PATH, HORSE_VIEWBOX } from '../components/horse-path';

export interface RoleTheme {
  /** Màu chính: nền ô logo, favicon, chữ nhãn vai trò, vạch menu. */
  color: string;
  /** Nền nhạt cho nhãn vai trò và mục menu đang chọn. */
  soft: string;
  /** Viền nhạt của nhãn vai trò. */
  ring: string;
  /** Bóng đổ có màu dưới ô logo. */
  shadow: string;
}

/** Xanh cỏ thương hiệu: màu của Quản lý câu lạc bộ, trang đăng nhập và trang giới thiệu. */
export const BRAND_COLOR = '#047857';

export const roleTheme: Record<UserRole, RoleTheme> = {
  CLUB_MANAGER: { color: BRAND_COLOR, soft: '#ecfdf5', ring: '#a7f3d0', shadow: 'rgba(4,120,87,0.7)' },
  HEAD_TRAINER: { color: '#1d4ed8', soft: '#eff6ff', ring: '#bfdbfe', shadow: 'rgba(29,78,216,0.55)' },
  VETERINARIAN: { color: '#be185d', soft: '#fdf2f8', ring: '#fbcfe8', shadow: 'rgba(190,24,93,0.55)' },
  GROOM: { color: '#8a5a2b', soft: '#faf5ef', ring: '#e8d5bf', shadow: 'rgba(138,90,43,0.55)' },
  HORSE_OWNER: { color: '#374151', soft: '#f3f4f6', ring: '#d1d5db', shadow: 'rgba(55,65,81,0.55)' },
};

/** Biến CSS theo vai trò, gắn ở khung ngoài để các phần con dùng `var(--role)`. */
export function roleCssVars(role: UserRole): CSSProperties {
  const theme = roleTheme[role];
  return { '--role': theme.color, '--role-soft': theme.soft, '--role-ring': theme.ring } as CSSProperties;
}

/** Favicon cùng hình với public/favicon.svg, chỉ đổi màu nền ô. */
export function faviconHref(color: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#f3e3b5"/></linearGradient></defs>` +
    `<rect width="32" height="32" rx="8" fill="${color}"/>` +
    `<svg x="3" y="3" width="26" height="26" viewBox="${HORSE_VIEWBOX}">` +
    `<path d="${HORSE_PATH}" fill="url(#g)" stroke="url(#g)" stroke-width="24" stroke-linejoin="round" fill-rule="evenodd"/>` +
    `</svg></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Tiêu đề tab mặc định (khớp index.html), dùng khi chưa đăng nhập. */
export const DEFAULT_TITLE = 'HorseRacing · Quản lý huấn luyện ngựa đua';
export const DEFAULT_FAVICON = '/favicon.svg';
