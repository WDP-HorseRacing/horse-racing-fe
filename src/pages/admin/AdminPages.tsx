import { useState } from 'react';
import { Check, Clock, Database, Play, RefreshCw, ShieldCheck, Wallet, X } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  getPermissionMatrix,
  getSettings,
  getZonesAndStalls,
  listAuditLogs,
  listAuditOptions,
  listUsers,
  resetToSeedData,
  runScheduledJobs,
  setClock,
  nudgeClock,
  setSimulationSpeed,
  setUserActive,
  setUserRole,
} from '../../services/system.service';
import { setClubDefaultDailyRate } from '../../services/horse.service';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  PageHeader,
  Pill,
  SectionTitle,
  Select,
  Skeleton,
} from '../../components/ui';
import { AuditList } from './AuditList';
import { roleLabel, stallTypeLabel } from '../../lib/labels';
import { formatDateTime, formatMoney } from '../../lib/format';
import { now } from '../../lib/clock';
import type { UserRole } from '../../types/domain';

/* ===== Nhân sự ===== */

export function AdminUsers() {
  const { data, loading, reload } = useService(() => listUsers(), []);
  const action = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ role: 'GROOM' as UserRole, zoneId: '' });

  if (loading) return <Skeleton rows={5} />;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Nhân sự và phân quyền"
        description="Gán vai trò, khu phụ trách và khóa tài khoản. Tài khoản bị khóa không đăng nhập được."
      />
      {action.error && <ErrorBox message={action.error} />}

      <div className="space-y-2">
        {data?.map((user) => (
          <Card key={user.id}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                  {user.name}
                  {!user.active && <Pill tone="red">Đã khóa</Pill>}
                </p>
                <p className="text-xs text-gray-400">
                  {user.email} · {user.phone}
                </p>
              </div>
              <div className="text-sm">
                <p className="font-medium text-gray-700">{roleLabel[user.role]}</p>
                <p className="text-xs text-gray-400">
                  {user.zoneName ?? (user.horseCount > 0 ? `${user.horseCount} ngựa được giao` : 'Toàn câu lạc bộ')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(editing === user.id ? null : user.id);
                    setForm({ role: user.role, zoneId: user.zoneName === 'Khu A' ? 'zone_a' : 'zone_b' });
                  }}
                >
                  Gán vai trò
                </Button>
                <Button
                  size="sm"
                  variant={user.active ? 'ghost' : 'secondary'}
                  onClick={async () => {
                    const done = await action.run(() => setUserActive(user.id, !user.active));
                    if (done !== undefined) reload();
                  }}
                >
                  {user.active ? 'Khóa' : 'Mở khóa'}
                </Button>
              </div>
            </div>

            {editing === user.id && (
              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
                <Field label="Vai trò" className="min-w-[200px] flex-1">
                  <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}>
                    {Object.entries(roleLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                {form.role === 'HEAD_TRAINER' && (
                  <Field label="Khu phụ trách" className="w-40">
                    <Select value={form.zoneId} onChange={(event) => setForm({ ...form, zoneId: event.target.value })}>
                      <option value="zone_a">Khu A</option>
                      <option value="zone_b">Khu B</option>
                    </Select>
                  </Field>
                )}
                <Button
                  onClick={async () => {
                    const done = await action.run(() => setUserRole(user.id, form.role, form.zoneId));
                    if (done !== undefined) {
                      setEditing(null);
                      reload();
                    }
                  }}
                >
                  Lưu
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ===== Ma trận phân quyền ===== */

export function AdminPermissions() {
  const { data, loading } = useService(() => getPermissionMatrix(), []);
  const [selected, setSelected] = useState<{ feature: string; role: string; scope?: string } | null>(null);

  if (loading || !data) return <Skeleton rows={5} />;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Ma trận phân quyền"
        description="Bảng này sinh trực tiếp từ bảng quyền dùng chung của hệ thống — menu, nút bấm và tầng dịch vụ đều hỏi cùng một nơi."
      />

      {selected && (
        <Card tone="success">
          <p className="text-sm text-gray-700">
            <strong>{selected.feature}</strong> — {selected.role}:{' '}
            {selected.scope ? `được phép, phạm vi ${selected.scope.toLowerCase()}` : 'không có quyền'}
          </p>
        </Card>
      )}

      {data.groups.map((group) => (
        <Card key={group.group} className="overflow-x-auto">
          <SectionTitle icon={<ShieldCheck size={16} className="text-emerald-600" />}>{group.group}</SectionTitle>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2 text-xs font-semibold text-gray-400">Chức năng</th>
                {data.roles.map((role) => (
                  <th key={role} className="px-3 py-2 text-center text-xs font-semibold text-gray-400">
                    {roleLabel[role].replace('Quản lý câu lạc bộ', 'Quản lý')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.key} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-2.5 text-gray-700">{row.feature}</td>
                  {row.cells.map((cell) => (
                    <td key={cell.role} className="px-3 py-2.5 text-center">
                      <button
                        onClick={() =>
                          setSelected({ feature: row.feature, role: roleLabel[cell.role], scope: cell.scopeLabel })
                        }
                        className="inline-flex items-center justify-center rounded-lg p-1.5 transition hover:bg-gray-100"
                        title={cell.scopeLabel ?? 'Không có quyền'}
                      >
                        {cell.allowed ? (
                          <Check size={16} className="text-emerald-600" />
                        ) : (
                          <X size={16} className="text-gray-200" />
                        )}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

/* ===== Khu và ô chuồng ===== */

export function AdminZones() {
  const { data, loading } = useService(() => getZonesAndStalls(), []);
  if (loading) return <Skeleton rows={4} />;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title="Khu và ô chuồng" description="Danh mục khu chuồng, ô và tình trạng sử dụng." />
      {data?.map((zone) => (
        <Card key={zone.id}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">{zone.name}</p>
              <p className="text-xs text-gray-400">
                Huấn luyện viên phụ trách: {zone.headTrainerName ?? 'Không có — chỉ xem, không lập giáo án'}
              </p>
            </div>
            <Pill tone="gray">
              {zone.stalls.filter((stall) => stall.horseName).length}/{zone.stalls.length} ô đang dùng
            </Pill>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {zone.stalls.map((stall) => (
              <div
                key={stall.id}
                className={`rounded-xl border p-3 ${stall.horseName ? 'border-emerald-100 bg-emerald-50/40' : 'border-dashed border-gray-200 bg-gray-50/50'}`}
              >
                <p className="font-mono text-xs text-gray-400">{stall.code}</p>
                <p className="mt-1 truncate text-sm font-medium text-gray-800">{stall.horseName ?? 'Trống'}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{stallTypeLabel[stall.type]}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ===== Nhật ký thao tác ===== */

export function AdminAudit() {
  const [filters, setFilters] = useState({ userId: '', action: '', entityType: '' });
  const options = useService(() => listAuditOptions(), []);
  const { data, loading } = useService(
    () => listAuditLogs(filters),
    [filters.userId, filters.action, filters.entityType],
  );

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Nhật ký thao tác"
        description="Mọi thao tác thêm, sửa, xóa, hủy, bắt đầu, kết thúc và xác nhận cảnh báo đều được ghi kèm giá trị trước và sau."
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select value={filters.userId} onChange={(event) => setFilters({ ...filters, userId: event.target.value })}>
            <option value="">Mọi người thực hiện</option>
            {options.data?.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
          <Select value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}>
            <option value="">Mọi hành động</option>
            {options.data?.actions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select
            value={filters.entityType}
            onChange={(event) => setFilters({ ...filters, entityType: event.target.value })}
          >
            <option value="">Mọi loại đối tượng</option>
            {options.data?.entityTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? <Skeleton rows={5} /> : <AuditList rows={data ?? []} />}
    </div>
  );
}

/* ===== Công cụ hệ thống ===== */

/** Mô tả chênh lệch giữa giờ hệ thống và giờ thực bằng lời. */
function offsetLabel(mode: string | undefined, offsetMs: number | undefined) {
  if (mode !== 'SHIFTED' || !offsetMs) return 'đang dùng giờ thực';
  const minutes = Math.round(offsetMs / 60_000);
  const sign = minutes >= 0 ? 'nhanh hơn' : 'chậm hơn';
  const abs = Math.abs(minutes);
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins = abs % 60;
  const parts = [days && `${days} ngày`, hours && `${hours} giờ`, mins && `${mins} phút`].filter(Boolean);
  return `${sign} giờ thực ${parts.join(' ') || '0 phút'}`;
}

export function AdminSystem() {
  const settings = useService(() => getSettings(), []);
  const action = useAction();
  const [log, setLog] = useState<string[] | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [fixedValue, setFixedValue] = useState('');
  const [rateForm, setRateForm] = useState({ value: '', reason: '' });

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Công cụ hệ thống"
        description="Các tiện ích vận hành: giờ hệ thống, tác vụ định kỳ và khôi phục dữ liệu khởi tạo."
      />

      {action.error && <ErrorBox message={action.error} />}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <SectionTitle icon={<Clock size={16} className="text-emerald-600" />}>Giờ hệ thống</SectionTitle>
          <p className="mb-4 text-sm font-light text-gray-500">
            Mọi quy tắc thời gian trong hệ thống đọc từ đây. Đặt lệch giờ chỉ dùng khi cần kiểm thử nghiệp vụ theo
            mốc thời gian — đồng hồ vẫn chạy tiếp, không đứng yên.
          </p>
          <p className="mb-4 rounded-xl bg-gray-50 p-3 font-mono text-sm text-gray-700">
            {formatDateTime(now())} ·{' '}
            {offsetLabel(settings.data?.clockMode, settings.data?.clockOffsetMs)}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Đặt tới mốc" className="min-w-[200px] flex-1">
              <Input type="datetime-local" value={fixedValue} onChange={(event) => setFixedValue(event.target.value)} />
            </Field>
            <Button
              variant="secondary"
              onClick={() => {
                if (!fixedValue) return;
                setClock('SHIFTED', new Date(fixedValue).toISOString());
                settings.reload();
              }}
            >
              Áp dụng
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                nudgeClock(3_600_000);
                settings.reload();
              }}
            >
              +1 giờ
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                nudgeClock(86_400_000);
                settings.reload();
              }}
            >
              +1 ngày
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setClock('REAL');
                settings.reload();
              }}
            >
              Về giờ thực
            </Button>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Play size={16} className="text-emerald-600" />}>Thiết bị đeo mô phỏng</SectionTitle>
          <p className="mb-4 text-sm font-light text-gray-500">
            Thiết bị đeo thật chưa được gắn vào hệ thống. Trong lúc đó, buổi tập nhận dữ liệu từ bộ mô phỏng chạy trong
            ứng dụng. Tốc độ mô phỏng áp dụng cho các buổi bắt đầu sau khi đổi.
          </p>
          <div className="flex gap-2">
            {[1, 5, 10].map((speed) => (
              <button
                key={speed}
                onClick={() => {
                  setSimulationSpeed(speed);
                  settings.reload();
                }}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  settings.data?.simSpeed === speed
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                ×{speed}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<RefreshCw size={16} className="text-emerald-600" />}>Tác vụ định kỳ</SectionTitle>
          <p className="mb-4 text-sm font-light text-gray-500">
            Chạy các việc nền theo chu kỳ: nhắc giáo án sắp hết, nhắc lịch chăm sóc tới hạn hoặc quá hạn, dọn ảnh đã gỡ
            quá 30 ngày.
          </p>
          <Button
            onClick={async () => {
              const result = await action.run(() => runScheduledJobs());
              if (result) setLog(result);
            }}
            disabled={action.pending}
          >
            {action.pending ? 'Đang chạy…' : 'Chạy ngay'}
          </Button>
          {log && (
            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
              {log.length === 0 ? (
                <p className="font-light text-gray-400">Không có việc nào cần xử lý.</p>
              ) : (
                <ul className="space-y-1 text-gray-600">
                  {log.map((line, index) => (
                    <li key={index}>· {line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle icon={<Wallet size={16} className="text-emerald-600" />}>
            Phí nuôi dưỡng mặc định
          </SectionTitle>
          <p className="mb-4 text-sm font-light text-gray-500">
            Áp cho mọi con ngựa chưa được đặt mức riêng. Mức riêng của từng con đặt ở trang chi tiết ngựa, thẻ
            &ldquo;Chuồng trại và phụ trách&rdquo;.
          </p>
          <p className="mb-4 rounded-xl bg-gray-50 p-3 text-lg font-bold text-gray-900 tabular-nums">
            {formatMoney(settings.data?.defaultDailyRate)}
            <span className="ml-1 text-sm font-medium text-gray-400">mỗi ngày</span>
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Mức mới (đ/ngày)" className="min-w-[180px] flex-1" error={action.field === 'value' ? action.error : undefined}>
              <Input
                type="number"
                min={1}
                step={100000}
                value={rateForm.value}
                onChange={(event) => setRateForm({ ...rateForm, value: event.target.value })}
                placeholder="1200000"
              />
            </Field>
            <Field label="Lý do" className="min-w-[180px] flex-1">
              <Input value={rateForm.reason} onChange={(event) => setRateForm({ ...rateForm, reason: event.target.value })} />
            </Field>
            <Button
              onClick={async () => {
                const done = await action.run(() =>
                  setClubDefaultDailyRate(Number(rateForm.value), rateForm.reason),
                );
                if (done !== undefined) {
                  setRateForm({ value: '', reason: '' });
                  settings.reload();
                }
              }}
              disabled={action.pending || !rateForm.value}
            >
              Áp dụng
            </Button>
          </div>
        </Card>

        <Card tone="danger">
          <SectionTitle icon={<Database size={16} className="text-red-500" />}>Khôi phục dữ liệu khởi tạo</SectionTitle>
          <p className="mb-4 text-sm font-light text-gray-500">
            Xóa toàn bộ dữ liệu đang có và tạo lại bộ dữ liệu khởi tạo. Thao tác này không hoàn tác được.
          </p>
          <Button variant="danger" onClick={() => setResetOpen(true)}>
            Khôi phục dữ liệu
          </Button>
        </Card>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Khôi phục dữ liệu khởi tạo"
        message="Toàn bộ dữ liệu hiện có sẽ bị xóa và thay bằng bộ dữ liệu khởi tạo."
        consequences={[
          'Mọi hồ sơ, giáo án, buổi tập và hồ sơ y tế đã tạo sẽ mất.',
          'Nhật ký thao tác và thông báo cũng bị xóa.',
          'Thao tác không hoàn tác được.',
        ]}
        confirmLabel="Khôi phục"
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          resetToSeedData();
          window.location.reload();
        }}
      />
    </div>
  );
}

export function AdminEmpty() {
  return <EmptyState title="Chức năng này chưa được bật" />;
}
