// Góc nhìn của Groom (và chủ ngựa) khi buổi đang chạy hoặc đã xong: trạng thái từng ngựa, cảnh báo, việc chăm sóc.
// Theo dõi realtime chỉ dành cho HT, bác sĩ và quản lý (F2.8); Groom nhận cảnh báo đỏ qua thông báo.
import { AlertOctagon, Info } from 'lucide-react';
import { Avatar, Card, Notice, Pill, SectionTitle, cn } from '../../../components/ui';
import { AttendancePill } from '../../../components/ui/status';
import type { SessionDetail } from '../../../services/session.service';
import { formatTime } from '../../../lib/format';
import GroomTaskChecklist from './GroomTaskChecklist';
import { secondText } from './session-helpers';

export default function RosterStatusView({ detail, onChanged }: { detail: SessionDetail; onChanged: () => void }) {
  const running = detail.header.status === 'IN_PROGRESS';
  const isGroom = detail.viewerRole === 'GROOM';
  const unacked = detail.alerts.filter((alert) => alert.level === 'RED' && !alert.acknowledgedAt);

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        {unacked.map((alert) => (
          <div key={alert.id} className="flex items-start gap-3 rounded-2xl bg-red-600 px-5 py-4 text-white shadow-red">
            <AlertOctagon size={22} className="mt-0.5 shrink-0 animate-pulse" />
            <div>
              <p className="font-bold">Dừng ngựa ngay: {alert.horseName}</p>
              <p className="text-sm text-red-100">
                {alert.ruleLabel} — {alert.text}. Cho ngựa đi bộ chậm và chờ HT hoặc bác sĩ xác nhận.
              </p>
            </div>
          </div>
        ))}

        <SectionTitle>{isGroom ? 'Ngựa trong buổi' : 'Ngựa của bạn trong buổi'}</SectionTitle>
        <div className="space-y-3">
          {detail.horses.map((row) => {
            const absent = row.status === 'ABSENT';
            const mineAlert = unacked.some((alert) => alert.horseId === row.horseId);
            return (
              <div
                key={row.horseId}
                className={cn(
                  'rounded-2xl bg-white p-4 ring-1 sm:p-5',
                  mineAlert ? 'ring-2 ring-red-400 shadow-red' : absent ? 'bg-orange-50/40 ring-orange-100' : 'ring-emerald-950/[0.06]',
                  row.mine && !mineAlert && 'shadow-grass',
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar src={row.avatar} name={row.horseName} size={42} className={cn(absent && 'grayscale')} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">
                      {row.horseName}
                      {row.mine && <span className="ml-2 text-xs font-medium text-emerald-700">bạn dắt</span>}
                    </p>
                    <p className="text-xs text-gray-500">{row.groomName ? `Groom ${row.groomName}` : 'Chưa có Groom'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <AttendancePill status={row.status} reason={row.absenceReason} />
                    {row.stopped && (
                      <Pill tone="red">
                        Đã dừng {secondText(row.stopped.atSecond)}
                        {row.stopped.at ? ` · ${formatTime(row.stopped.at)}` : ''}
                      </Pill>
                    )}
                    {running && !absent && !row.stopped && (
                      <Pill tone="blue" pulse>
                        Đang tập
                      </Pill>
                    )}
                  </div>
                </div>
                {absent && row.absenceNote && <p className="mt-2 text-sm text-orange-800">{row.absenceNote}</p>}
                {row.stopped?.reason && <p className="mt-2 text-sm text-red-700">Lý do dừng: {row.stopped.reason}</p>}
                {!absent && (isGroom || row.canDoTasks) && (
                  <div className="mt-3 border-t border-gray-50 pt-3">
                    <GroomTaskChecklist
                      sessionId={detail.header.id}
                      horseId={row.horseId}
                      tasks={row.tasks}
                      readOnly={!row.canDoTasks}
                      onChanged={onChanged}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
        <Notice tone="info" icon={<Info size={16} />}>
          {isGroom
            ? running
              ? 'Biểu đồ nhịp tim và tốc độ theo thời gian thực dành cho HT và bác sĩ. Bạn nhận thông báo khẩn "Dừng ngựa ngay" khi ngựa bạn dắt có cảnh báo đỏ.'
              : 'Sau buổi, đánh dấu "Chăm sóc sau tập" cho ngựa bạn dắt. Điểm và nhận xét do HT chấm, chỉ HT, bác sĩ, quản lý và chủ ngựa xem được.'
            : 'Buổi đang diễn ra. Chỉ số tổng hợp và nhận xét của HT hiện ở đây sau khi buổi kết thúc và được chấm.'}
        </Notice>
        {detail.alerts.length > 0 && (
          <Card variant="outline">
            <SectionTitle className="mb-3">Cảnh báo trong buổi</SectionTitle>
            <ul className="space-y-2 text-sm">
              {detail.alerts.map((alert) => (
                <li key={alert.id} className={cn('rounded-xl px-3 py-2', alert.level === 'RED' ? 'bg-red-50' : 'bg-gray-50')}>
                  <p className={cn('font-semibold', alert.level === 'RED' ? 'text-red-700' : 'text-gray-600')}>
                    {alert.horseName} · {alert.ruleLabel}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatTime(alert.at)} ·{' '}
                    {alert.acknowledgedByName
                      ? `${alert.acknowledgedByName} ${alert.ackAction === 'STOP_HORSE' ? 'đã dừng ngựa' : 'cho tiếp tục'}`
                      : alert.level === 'RED'
                        ? 'chờ xác nhận'
                        : 'thông tin'}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </aside>
    </div>
  );
}
