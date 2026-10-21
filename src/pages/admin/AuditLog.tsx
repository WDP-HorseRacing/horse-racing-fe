// Nhật ký thao tác (chỉ Quản lý CLB): ai làm gì, lúc nào, với đối tượng nào. BE phân trang, mới nhất trước.
// Lọc theo kỳ, người làm, thao tác, loại đối tượng. Bấm một dòng mở ngăn chi tiết: các trường đổi, trước và sau.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAuditLog, listAuditLogs, type AuditAction, type AuditLog } from '../../api/audit';
import { listAllUsers } from '../../api/users';
import { can } from '../../auth/permissions';
import { useCrumbs } from '../../components/Breadcrumb';
import { PeriodBar } from '../../components/PeriodBar';
import { EmptyState, ErrorBox, FilterSelect, NotFound, PageHeader, Pill, Sheet, Skeleton, cn, type PillTone } from '../../components/ui';
import { usePeriod } from '../../hooks/usePeriod';
import { useService } from '../../hooks/useService';
import { AUDIT_ACTIONS, auditActionText, auditEntityText, entityLabel, featureLabel } from '../../lib/audit-labels';
import { clubDateKey } from '../../lib/club-time';
import { now } from '../../lib/clock';
import { formatDate, formatDateTime, formatTime } from '../../lib/format';
import { roleLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import { useStore } from '../../store/store';

const PAGE_SIZE = 20;

const ACTION_TONE: Record<AuditAction, PillTone> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  RESTORE: 'amber',
  LOGIN: 'gray',
  LOGOUT: 'gray',
  LOGIN_FAILED: 'red',
  PASSWORD_CHANGE: 'amber',
};

/** Người làm. Dòng đăng nhập sai không có người làm: ghi tài khoản bị thử (entityId), không ghi "Hệ thống". */
function actorText(item: Pick<AuditLog, 'actor' | 'action' | 'entityId' | 'feature'>, names: Map<string, string>) {
  if (item.actor) return item.actor.fullName;
  if (item.action === 'LOGIN_FAILED') return `Đăng nhập sai: ${names.get(item.entityId) ?? 'tài khoản đã xóa'}`;
  // Hệ thống chấm lại lượt tập khi khóa huấn luyện hoặc sức khỏe ngựa đổi.
  if (item.feature === 'TRAIN_RUN') return 'Hệ thống chấm lại lượt tập';
  return 'Hệ thống';
}

/** Loại đối tượng hay gặp, để lọc. Các loại khác vẫn hiện trong danh sách. */
const ENTITY_FILTERS = [
  'HORSE',
  'HORSE_OWNERSHIP',
  'HORSE_MEASUREMENT',
  'BARN',
  'STALL_ASSIGNMENT',
  'GROOM_ASSIGNMENT',
  'MEDICAL_RECORD',
  'MEDICAL_CASE',
  'MEDICAL_EXAM_REQUEST',
  'TRAINING_LOCK',
  'CARE_SCHEDULE',
  'TRAINING_CLASS',
  'TRAINING_SESSION',
  'SESSION_PARTICIPANT',
  'PERFORMANCE_EVALUATION',
  'FEEDING_PLAN',
  'INCIDENT',
  'CHECKLIST_ITEM',
  'SUPPLY_ITEM',
  'SUPPLY_REQUEST',
  'DAILY_FEE',
  'USER',
];

export default function AuditLogPage() {
  const user = useStore((state) => state.currentUser);
  const period = usePeriod('7d');
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState<AuditAction | ''>('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  useCrumbs([{ label: 'Nhật ký thao tác' }]);

  const allowed = can(user, 'audit.view');
  const users = useService(() => (allowed ? listAllUsers() : Promise.resolve([])), [allowed]);
  const names = useMemo(() => new Map((users.data ?? []).map((entry) => [entry.id, entry.fullName] as const)), [users.data]);
  const filterKey = `${period.from}|${period.to}|${actorId}|${action}|${entityType}`;
  // Đổi bộ lọc thì về trang 1.
  const [lastKey, setLastKey] = useState(filterKey);
  if (lastKey !== filterKey) {
    setLastKey(filterKey);
    setPage(1);
  }
  const logs = useService(
    () =>
      !allowed || period.invalid
        ? Promise.resolve(null)
        : listAuditLogs({ page, limit: PAGE_SIZE, from: period.from, to: period.to, actorId: actorId || undefined, action: action || undefined, entityType: entityType || undefined }),
    [allowed, page, filterKey, period.invalid],
  );
  const groups = useMemo(() => groupByDay(logs.data?.items ?? []), [logs.data]);

  if (!allowed) return <NotFound message="Trang này dành cho Quản lý CLB." />;
  const meta = logs.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader title="Nhật ký thao tác" description="Ai đã làm gì, lúc nào. Bấm một dòng để xem trước và sau khi đổi." />

      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-gray-200/80">
        <PeriodBar period={period} />
        <div className="flex flex-wrap gap-2">
          <FilterSelect value={actorId} onChange={setActorId} label="Người làm">
            <option value="">Mọi người</option>
            {users.data?.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.fullName}{entry.role ? ` · ${roleLabel[entry.role]}` : ''}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect value={action} onChange={(value) => setAction(value as AuditAction | '')} label="Thao tác">
            <option value="">Mọi thao tác</option>
            {AUDIT_ACTIONS.map((value) => (
              <option key={value} value={value}>
                {auditActionText[value]}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect value={entityType} onChange={setEntityType} label="Đối tượng">
            <option value="">Mọi đối tượng</option>
            {ENTITY_FILTERS.map((value) => (
              <option key={value} value={value}>
                {auditEntityText[value]}
              </option>
            ))}
          </FilterSelect>
        </div>
      </div>

      {period.invalid ? null : logs.loading && !logs.data ? (
        <Skeleton rows={8} />
      ) : logs.error ? (
        <ErrorBox message={logs.error} />
      ) : groups.length === 0 ? (
        <EmptyState title="Không có thao tác nào" hint="Thử mở rộng kỳ hoặc bỏ bớt bộ lọc." />
      ) : (
        <div className={cn('space-y-5 transition-opacity', logs.loading && 'opacity-60')}>
          {groups.map((group) => (
            <section key={group.day}>
              <h2 className="mb-2 text-sm font-semibold text-gray-700">{group.label}</h2>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-200/80">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => setOpenId(item.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-emerald-50/40">
                      <span className="w-12 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-gray-500">{formatTime(item.createdAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={cn('font-semibold', !item.actor && item.action === 'LOGIN_FAILED' ? 'text-red-800' : 'text-gray-900')}>{actorText(item, names)}</span>
                          {item.actor?.role && <span className="text-xs text-gray-500">{roleLabel[item.actor.role]}</span>}
                          <Pill tone={ACTION_TONE[item.action]}>{auditActionText[item.action]}</Pill>
                        </span>
                        <span className="mt-0.5 block text-sm text-gray-700">
                          {featureLabel(item.feature)}
                          {featureLabel(item.feature) !== entityLabel(item.entityType) && (
                            <>
                              <span className="text-gray-400"> · </span>
                              {entityLabel(item.entityType)}
                            </>
                          )}
                        </span>
                        {item.reason && <span className="mt-0.5 block truncate text-xs text-gray-500">Lý do: {item.reason}</span>}
                      </span>
                      <ChevronRight size={16} className="mt-1 shrink-0 text-gray-300" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.total, meta.page * meta.limit)} trên {meta.total}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Trang trước" className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30">
                  <ChevronLeft size={18} />
                </button>
                <span className="px-2 tabular-nums">
                  {meta.page}/{meta.totalPages}
                </span>
                <button type="button" onClick={() => setPage(page + 1)} disabled={page >= meta.totalPages} aria-label="Trang sau" className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {openId && <AuditDetailSheet id={openId} names={names} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function groupByDay(items: AuditLog[]) {
  const today = clubDateKey(now());
  const groups: { day: string; label: string; items: AuditLog[] }[] = [];
  for (const item of items) {
    const day = clubDateKey(item.createdAt);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, label: day === today ? 'Hôm nay' : formatDate(item.createdAt), items: [item] });
  }
  return groups;
}

/* ===== Chi tiết: trước và sau ===== */

/** Tên trường hay gặp. Trường khác hiện tên gốc. */
const FIELD_TEXT: Record<string, string> = {
  name: 'Tên',
  fullName: 'Họ tên',
  email: 'Email',
  role: 'Vai trò',
  status: 'Trạng thái',
  healthStatus: 'Sức khỏe',
  lifecycleStatus: 'Vòng đời',
  reason: 'Lý do',
  note: 'Ghi chú',
  description: 'Mô tả',
  ownerId: 'Chủ sở hữu',
  barnId: 'Khu',
  stallId: 'Ô chuồng',
  groomId: 'Groom',
  headTrainerId: 'HLV phụ trách',
  quantityOnHand: 'Tồn',
  reorderThreshold: 'Ngưỡng báo thiếu',
  unit: 'Đơn vị',
  category: 'Loại',
  quantity: 'Số lượng',
  unitPrice: 'Đơn giá',
  dailyFee: 'Phí mỗi ngày',
  effectiveFrom: 'Áp dụng từ',
  score: 'Điểm',
  comment: 'Nhận xét',
  startAt: 'Bắt đầu',
  endAt: 'Kết thúc',
  scheduledStartAt: 'Giờ bắt đầu',
  totalCost: 'Chi phí',
  value: 'Giá trị',
  type: 'Loại',
  done: 'Đã làm',
  lots: 'Lô',
  used: 'Đã lấy',
  received: 'Đã nhập',
  remaining: 'Còn lại',
  dailyAmount: 'Tiền mỗi ngày',
  startDate: 'Từ ngày',
  endDate: 'Đến ngày',
  appliedAt: 'Đã áp dụng lúc',
  appliedBy: 'Người áp dụng',
  method: 'Cách đăng nhập',
  provider: 'Nhà cung cấp',
  ongoingRunsCancelled: 'Lượt đang chạy bị hủy',
  position: 'Tọa độ',
  ineligibilityReason: 'Lý do không tập',
  mode: 'Kiểu',
  assigneeType: 'Cách giao',
  assignedTo: 'Người làm',
  appliesToAll: 'Cho mọi ngựa',
  fromDate: 'Từ ngày',
  toDate: 'Đến ngày',
  taskTypeId: 'Loại việc',
  usageId: 'Mã lần xuất',
  microchipId: 'Số chip',
  generated: 'Số checklist đã sinh',
  elapsedMs: 'Thời gian chạy (ms)',
  notes: 'Ghi chú',
  stoppedReason: 'Lý do dừng sớm',
  cost: 'Chi phí buổi khám',
  recoveryStatus: 'Mức hồi phục',
};

function fieldName(key: string) {
  return FIELD_TEXT[key] ?? key;
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Trống';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return value.toLocaleString('vi-VN');
  if (typeof value === 'string') return ISO_TIME.test(value) ? formatDateTime(value) : UUID.test(value) ? `mã ${value.slice(0, 8)}` : value;
  // Danh sách (vd các lô bị trừ): mỗi phần tử một cụm, bỏ các mã id.
  if (Array.isArray(value)) return value.length ? value.map(valueText).join('; ') : 'Trống';
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key, entry]) => !(typeof entry === 'string' && UUID.test(entry) && /id$/i.test(key)))
      .map(([key, entry]) => `${fieldName(key)} ${valueText(entry)}`)
      .join(', ');
  }
  return String(value);
}

function diffRows(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  return keys
    .map((key) => ({ key, before: before?.[key], after: after?.[key] }))
    .filter((row) => !before || !after || JSON.stringify(row.before) !== JSON.stringify(row.after));
}

function entityLink(entityType: string, entityId: string): string | undefined {
  if (entityType === 'HORSE') return links.horse(entityId);
  if (entityType === 'MEDICAL_CASE') return links.case(entityId);
  return undefined;
}

function AuditDetailSheet({ id, names, onClose }: { id: string; names: Map<string, string>; onClose: () => void }) {
  const detail = useService(() => getAuditLog(id), [id]);
  const data = detail.data;
  const rows = data ? diffRows(data.before, data.after) : [];
  const href = data ? entityLink(data.entityType, data.entityId) : undefined;

  return (
    <Sheet
      open
      onClose={onClose}
      title={data ? `${auditActionText[data.action]} ${entityLabel(data.entityType).toLowerCase()}` : 'Chi tiết thao tác'}
      description={data ? `${actorText(data, names)} · ${formatDateTime(data.createdAt)}` : undefined}
    >
      {detail.loading && !data ? (
        <Skeleton rows={5} />
      ) : detail.error ? (
        <ErrorBox message={detail.error} />
      ) : (
        data && (
          <div className="space-y-5">
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-gray-500">Chức năng</dt>
              <dd className="text-gray-900">{featureLabel(data.feature)}</dd>
              <dt className="text-gray-500">Đối tượng</dt>
              <dd className="min-w-0 text-gray-900">
                {entityLabel(data.entityType)}
                {href && (
                  <Link to={href} className="ml-2 text-emerald-700 hover:underline">
                    Mở
                  </Link>
                )}
              </dd>
              {data.actor?.role && (
                <>
                  <dt className="text-gray-500">Vai trò</dt>
                  <dd className="text-gray-900">{roleLabel[data.actor.role]}</dd>
                </>
              )}
              {data.reason && (
                <>
                  <dt className="text-gray-500">Lý do</dt>
                  <dd className="whitespace-pre-line text-gray-900">{data.reason}</dd>
                </>
              )}
            </dl>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">{data.before && data.after ? 'Các trường đã đổi' : data.after ? 'Dữ liệu tạo mới' : 'Dữ liệu trước khi xóa'}</h3>
              {rows.length === 0 ? (
                <p className="text-sm text-gray-500">Không có chi tiết trước và sau cho thao tác này.</p>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-200/80">
                  {rows.map((row) => (
                    <li key={row.key} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[9rem_1fr]">
                      <span className="text-gray-500">{fieldName(row.key)}</span>
                      <span className="min-w-0 break-words">
                        {data.before && (
                          <span className={cn('text-gray-500', data.after && 'line-through decoration-gray-300')}>{valueText(row.before)}</span>
                        )}
                        {data.before && data.after && <span className="px-1.5 text-gray-400">→</span>}
                        {data.after && <span className="font-medium text-emerald-800">{valueText(row.after)}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )
      )}
    </Sheet>
  );
}
