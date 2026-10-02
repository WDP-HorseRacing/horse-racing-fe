// Hàng đợi khám của Bảng điều khiển y tế: gộp yêu cầu khám, hẹn tái khám tới hạn và khám định kỳ cần chú ý
// thành một danh sách, việc gấp lên đầu. Mỗi mục biết sẽ mở form ghi buổi khám với tham số nào.
import type { ExamRequest, MedicalDashboard } from '../../../api/types';
import type { VisitParams } from '../../../lib/links';
import { requestSourceLabel } from '../../../lib/api-labels';
import { formatDate } from '../../../lib/format';

export type QueueKind = 'URGENT' | 'FOLLOW_UP' | 'CHECKUP_OVERDUE' | 'REQUEST' | 'CHECKUP_SOON';

export const QUEUE_LABEL: Record<QueueKind, string> = {
  URGENT: 'Khẩn',
  FOLLOW_UP: 'Tái khám',
  CHECKUP_OVERDUE: 'Định kỳ quá hạn',
  REQUEST: 'Yêu cầu',
  CHECKUP_SOON: 'Định kỳ sắp đến',
};

/** Nhóm lọc nhanh trên đầu hàng đợi. */
export type QueueFilter = 'ALL' | 'URGENT' | 'FOLLOW_UP' | 'CHECKUP' | 'REQUEST';

export function matchesFilter(item: QueueItem, filter: QueueFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'CHECKUP') return item.kind === 'CHECKUP_OVERDUE' || item.kind === 'CHECKUP_SOON';
  if (filter === 'REQUEST') return item.kind === 'REQUEST' || item.kind === 'URGENT';
  return item.kind === filter;
}

const RANK: Record<QueueKind, number> = { URGENT: 0, FOLLOW_UP: 1, CHECKUP_OVERDUE: 2, REQUEST: 3, CHECKUP_SOON: 4 };

export interface QueueItem {
  key: string;
  kind: QueueKind;
  horseId: string;
  horseName: string;
  /** Lý do khám, một dòng. */
  reason: string;
  /** Nguồn / hạn, dòng phụ. */
  meta: string;
  /** Mốc để sắp xếp trong cùng nhóm (cũ trước). */
  at: string;
  /** Tham số mở form ghi buổi khám. */
  visit: VisitParams;
  /** Link xem thêm (bệnh án, yêu cầu khám). */
  to?: string;
  request?: ExamRequest;
}

export function buildQueue(data: MedicalDashboard, today: string, caseLink: (caseId: string) => string): QueueItem[] {
  const items: QueueItem[] = [];
  data.pendingRequests.forEach((request) => {
    items.push({
      key: `req-${request.id}`,
      kind: request.urgent ? 'URGENT' : 'REQUEST',
      horseId: request.horseId,
      horseName: request.horseName,
      reason: request.description || requestSourceLabel[request.source],
      meta: requestSourceLabel[request.source],
      at: request.createdAt,
      visit: { horseId: request.horseId, kind: 'REQUEST', requestIds: [request.id] },
      request,
    });
  });
  data.openCases
    .filter((item) => item.nextVisitAt && item.nextVisitAt.slice(0, 10) <= today)
    .forEach((item) => {
      const day = item.nextVisitAt!.slice(0, 10);
      items.push({
        key: `case-${item.caseId}`,
        kind: 'FOLLOW_UP',
        horseId: item.horseId,
        horseName: item.horseName,
        reason: item.initialDiagnosis,
        meta: day === today ? 'Hẹn tái khám hôm nay' : `Đã qua hẹn tái khám ${formatDate(item.nextVisitAt)}`,
        at: item.nextVisitAt!,
        visit: { horseId: item.horseId, caseId: item.caseId },
        to: caseLink(item.caseId),
      });
    });
  data.checkups.forEach((item) => {
    const overdue = item.daysLeft < 0;
    items.push({
      key: `chk-${item.horseId}`,
      kind: overdue ? 'CHECKUP_OVERDUE' : 'CHECKUP_SOON',
      horseId: item.horseId,
      horseName: item.horseName,
      reason: 'Khám định kỳ 30 ngày',
      meta: overdue
        ? `Quá hạn ${-item.daysLeft} ngày · hạn ${formatDate(item.dueDate)}`
        : `${item.daysLeft === 0 ? 'Đến hạn hôm nay' : `Còn ${item.daysLeft} ngày`} · hạn ${formatDate(item.dueDate)}${item.appointment ? ' · đã hẹn' : ''}`,
      at: item.dueDate,
      visit: { horseId: item.horseId, kind: 'ROUTINE' },
    });
  });
  return items.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.at.localeCompare(b.at));
}
