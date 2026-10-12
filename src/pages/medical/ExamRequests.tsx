// F3.4 — Hàng đợi yêu cầu khám (GET /exam-requests, phân trang ở backend).
// VET: khám (gắn yêu cầu vào buổi khám), đổi mức khẩn, bỏ qua. CM, HT: gửi yêu cầu và theo dõi.
// Groom chuyển sang trang Sự cố tại chuồng (Flow 4): yêu cầu của Groom đi qua sự cố.
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Stethoscope, XCircle } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { listExamRequests } from '../../api/medical';
import type { ExamRequest, ExamRequestStatus } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  ActionMenu,
  Button,
  DataTable,
  ErrorBox,
  FilterSelect,
  FilterTabs,
  PageHeader,
  Skeleton,
  type TabItem,
} from '../../components/ui';
import { RequestPill, UrgentPill } from '../../components/ui/status';
import { requestSourceLabel } from '../../lib/api-labels';
import { formatDateTime, formatRelative } from '../../lib/format';
import { links } from '../../lib/links';
import { now } from '../../lib/clock';
import { CreateRequestModal, DismissRequestModal, UrgencyModal } from './components/modals';
import { usePeople, type People } from './components/people';
import { HorseChip, RequestText } from './components/parts';
import { IncidentPhotoButton } from '../stable-care/components/IncidentPhotoButton';
import { FEATURES } from '../../config/features';

const LIMIT = 20;

const STATUS_OPTIONS: { value: ExamRequestStatus; label: string }[] = [
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'EXAMINED', label: 'Đã khám' },
  { value: 'DISMISSED', label: 'Đã bỏ qua' },
];

/** Tab trạng thái; API phân trang theo từng trạng thái nên chỉ tab đang chọn có số. */
function statusTabs(active: ExamRequestStatus, total?: number): TabItem[] {
  return STATUS_OPTIONS.map((option) => ({ key: option.value, label: option.label, count: option.value === active ? total : undefined }));
}

function Outcome({ row, people }: { row: ExamRequest; people: People }) {
  if (row.status === 'EXAMINED') {
    return (
      <div className="space-y-1 text-xs text-gray-500">
        <p className="flex items-center gap-1.5 text-gray-700">
          <CheckCircle2 size={13} className="text-emerald-600" /> Đã khám {formatDateTime(row.handledAt)}
        </p>
        <p>{people.name(row.handledBy, 'vet')}</p>
        <Link
          to={links.horseMedical(row.horseId)}
          onClick={(event) => event.stopPropagation()}
          className="font-medium text-emerald-700 hover:underline"
        >
          Xem buổi khám
        </Link>
      </div>
    );
  }
  if (row.status === 'DISMISSED') {
    return (
      <div className="max-w-xs space-y-1 text-xs text-gray-500">
        <p className="flex items-center gap-1.5">
          <XCircle size={13} className="text-gray-400" /> {row.handledBySystem ? 'Hệ thống' : people.name(row.handledBy, 'vet')} · {formatDateTime(row.handledAt)}
        </p>
        {row.dismissReason && <p className="text-gray-600">{row.dismissReason}</p>}
      </div>
    );
  }
  return <RequestPill status="PENDING" />;
}

function Pager({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-1 text-sm text-gray-500">
      <span className="font-light">
        {(page - 1) * LIMIT + 1}–{Math.min(total, page * LIMIT)} trên {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30">
          <ChevronLeft size={18} />
        </button>
        <span className="px-2 tabular-nums">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function useQueue() {
  const [status, setStatusState] = useState<ExamRequestStatus>('PENDING');
  const [urgent, setUrgentState] = useState('');
  const [page, setPage] = useState(1);
  const list = useService(
    () => listExamRequests({ status, urgent: urgent === '' ? undefined : urgent === 'true', page, limit: LIMIT }),
    [status, urgent, page],
  );
  return {
    list,
    status,
    urgent,
    page,
    setPage,
    setStatus: (value: ExamRequestStatus) => {
      setStatusState(value);
      setPage(1);
    },
    setUrgent: (value: string) => {
      setUrgentState(value);
      setPage(1);
    },
  };
}

export default function ExamRequests() {
  const user = useStore((state) => state.currentUser);
  // Groom không gửi yêu cầu khám trực tiếp nữa (BE trả 403): báo sự cố, sự cố khẩn tự tạo yêu cầu khám.
  if (user?.role === 'GROOM' && FEATURES.stableCare) return <Navigate to={links.incidents()} replace />;
  return <StaffView />;
}

/* ===== VET / HT / CM ===== */

function StaffView() {
  const user = useStore((state) => state.currentUser);
  const queue = useQueue();
  const people = usePeople();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const [dismissing, setDismissing] = useState<ExamRequest | null>(null);
  const [urgency, setUrgency] = useState<ExamRequest | null>(null);

  const canCreate = can(user, 'examRequest.create');
  const isVet = can(user, 'examRequest.dismiss');
  const data = queue.list.data;
  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yêu cầu khám"
        description={
          isVet
            ? 'Khẩn lên trước, rồi yêu cầu cũ nhất. Khám để gắn yêu cầu vào buổi khám, hoặc bỏ qua kèm lý do.'
            : user?.role === 'HEAD_TRAINER'
              ? 'Theo dõi yêu cầu khám toàn câu lạc bộ. Gửi yêu cầu cho ngựa thuộc khu bạn phụ trách.'
              : 'Theo dõi yêu cầu khám toàn câu lạc bộ và gửi yêu cầu cho bất kỳ ngựa nào.'
        }
        actions={
          canCreate && (
            <Button variant="secondary" onClick={() => setCreating(true)}>
              <Plus size={16} /> Gửi yêu cầu khám
            </Button>
          )
        }
      />

      <FilterTabs
        active={queue.status}
        onChange={(key) => queue.setStatus(key as ExamRequestStatus)}
        tabs={statusTabs(queue.status, data?.meta.total)}
        toolbar={
          <>
            <FilterSelect value={queue.urgent} onChange={queue.setUrgent} label="Mức độ">
              <option value="">Mọi mức độ</option>
              <option value="true">Khẩn</option>
              <option value="false">Bình thường</option>
            </FilterSelect>
            {data && <span className="ml-auto text-sm text-gray-500">{data.meta.total} yêu cầu</span>}
          </>
        }
      >
        {queue.list.loading && !data ? (
          <Skeleton rows={6} className="p-4" />
        ) : queue.list.error ? (
          <div className="p-4">
            <ErrorBox message={queue.list.error} />
          </div>
        ) : (
          <div>
            <DataTable
              flat
              rows={rows}
              rowKey={(row) => row.id}
              pageSize={LIMIT}
              emptyTitle={queue.status === 'PENDING' ? 'Không có yêu cầu nào đang chờ' : 'Không có yêu cầu phù hợp'}
              emptyHint={queue.status === 'PENDING' ? 'Yêu cầu từ Groom, nhân viên và cảnh báo chỉ số sẽ hiện ở đây.' : undefined}
              columns={[
                { key: 'horse', header: 'Ngựa', render: (row) => <HorseChip horse={{ id: row.horseId, name: row.horseName }} /> },
                {
                  key: 'source',
                  header: 'Nguồn · mức',
                  render: (row) => (
                    <div className="space-y-1">
                      {row.urgent && <UrgentPill urgent />}
                      <p className="text-xs text-gray-600">{requestSourceLabel[row.source]}</p>
                      <IncidentPhotoButton request={row} />
                    </div>
                  ),
                },
                {
                  key: 'desc',
                  header: 'Mô tả',
                  className: 'min-w-[260px] max-w-md',
                  render: (row) => <RequestText text={row.description} />,
                },
                {
                  key: 'by',
                  header: 'Người gửi',
                  render: (row) => (
                    <div className="text-xs">
                      <p className="font-medium text-gray-700">{row.requestedBySystem ? 'Hệ thống' : people.name(row.requestedBy)}</p>
                      <p className="text-gray-500" title={formatDateTime(row.createdAt)}>
                        {formatRelative(row.createdAt, now())}
                      </p>
                    </div>
                  ),
                },
                ...(queue.status === 'PENDING'
                  ? []
                  : [{ key: 'outcome', header: 'Kết quả', render: (row: ExamRequest) => <Outcome row={row} people={people} /> }]),
                {
                  key: 'actions',
                  header: '',
                  className: 'text-right',
                  render: (row) =>
                    isVet && row.status === 'PENDING' ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant={row.urgent ? 'primary' : 'secondary'} onClick={() => navigate(links.visitNew({ horseId: row.horseId, kind: 'REQUEST', requestIds: [row.id], back: links.requests }))}>
                          <Stethoscope size={14} /> Khám
                        </Button>
                        <ActionMenu
                          items={[
                            { label: row.urgent ? 'Hạ xuống Bình thường' : 'Nâng lên Khẩn', onSelect: () => setUrgency(row) },
                            { label: 'Bỏ qua yêu cầu', danger: true, onSelect: () => setDismissing(row) },
                          ]}
                        />
                      </div>
                    ) : null,
                },
              ]}
            />
            {(data?.meta.totalPages ?? 1) > 1 && (
              <div className="border-t border-gray-100 px-4 py-2.5">
                <Pager page={queue.page} totalPages={data?.meta.totalPages ?? 1} total={data?.meta.total ?? 0} onChange={queue.setPage} />
              </div>
            )}
          </div>
        )}
      </FilterTabs>

      <CreateRequestModal open={creating} onClose={() => setCreating(false)} onDone={queue.list.reload} />
      {dismissing && (
        <DismissRequestModal
          request={dismissing}
          onClose={() => setDismissing(null)}
          onDone={() => {
            setDismissing(null);
            queue.list.reload();
          }}
        />
      )}
      {urgency && (
        <UrgencyModal
          request={urgency}
          onClose={() => setUrgency(null)}
          onDone={() => {
            setUrgency(null);
            queue.list.reload();
          }}
        />
      )}
    </div>
  );
}
