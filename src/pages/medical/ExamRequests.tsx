// F3.4 — Tiếp nhận yêu cầu khám. VET xử lý (khám ngay / bỏ qua); GROOM, HT, CM gửi.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FolderOpen, Plus, Send, Stethoscope, XCircle } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { listExamRequests, type ExamRequestRow } from '../../services/medical.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Button,
  Card,
  ChipFilter,
  DataTable,
  EmptyState,
  ErrorBox,
  FilterSelect,
  PageHeader,
  SearchInput,
  SectionTitle,
  Sheet,
  Skeleton,
  Toolbar,
  cn,
} from '../../components/ui';
import { RequestPill, UrgencyPill } from '../../components/ui/status';
import { formatDateTime, formatRelative } from '../../lib/format';
import { links } from '../../lib/links';
import { now } from '../../lib/clock';
import type { ExamRequestStatus } from '../../types/domain';
import ExaminationSheet from './components/ExaminationSheet';
import { DismissRequestModal, RequestForm } from './components/modals';
import { HorseChip, RequestLines } from './components/parts';

function Outcome({ row }: { row: ExamRequestRow }) {
  if (row.status === 'EXAMINED') {
    return (
      <div className="space-y-1 text-xs text-gray-500">
        <p className="flex items-center gap-1.5 text-gray-700">
          <CheckCircle2 size={13} className="text-emerald-600" /> Đã khám {row.examinedAt ? formatDateTime(row.examinedAt) : formatDateTime(row.resolvedAt)}
        </p>
        {row.caseId && (
          <Link
            to={links.case(row.caseId)}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
          >
            <FolderOpen size={12} /> {row.caseTitle}
          </Link>
        )}
        {!row.caseId && row.examinationId && <p>Buổi khám độc lập (kết luận không mở bệnh án)</p>}
      </div>
    );
  }
  if (row.status === 'DISMISSED') {
    return (
      <div className="max-w-xs space-y-1 text-xs text-gray-500">
        <p className="flex items-center gap-1.5">
          <XCircle size={13} className="text-gray-400" /> {row.dismissedByName} · {formatDateTime(row.resolvedAt)}
        </p>
        <p className="text-gray-600">{row.dismissReason}</p>
      </div>
    );
  }
  return <RequestPill status="PENDING" />;
}

/* ===== Giao diện Groom: gửi yêu cầu + yêu cầu mình đã gửi ===== */

function GroomView() {
  const list = useService(() => listExamRequests(), []);
  const rows = list.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gửi yêu cầu khám"
        description="Báo bác sĩ khi ngựa bạn chăm sóc có dấu hiệu bất thường — chọn Khẩn nếu cần bác sĩ tới ngay."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:sticky lg:top-6 lg:col-span-5 lg:self-start">
          <SectionTitle icon={<Send size={16} />}>Yêu cầu mới</SectionTitle>
          <RequestForm onDone={list.reload} />
        </Card>
        <div className="space-y-3 lg:col-span-7">
          <SectionTitle className="mb-1">Yêu cầu tôi đã gửi</SectionTitle>
          {list.loading && !list.data ? (
            <Skeleton rows={3} />
          ) : list.error ? (
            <ErrorBox message={list.error} />
          ) : rows.length === 0 ? (
            <EmptyState title="Bạn chưa gửi yêu cầu khám nào" hint="Yêu cầu sau khi gửi sẽ hiện ở đây cùng kết quả xử lý của bác sĩ." />
          ) : (
            rows.map((row) => (
              <article
                key={row.id}
                className={cn(
                  'rounded-2xl bg-white p-4 shadow-card ring-1 ring-gray-200/80',
                  row.status === 'PENDING' && row.urgency === 'URGENT' && 'shadow-[inset_3px_0_0_0_#ef4444]',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <HorseChip horse={row.horse} size={36} tab="" />
                  <div className="flex items-center gap-2">
                    {row.urgency === 'URGENT' && <UrgencyPill urgency={row.urgency} />}
                    <RequestPill status={row.status} />
                  </div>
                </div>
                <div className="mt-3">
                  <RequestLines lines={row.descriptionLines} />
                </div>
                <p className="mt-2 text-xs text-gray-500">Gửi {formatRelative(row.createdAt, now())}</p>
                {row.status !== 'PENDING' && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    {row.status === 'EXAMINED' ? (
                      <p className="flex items-center gap-1.5 text-xs text-gray-700">
                        <CheckCircle2 size={13} className="text-emerald-600" /> Bác sĩ đã khám {formatDateTime(row.examinedAt ?? row.resolvedAt)}
                      </p>
                    ) : (
                      <Outcome row={row} />
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Giao diện VET / HT / CM ===== */

export default function ExamRequests() {
  const user = useStore((state) => state.currentUser);
  if (user?.role === 'GROOM') return <GroomView />;
  return <StaffView />;
}

function StaffView() {
  const user = useStore((state) => state.currentUser);
  const list = useService(() => listExamRequests(), []);
  const [status, setStatus] = useState<ExamRequestStatus>('PENDING');
  const [urgency, setUrgency] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [examHorse, setExamHorse] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<ExamRequestRow | null>(null);

  const all = useMemo(() => list.data ?? [], [list.data]);
  const counts = useMemo(
    () => ({
      PENDING: all.filter((row) => row.status === 'PENDING').length,
      EXAMINED: all.filter((row) => row.status === 'EXAMINED').length,
      DISMISSED: all.filter((row) => row.status === 'DISMISSED').length,
      URGENT: all.filter((row) => row.status === 'PENDING' && row.urgency === 'URGENT').length,
    }),
    [all],
  );
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((row) => row.status === status)
      .filter((row) => !urgency || row.urgency === urgency)
      .filter((row) => !term || `${row.horse.name} ${row.description} ${row.createdByName}`.toLowerCase().includes(term));
  }, [all, status, urgency, search]);

  const canCreate = can(user, 'examRequest.create');
  const isVet = can(user, 'exam.record');

  if (list.loading && !list.data) return <Skeleton rows={6} />;
  if (list.error) return <ErrorBox message={list.error} />;

  const oldestPending = all.filter((row) => row.status === 'PENDING').reduce<string | undefined>(
    (oldest, row) => (!oldest || row.createdAt < oldest ? row.createdAt : oldest),
    undefined,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yêu cầu khám"
        description={
          isVet
            ? 'Khám ngay (gắn yêu cầu vào buổi khám) hoặc bỏ qua kèm lý do.'
            : 'Theo dõi yêu cầu khám và gửi yêu cầu cho ngựa trong phạm vi của bạn.'
        }
        actions={
          canCreate && (
            <Button variant="secondary" onClick={() => setCreating(true)}>
              <Plus size={16} /> Gửi yêu cầu khám
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <ChipFilter<ExamRequestStatus>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'PENDING', label: 'Chờ xử lý', count: counts.PENDING },
            { value: 'EXAMINED', label: 'Đã khám', count: counts.EXAMINED },
            { value: 'DISMISSED', label: 'Đã bỏ qua', count: counts.DISMISSED },
          ]}
        />
        {counts.PENDING > 0 && (
          <span className="text-sm text-gray-500">
            {counts.URGENT > 0 && <span className="font-medium text-red-700">{counts.URGENT} khẩn</span>}
            {counts.URGENT > 0 && ' · '}yêu cầu cũ nhất gửi {oldestPending ? formatRelative(oldestPending, now()) : '—'}
          </span>
        )}
      </div>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo ngựa, mô tả, người gửi…" className="min-w-60 flex-1" />
        <FilterSelect value={urgency} onChange={setUrgency} label="Mức độ">
          <option value="">Mọi mức độ</option>
          <option value="URGENT">Khẩn</option>
          <option value="NORMAL">Bình thường</option>
        </FilterSelect>
      </Toolbar>

      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        pageSize={15}
        emptyTitle={status === 'PENDING' ? 'Không có yêu cầu nào đang chờ' : 'Không có yêu cầu phù hợp'}
        columns={[
          { key: 'horse', header: 'Ngựa', render: (row) => <HorseChip horse={row.horse} /> },
          {
            key: 'source',
            header: 'Nguồn · mức',
            render: (row) => (
              <div className="space-y-1">
                {row.urgency === 'URGENT' && <UrgencyPill urgency={row.urgency} />}
                <p className="text-xs text-gray-600">{row.sourceLabel}</p>
              </div>
            ),
          },
          {
            key: 'desc',
            header: 'Mô tả',
            className: 'min-w-[260px] max-w-md',
            render: (row) => <RequestLines lines={row.descriptionLines} />,
          },
          {
            key: 'by',
            header: 'Người gửi',
            render: (row) => (
              <div className="text-xs">
                <p className="font-medium text-gray-700">{row.createdByName}</p>
                <p className="text-gray-500" title={formatDateTime(row.createdAt)}>
                  {formatRelative(row.createdAt, now())}
                </p>
              </div>
            ),
          },
          ...(status === 'PENDING' ? [] : [{ key: 'outcome', header: 'Kết quả', render: (row: ExamRequestRow) => <Outcome row={row} /> }]),
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (row) =>
              row.status === 'PENDING' && (row.canExamine || row.canDismiss) ? (
                <div className="flex justify-end gap-2">
                  {row.canExamine && (
                    <Button size="sm" variant={row.urgency === 'URGENT' ? 'primary' : 'secondary'} onClick={() => setExamHorse(row.horse.id)}>
                      <Stethoscope size={14} /> Khám ngay
                    </Button>
                  )}
                  {row.canDismiss && (
                    <Button size="sm" variant="ghost" onClick={() => setDismissing(row)}>
                      Bỏ qua
                    </Button>
                  )}
                </div>
              ) : null,
          },
        ]}
      />

      {creating && (
        <Sheet
          open
          onClose={() => setCreating(false)}
          title="Gửi yêu cầu khám"
          description={
            user?.role === 'HEAD_TRAINER'
              ? 'Chỉ gửi cho ngựa thuộc khu bạn phụ trách.'
              : isVet
                ? 'Yêu cầu do bác sĩ tự tạo, để xử lý sau.'
                : 'Gửi cho bất kỳ ngựa nào còn ở câu lạc bộ.'
          }
        >
          <RequestForm
            onCancel={() => setCreating(false)}
            onDone={() => {
              setCreating(false);
              list.reload();
            }}
          />
        </Sheet>
      )}
      {examHorse && (
        <ExaminationSheet
          horseId={examHorse}
          onClose={() => setExamHorse(null)}
          onDone={() => {
            setExamHorse(null);
            list.reload();
          }}
        />
      )}
      {dismissing && (
        <DismissRequestModal
          request={{ id: dismissing.id, horseName: dismissing.horse.name, lines: dismissing.descriptionLines }}
          onClose={() => setDismissing(null)}
          onDone={() => {
            setDismissing(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
