// F4.4 — Sự cố tại chuồng.
// Groom: các sự cố mình đã báo hoặc của ngựa mình phụ trách, kể cả do Groom khác báo hộ; nút Báo sự cố mở hộp thoại (đang lọc ngựa thì chọn sẵn).
// HLV: sự cố của ngựa đang ở khu mình (BE lọc), chuyển bác sĩ và đóng sự cố.
// Quản lý CLB, bác sĩ: xem mọi sự cố, Quản lý CLB lọc theo khu. Mở từ thông báo thì lọc theo ngựa (?horse=).
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Siren, X } from 'lucide-react';
import { onRealtime } from '../../api/realtime';
import { listIncidents } from '../../api/stable-care';
import { listBarns } from '../../api/stable';
import type { IncidentStatus, NotificationItem } from '../../api/types';
import { useCrumbs } from '../../components/Breadcrumb';
import { Button, EmptyState, ErrorBox, FilterSelect, PageHeader, SectionTitle, Skeleton, TabPanel, Tabs, NotFound } from '../../components/ui';
import { useService } from '../../hooks/useService';
import { links } from '../../lib/links';
import { useStore } from '../../store/store';
import { IncidentCard } from './components/IncidentCard';
import { IncidentReportDialog } from './components/IncidentReport';
import { incidentStale } from './care-helpers';

const TABS: { key: IncidentStatus; label: string }[] = [
  { key: 'OPEN', label: 'Đang mở' },
  { key: 'RESOLVED', label: 'Đã đóng' },
];

export default function Incidents() {
  const role = useStore((state) => state.currentUser?.role);
  const [params, setParams] = useSearchParams();
  const horseId = params.get('horse') ?? undefined;
  const [status, setStatus] = useState<IncidentStatus>('OPEN');
  const [barnId, setBarnId] = useState('');
  const [reporting, setReporting] = useState(false);
  const groom = role === 'GROOM';
  const trainer = role === 'HEAD_TRAINER';
  const manager = role === 'CLUB_MANAGER';

  const list = useService(() => listIncidents({ status, horseId, barnId: barnId || undefined }), [status, horseId, barnId]);
  const barns = useService(() => (manager ? listBarns() : Promise.resolve([])), [manager]);
  const reload = list.reload;

  // Sự cố mới hoặc nhắc sự cố quá hạn tới qua thông báo: tải lại danh sách.
  useEffect(() => onRealtime<NotificationItem>('notification.created', (item) => item.category === 'INCIDENT' && reload()), [reload]);

  const rows = list.data ?? [];
  const filteredHorse = horseId ? rows[0]?.horseName : undefined;
  const staleCount = rows.filter((item) => incidentStale(item)).length;
  useCrumbs([{ label: 'Sự cố tại chuồng' }]);

  if (role === 'HORSE_OWNER') return <NotFound message="Trang này dành cho nhân viên câu lạc bộ." />;

  const clearHorse = () => {
    params.delete('horse');
    setParams(params, { replace: true });
  };

  const listBody = (
    <TabPanel className="space-y-3 bg-gray-50/60 p-4">
      {horseId && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          Đang xem sự cố của <span className="font-semibold text-gray-900">{filteredHorse ?? 'một ngựa'}</span>
          <button type="button" onClick={clearHorse} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">
            <X size={12} /> Bỏ lọc
          </button>
        </p>
      )}
      {list.loading && !list.data ? (
        <Skeleton rows={3} />
      ) : list.error ? (
        <ErrorBox message={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={status === 'OPEN' ? 'Không có sự cố nào đang mở' : 'Chưa có sự cố nào đã đóng'}
          hint={groom ? 'Sự cố bạn báo và sự cố của ngựa bạn phụ trách hiện ở đây, kèm kết quả xử lý của HLV khu.' : trainer ? 'Chỉ hiện sự cố của ngựa đang ở khu bạn phụ trách.' : undefined}
        />
      ) : (
        rows.map((incident) => <IncidentCard key={incident.id} incident={incident} canHandle={trainer} showReporter onChanged={reload} onPhotoExpired={reload} />)
      )}
    </TabPanel>
  );

  const tabs = TABS.map((tab) => ({ key: tab.key, label: tab.label, count: tab.key === status ? rows.length : undefined }));

  if (groom) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Sự cố tại chuồng"
          description="Thấy ngựa có dấu hiệu lạ thì báo ngay."
          actions={
            <Button onClick={() => setReporting(true)}>
              <Siren size={15} /> Báo sự cố
            </Button>
          }
        />
        <div className="space-y-3">
          <SectionTitle className="mb-0">Sự cố ngựa tôi phụ trách và tôi đã báo</SectionTitle>
          <Tabs active={status} onChange={(key) => setStatus(key as IncidentStatus)} tabs={tabs} />
          {listBody}
        </div>
        <IncidentReportDialog open={reporting} initialHorseId={horseId} onClose={() => setReporting(false)} onDone={reload} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sự cố tại chuồng"
        description={
          trainer
            ? 'Xử lý xong thì đóng. Cần khám thì chuyển bác sĩ.'
            : 'Sự cố của mọi khu.'
        }
      />
      {status === 'OPEN' && staleCount > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
          {staleCount} sự cố quá 4 giờ chưa xử lý.
        </p>
      )}
      <div>
        <Tabs active={status} onChange={(key) => setStatus(key as IncidentStatus)} tabs={tabs} />
        {manager && (
          <div className="flex flex-wrap items-center gap-2 border-x border-gray-200/80 bg-white px-4 py-3">
            <FilterSelect value={barnId} onChange={setBarnId} label="Khu">
              <option value="">Mọi khu</option>
              {barns.data?.map((barn) => (
                <option key={barn.id} value={barn.id}>
                  {barn.name}
                </option>
              ))}
            </FilterSelect>
            <Link to={links.stableCare(barnId || undefined)} className="ml-auto text-sm font-medium text-emerald-800 hover:underline">
              Chăm sóc khu
            </Link>
          </div>
        )}
        {listBody}
      </div>
    </div>
  );
}
