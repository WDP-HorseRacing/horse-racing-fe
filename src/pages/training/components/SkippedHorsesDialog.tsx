// Hộp báo sau khi công bố buổi: ngựa nào không được tạo lượt vì đã có buổi trùng giờ ở lớp khác.
// BE không báo lỗi khi công bố (để một con trùng giờ không chặn cả tuần của các ngựa khác), chỉ trả danh sách bỏ qua.
import { CalendarX2 } from 'lucide-react';
import type { PublishedSession } from '../../../api/types';
import { Button, Modal } from '../../../components/ui';
import { formatDate } from '../../../lib/format';
import { clubTime } from '../../../lib/club-time';

export function SkippedHorsesDialog({ sessions, onClose }: { sessions: PublishedSession[]; onClose: () => void }) {
  const total = sessions.reduce((sum, session) => sum + session.skippedHorses.length, 0);
  return (
    <Modal
      open
      onClose={onClose}
      title="Một số ngựa không có lượt tập"
      description={`${total} lượt không được tạo vì ngựa đã có buổi tập trùng giờ ở lớp khác. Các ngựa còn lại vẫn có lượt bình thường.`}
      width="max-w-lg"
      footer={<Button onClick={onClose}>Đã hiểu</Button>}
    >
      <ul className="space-y-3">
        {sessions.map((session) => (
          <li key={session.id} className="rounded-xl bg-amber-50/60 p-3 ring-1 ring-amber-200/70">
            <p className="text-sm font-semibold text-gray-900">
              {session.name}{' '}
              <span className="font-mono text-xs font-normal text-gray-500">
                {formatDate(session.scheduledStartAt)} {clubTime(session.scheduledStartAt)}
              </span>
            </p>
            <ul className="mt-1.5 space-y-1">
              {session.skippedHorses.map((horse) => (
                <li key={horse.horseId} className="flex items-start gap-2 text-sm text-gray-700">
                  <CalendarX2 size={14} className="mt-0.5 shrink-0 text-amber-700" />
                  <span>
                    <b>{horse.horseName}</b> trùng giờ với buổi lúc {clubTime(horse.conflictStartAt)} ngày {formatDate(horse.conflictStartAt)} ở lớp{' '}
                    <span className="font-mono">{horse.conflictClassCode}</span>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-gray-500">Muốn ngựa tập buổi này: dời giờ buổi ở lớp kia, hoặc cho ngựa rời lớp kia rồi ghi danh lại ở đây.</p>
    </Modal>
  );
}
