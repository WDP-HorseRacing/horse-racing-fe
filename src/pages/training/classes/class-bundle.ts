// Dữ liệu một lớp tải một lần ở trang chi tiết lớp, chia cho các tab.
import type { ClassPlan, ClassProgress, Enrollment, TrainingClass, TrainingPlan, TrainingSession, TrainingSubject } from '../../../api/types';

export interface ClassBundle {
  item: TrainingClass;
  sessions: TrainingSession[];
  enrollments: Enrollment[];
  /** Giáo án mẫu (chỉ để lấy tên, link). Không có khi người xem không được đọc giáo án (bác sĩ, Groom, chủ ngựa). */
  plan?: TrainingPlan;
  /** Giáo án đã chép vào lớp, có khoảng ngày từng giai đoạn. Mọi vai trò xem được lớp đều đọc được. */
  classPlan?: ClassPlan;
  /** Tiến độ xếp lịch theo tuần so với số buổi tối thiểu. */
  progress?: ClassProgress;
  /** Rỗng khi người xem không được đọc danh mục môn (chủ ngựa). */
  subjects: TrainingSubject[];
}
