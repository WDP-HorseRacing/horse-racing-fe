// Thẻ một sự cố tại chuồng, dùng ở trang Sự cố (mọi vai trò) và Chăm sóc khu.
// HLV khu: Chuyển bác sĩ (một lần, có thể Khẩn) và Đóng sự cố (bắt buộc kết quả, khóa khi yêu cầu khám còn chờ).
// Sự cố thường mở từ 4 giờ trở lên mà chưa chuyển bác sĩ thì tô cam (BE đã nhắc HLV khu và Quản lý CLB).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, Clock3, Stethoscope } from 'lucide-react';
import { referIncident, resolveIncident } from '../../../api/stable-care';
import type { Incident } from '../../../api/types';
import { Lightbox } from '../../../components/Lightbox';
import { Button, Dot, ErrorBox, Field, Modal, Pill, Textarea, Tip, cn, useToast } from '../../../components/ui';
import { RequestPill, UrgentPill } from '../../../components/ui/status';
import { useAction } from '../../../hooks/useService';
import { now } from '../../../lib/clock';
import { formatDateTime, formatRelative } from '../../../lib/format';
import { links } from '../../../lib/links';
import { INCIDENT_STALE_HOURS, incidentStatusText, textError } from '../../../lib/stable-labels';
import { incidentStale } from '../care-helpers';

export function IncidentCard({
  incident,
  canHandle,
  showReporter = true,
  onChanged,
  onPhotoExpired,
}: {
  incident: Incident;
  /** HLV của khu đang chứa ngựa. */
  canHandle: boolean;
  showReporter?: boolean;
  onChanged: () => void;
  /** Link ảnh hết hạn (15 phút): tải lại danh sách. */
  onPhotoExpired: () => void;
}) {
  const [viewing, setViewing] = useState(false);
  const [referring, setReferring] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [broken, setBroken] = useState(false);
  const open = incident.status === 'OPEN';
  const stale = incidentStale(incident);
  const waitingVet = incident.examRequest?.status === 'PENDING';
  const opened = formatRelative(incident.createdAt, now());

  return (
    <article
      className={cn(
        'rounded-2xl bg-white p-4 ring-1',
        open && incident.urgent ? 'shadow-[inset_3px_0_0_0_#ef4444] ring-red-100' : stale ? 'shadow-[inset_3px_0_0_0_#f59e0b] ring-amber-100' : 'shadow-card ring-gray-200/80',
      )}
    >
      <div className="flex gap-3.5">
        {incident.photoUrl && !broken ? (
          <button type="button" onClick={() => setViewing(true)} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5" title="Xem ảnh lớn">
            <img
              src={incident.photoUrl}
              alt={`Ảnh sự cố ${incident.horseName}`}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              onError={() => {
                setBroken(true);
                onPhotoExpired();
              }}
            />
          </button>
        ) : (
          <span className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-gray-50 text-[11px] text-gray-400 ring-1 ring-gray-100">
            <Camera size={18} />
            {incident.photoUrl ? 'Đang tải lại' : 'Không ảnh'}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link to={links.horse(incident.horseId, 'care')} className="truncate font-semibold text-gray-900 hover:text-emerald-800 hover:underline">
              {incident.horseName}
            </Link>
            <div className="flex flex-wrap items-center gap-1.5">
              {incident.urgent && <UrgentPill urgent />}
              <Pill tone={open ? (stale ? 'amber' : 'green') : 'gray'}>{incidentStatusText[incident.status]}</Pill>
            </div>
          </div>
          <p className="mt-1.5 whitespace-pre-line text-sm text-gray-700">{incident.description || 'Không có mô tả'}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            {showReporter && <span>Groom {incident.reporter.fullName}</span>}
            <span title={formatDateTime(incident.createdAt)}>
              {showReporter && '· '}
              {opened}
            </span>
            {stale && (
              <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                <Clock3 size={12} /> Mở quá {INCIDENT_STALE_HOURS} giờ chưa chuyển bác sĩ
              </span>
            )}
          </p>
        </div>
      </div>

      {incident.examRequest && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm">
          <Stethoscope size={15} className="text-emerald-700" />
          <span className="text-gray-600">Yêu cầu khám</span>
          <RequestPill status={incident.examRequest.status} />
          {incident.examRequest.urgent && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
              <Dot tone="danger" /> Khẩn
            </span>
          )}
          {incident.examRequest.handledAt && <span className="text-xs text-gray-500">{formatDateTime(incident.examRequest.handledAt)}</span>}
          {incident.examRequest.dismissReason && <span className="w-full text-xs text-gray-600">Lý do bỏ qua: {incident.examRequest.dismissReason}</span>}
        </div>
      )}

      {incident.status === 'RESOLVED' && (
        <div className="mt-3 rounded-xl bg-emerald-50/70 px-3 py-2 text-sm ring-1 ring-emerald-100">
          <p className="flex items-center gap-1.5 font-medium text-emerald-900">
            <CheckCircle2 size={15} /> Kết quả xử lý
          </p>
          <p className="mt-0.5 whitespace-pre-line text-gray-700">{incident.resolution}</p>
          <p className="mt-1 text-xs text-gray-500">
            {incident.resolvedBySystem ? 'Tự đóng' : (incident.resolver?.fullName ?? 'HLV khu')}
            {incident.resolvedAt && ` · ${formatDateTime(incident.resolvedAt)}`}
          </p>
        </div>
      )}

      {canHandle && open && (
        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
          {!incident.examRequest && (
            <Button variant="secondary" size="sm" onClick={() => setReferring(true)}>
              <Stethoscope size={14} /> Chuyển bác sĩ
            </Button>
          )}
          <Tip content={waitingVet ? 'Đang chờ bác sĩ khám' : undefined}>
            <span>
              <Button size="sm" onClick={() => setResolving(true)} disabled={waitingVet}>
                <CheckCircle2 size={14} /> Đóng sự cố
              </Button>
            </span>
          </Tip>
        </div>
      )}

      {incident.photoUrl && (
        <Lightbox open={viewing} onClose={() => setViewing(false)} images={[{ src: incident.photoUrl, alt: `Ảnh sự cố ${incident.horseName}` }]} caption={incident.description} />
      )}
      {referring && <ReferDialog incident={incident} onClose={() => setReferring(false)} onDone={onChanged} />}
      {resolving && <ResolveDialog incident={incident} onClose={() => setResolving(false)} onDone={onChanged} />}
    </article>
  );
}

function ReferDialog({ incident, onClose, onDone }: { incident: Incident; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [urgent, setUrgent] = useState(false);
  const submit = () =>
    void action.run(
      () => referIncident(incident.id, urgent),
      () => {
        toast.push('Đã chuyển bác sĩ', 'success');
        onClose();
        onDone();
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={`Chuyển bác sĩ: ${incident.horseName}`}
      description="Bác sĩ sẽ nhận mô tả của Groom. Chỉ chuyển được một lần."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button variant={urgent ? 'danger' : 'primary'} onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang chuyển…' : 'Chuyển bác sĩ'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => setUrgent(value)}
            aria-pressed={urgent === value}
            className={cn(
              'flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 transition',
              urgent === value ? (value ? 'ring-2 ring-red-500' : 'ring-2 ring-emerald-700') : 'ring-1 ring-gray-200 hover:ring-gray-300',
            )}
          >
            <Dot tone={urgent === value && value ? 'danger' : 'neutral'} />
            {value ? 'Khẩn' : 'Bình thường'}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">{urgent ? 'Báo ngay cho mọi bác sĩ.' : 'Bác sĩ khám theo thứ tự.'}</p>
      {action.error && (
        <div className="mt-3">
          <ErrorBox message={action.error} />
        </div>
      )}
    </Modal>
  );
}

const MAX_RESOLUTION = 1000;

function ResolveDialog({ incident, onClose, onDone }: { incident: Incident; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [resolution, setResolution] = useState('');
  const [touched, setTouched] = useState(false);
  const error = touched ? textError(resolution, { label: 'Kết quả xử lý', max: MAX_RESOLUTION }) : undefined;
  const submit = () => {
    setTouched(true);
    if (textError(resolution, { label: 'Kết quả xử lý', max: MAX_RESOLUTION })) return;
    void action.run(
      () => resolveIncident(incident.id, resolution.trim()),
      () => {
        toast.push(`Đã đóng sự cố của ${incident.horseName}`, 'success');
        onClose();
        onDone();
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Đóng sự cố: ${incident.horseName}`}
      description="Groom sẽ thấy kết quả này."
      dirty={resolution.trim() !== ''}
      onSave={submit}
      saveLabel="Đóng sự cố"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Đóng sự cố'}
          </Button>
        </>
      }
    >
      <Field label="Kết quả xử lý" required error={error} counter={<span className="tabular-nums">{resolution.trim().length}/{MAX_RESOLUTION}</span>}>
        <Textarea rows={4} value={resolution} maxLength={MAX_RESOLUTION + 100} onChange={(event) => setResolution(event.target.value)} placeholder="Ví dụ: Đã sát trùng móng, theo dõi thêm 2 ngày. Hoặc: Báo nhầm, ngựa bình thường" />
      </Field>
      {action.error && (
        <div className="mt-3">
          <ErrorBox message={action.error} />
        </div>
      )}
    </Modal>
  );
}
