// Danh sách ảnh chụp cho SRS. capture_srs_screenshots.mjs đọc file này.
// Mỗi shot: file, user, viewport (desktop | mobile), steps. Bước: goto, follow (mở link chứa chữ, thêm query), click,
// clickSel, type, waitText, scrollTo, scroll, key, wait. Tên file khớp với docs/srs_body.py.
// ONLY: chỉ chụp các file trong danh sách (để trống thì chụp hết).
// Chỉ mở trang/dialog, KHÔNG bấm Lưu/Gửi.

const CM = 'club.manager@horse.io.vn';
const HT = 'head.trainer@horse.io.vn';
const VET = 'veterinarian@horse.io.vn';
const GROOM = 'groom@horse.io.vn';
const OWNER = 'horse.owner@horse.io.vn';
const HT2 = 'head.trainer2@horse.io.vn'; // có thể không tồn tại trên prod: lỗi thì script bỏ qua

export const ONLY = [
  'scr_2_4_hr_history.png',
];

export const SHOTS = [
  /* ===== Club Manager ===== */
  { file: 'scr_0_dashboard_cm.png', user: CM, steps: [{ goto: '/dashboard', wait: 2500 }] },
  { file: 'scr_1_1a_horse_list.png', user: CM, steps: [{ goto: '/horses', wait: 2000 }] },
  { file: 'scr_1_1b_horse_create.png', user: CM, steps: [{ goto: '/horses/new', wait: 1500 }] },
  { file: 'scr_1_1c_pedigree.png', user: CM, steps: [{ goto: '/horses', wait: 2000 }, { follow: 'Phong Vân', query: 'tab=pedigree', wait: 2500 }] },
  { file: 'scr_4_5_supplies.png', user: CM, steps: [{ goto: '/supplies', wait: 2000 }] },
  { file: 'scr_5_1_admin_users.png', user: CM, steps: [{ goto: '/admin/users', wait: 2000 }] },
  { file: 'scr_5_2_daily_fees.png', user: CM, steps: [{ goto: '/admin/fees', wait: 2000 }] },
  { file: 'scr_5_3_audit_log.png', user: CM, steps: [{ goto: '/admin/audit', wait: 2000 }] },
  { file: 'scr_5_4_reports.png', user: CM, steps: [{ goto: '/reports', wait: 2500 }] },

  /* ===== Head Trainer ===== */
  { file: 'scr_1_2a_stable_map.png', user: HT, steps: [{ goto: '/stable', wait: 2500 }] },
  { file: 'scr_1_2b_assign_stall.png', user: HT, steps: [{ goto: '/stable', wait: 2500 }, { click: 'Phong Vân', selector: 'button', wait: 1000 }, { click: 'Chuyển ô', wait: 1800 }] },
  { file: 'scr_1_3_assign_groom.png', user: HT, steps: [{ goto: '/stable', wait: 2500 }, { click: 'Phong Vân', selector: 'button', wait: 1000 }, { click: 'Giao / đổi Groom', wait: 1800 }] },
  { file: 'scr_1_4_measurements.png', user: HT, steps: [{ goto: '/horses', wait: 2000 }, { follow: 'Xích Thố', query: 'tab=body', wait: 2500 }] },
  { file: 'scr_2_1_plan_detail.png', user: HT, steps: [{ goto: '/training/plans', wait: 2500 }] },
  { file: 'scr_2_2_class_detail.png', user: CM, steps: [{ goto: '/training/classes', wait: 2500 }, { clickSel: 'main a[href*="/training/classes/"]:not([href$="/new"])', wait: 3000 }] },
  { file: 'scr_2_2c_class_create.png', user: HT, steps: [{ goto: '/training/classes/new', wait: 3000 }] },
  { file: 'scr_2_2b_enroll.png', user: HT2, steps: [{ goto: '/training/classes', wait: 2500 }, { clickSel: 'main a[href*="/training/classes/"]:not([href$="/new"])', wait: 3000 }, { click: 'Ngựa trong lớp', wait: 1500 }, { click: 'Ghi danh ngựa', wait: 2500 }] },
  { file: 'scr_2_3a_session_board.png', user: CM, steps: [{ goto: '/training/classes', wait: 2500 }, { clickSel: 'main a[href*="/training/classes/"]:not([href$="/new"])', wait: 3000 }, { click: 'Lịch buổi', wait: 1500 }, { click: 'Kiểm tra 1200m 15:30', wait: 4000 }] },
  { file: 'scr_2_4_hr_history.png', user: CM, steps: [{ goto: '/horses', wait: 2000 }, { follow: 'Đại Bàng', query: 'tab=training', wait: 3500 }, { clickSel: 'main a[href*="/training/participants/"]', wait: 4000 }, { scrollTo: 'Nhịp tim và tốc độ theo thời gian', wait: 2500 }] },
  { file: 'scr_2_5_class_results.png', user: CM, steps: [{ goto: '/training/classes', wait: 2500 }, { clickSel: 'main a[href*="/training/classes/"]:not([href$="/new"])', wait: 3000 }, { click: 'Kết quả', wait: 2500 }] },
  { file: 'scr_3_1_exam_request.png', user: HT, steps: [{ goto: '/medical/requests', wait: 2000 }, { click: 'Gửi yêu cầu khám', wait: 1500 }] },
  { file: 'scr_4_1_feeding_plan.png', user: HT, steps: [{ goto: '/stable/care', wait: 2500 }] },
  { file: 'scr_4_4b_incidents.png', user: HT, steps: [{ goto: '/stable/incidents', wait: 2000 }] },

  /* ===== Veterinarian ===== */
  { file: 'scr_3_0_medical_board.png', user: VET, steps: [{ goto: '/medical/board', wait: 2500 }] },
  { file: 'scr_3_2_visit_3d.png', user: VET, steps: [{ goto: '/medical/cases', wait: 2500 }, { click: 'Hắc Phong', wait: 3000 }, { click: 'Ghi buổi tái khám', selector: 'button, a', wait: 4000 }, { scrollTo: 'Chấn thương và hẹn tái khám', wait: 3000 }] },
  { file: 'scr_3_2b_injury_3d.png', user: VET, steps: [{ goto: '/medical/cases', wait: 2500 }, { click: 'Hắc Phong', wait: 3000 }, { click: 'Chấn thương', selector: '[role="tab"], button', wait: 4000 }] },
  { file: 'scr_3_3_case_detail.png', user: VET, steps: [{ goto: '/medical/cases', wait: 2500 }, { click: 'Hắc Phong', wait: 3000 }] },
  { file: 'scr_3_3_lock.png', user: VET, steps: [{ goto: '/medical/cases', wait: 2500 }, { click: 'Hắc Phong', wait: 3000 }, { click: 'Gỡ khóa', selector: 'button', wait: 1800 }] },
  { file: 'scr_3_4_case_close.png', user: VET, steps: [{ goto: '/medical/cases', wait: 2500 }, { click: 'Hắc Phong', wait: 3000 }, { follow: 'Bong gân và tràn dịch', wait: 3000 }, { click: 'Đóng bệnh án', selector: 'button', wait: 3500 }] },

  /* ===== Groom (mobile) ===== */
  { file: 'scr_4_2_groom_today.png', user: GROOM, viewport: 'mobile', steps: [{ goto: '/dashboard', wait: 3000 }] },
  { file: 'scr_4_3_photo_proof.png', user: GROOM, viewport: 'mobile', steps: [{ goto: '/dashboard', wait: 3000 }, { scrollTo: 'Chụp / Tải ảnh', block: 'center', offset: 0 }] },
  { file: 'scr_2_3b_training_today_groom.png', user: GROOM, viewport: 'mobile', steps: [{ goto: '/training/today', wait: 2500 }] },
  { file: 'scr_4_4a_report_incident.png', user: GROOM, viewport: 'mobile', steps: [{ goto: '/dashboard', wait: 3000 }, { click: 'Báo sự cố', wait: 1500 }] },

  /* ===== Owner ===== */
  { file: 'scr_6_1_owner_dashboard.png', user: OWNER, steps: [{ goto: '/dashboard', wait: 2500 }] },
  { file: 'scr_6_2_owner_costs.png', user: OWNER, steps: [{ goto: '/reports/my-costs', wait: 2500 }] },
];
