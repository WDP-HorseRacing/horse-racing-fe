// Dữ liệu một lớp tải một lần ở trang chi tiết lớp, chia cho các tab.
import type { Enrollment, TrainingClass, TrainingPlan, TrainingSession, TrainingSubject } from '../../../api/types';

export interface ClassBundle {
  item: TrainingClass;
  sessions: TrainingSession[];
  enrollments: Enrollment[];
  /** Không có khi người xem không được đọc giáo án (bác sĩ, Groom, chủ ngựa). */
  plan?: TrainingPlan;
  /** Rỗng khi người xem không được đọc danh mục môn (chủ ngựa). */
  subjects: TrainingSubject[];
}
