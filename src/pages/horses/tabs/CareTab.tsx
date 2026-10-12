// F4.1, F4.2, F4.3 — Tab Chăm sóc của hồ sơ ngựa: checklist hằng ngày, khẩu phần theo bữa, việc riêng của ngựa.
// Ai thấy gì (BE không có cờ quyền cho tab này, FE tính theo vai trò):
// - Quản lý CLB: xem tất cả. Bác sĩ: chỉ khẩu phần (BE không cho bác sĩ xem checklist).
// - HLV của khu chứa ngựa: lập, áp dụng khẩu phần, gắn việc riêng. HLV khu khác không thấy tab (BE trả 403).
// - Groom đang phụ trách: tick checklist hôm nay, xem khẩu phần đang áp dụng và việc riêng.
import { useState } from 'react';
import type { HorseDetail } from '../../../api/types';
import { useStore } from '../../../store/store';
import { ChecklistSection } from '../../stable-care/components/ChecklistSection';
import { CareTasksSection } from '../../stable-care/components/CareTasksSection';
import { FeedingSection } from '../../stable-care/components/FeedingSection';

export default function CareTab({ horse, trainerOfZone }: { horse: HorseDetail; trainerOfZone: boolean }) {
  const user = useStore((state) => state.currentUser);
  const role = user?.role;
  const groom = !!horse.groom && horse.groom.id === user?.id;
  // Ngựa đã chuyển nhượng, đã mất, đã xóa hoặc chưa xếp khu thì BE không cho lập khẩu phần hay gắn việc (409).
  const operable = !horse.isDeleted && (horse.lifecycleStatus === 'ACTIVE' || horse.lifecycleStatus === 'RETIRED') && !!horse.location.barn;
  const canManage = role === 'HEAD_TRAINER' && trainerOfZone && operable;
  const seesChecklist = role === 'CLUB_MANAGER' || (role === 'HEAD_TRAINER' && trainerOfZone) || groom;
  const target = { id: horse.id, name: horse.name, barnId: horse.location.barn?.id };
  // Gắn, gỡ việc riêng thì tải lại checklist (gắn từ hôm nay thêm dòng vào checklist hôm nay).
  const [tasksVersion, setTasksVersion] = useState(0);

  if (!seesChecklist) {
    return (
      <div className="pt-4">
        <FeedingSection horse={target} canEdit={false} />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 pt-4 lg:grid-cols-12">
      <ChecklistSection horse={target} canTick={groom} hasGroom={!!horse.groom} version={tasksVersion} className="lg:col-span-7" />
      <div className="space-y-4 lg:col-span-5">
        <FeedingSection horse={target} canEdit={canManage} />
        <CareTasksSection horse={target} canManage={canManage} onChanged={() => setTasksVersion((version) => version + 1)} />
      </div>
    </div>
  );
}
