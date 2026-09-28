// Nhật ký của hồ sơ (chỉ CM): mọi thao tác thêm/sửa/xóa liên quan tới ngựa + dòng thời gian vòng đời.
import { History } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { listHorseAudit, listLifecycleEvents } from '../../../services/horse.service';
import { Card, ErrorBox, SectionTitle, Skeleton } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { AuditList } from '../../admin/AuditList';

export default function AuditTab({ horseId }: { horseId: string }) {
  const audit = useService(() => listHorseAudit(horseId), [horseId]);
  const events = useService(() => listLifecycleEvents(horseId), [horseId]);

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <SectionTitle>Nhật ký thao tác</SectionTitle>
        {audit.error && <ErrorBox message={audit.error} />}
        {audit.loading ? <Skeleton rows={5} /> : <AuditList rows={audit.data ?? []} />}
      </div>
      <aside className="lg:col-span-4">
        <Card variant="flat" className="lg:sticky lg:top-6">
          <SectionTitle icon={<History size={16} />}>Lịch sử vòng đời</SectionTitle>
          {events.loading ? (
            <Skeleton rows={2} />
          ) : (events.data ?? []).length === 0 ? (
            <p className="text-sm font-light text-gray-500">Chưa có thay đổi vòng đời nào.</p>
          ) : (
            <ol className="relative space-y-5 border-l border-emerald-200 pl-5">
              {(events.data ?? []).map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                  <p className="text-sm font-semibold text-gray-900">
                    {event.fromLabel} → {event.toLabel}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDateTime(event.at)} · {event.byName}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{event.reason}</p>
                  {event.consequences.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1">
                      {event.consequences.map((item) => (
                        <li key={item} className="rounded-md bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-emerald-900/5">
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </aside>
    </div>
  );
}
