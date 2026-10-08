// Đăng ký plugin GSAP một lần cho các trang huấn luyện (đã tải lười nên không nặng gói đầu).
// GSAP 3.15 đã kèm mọi plugin. Mọi hoạt ảnh nằm trong useGSAP({ scope }) để tự dọn khi rời trang.
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, Flip, DrawSVGPlugin, CustomEase, ScrollTrigger);

/** Nhịp tim hai pha (lub dub): phồng nhanh, xẹp, phồng nhẹ lần hai, nghỉ. */
CustomEase.create('heartbeat', 'M0,0 C0.08,0 0.1,1 0.16,1 0.22,1 0.24,0.25 0.3,0.25 0.36,0.25 0.38,0.62 0.44,0.62 0.52,0.62 0.56,0 1,0');

/** Điều kiện chạy hoạt ảnh đầy đủ (người dùng không bật giảm chuyển động). */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

export { gsap, useGSAP, Flip, ScrollTrigger };
