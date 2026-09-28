import { useMemo, useState } from 'react';
import { Check, Clock, Database, Play, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  getPermissionMatrix,
  getSettings,
  listAuditLogs,
  listAuditOptions,
  listUsers,
  nudgeClock,
  resetToSeedData,
  runScheduledJobs,
  setClock,
  setSimulationSpeed,
  setUserActive,
  setUserRole,
} from '../../services/system.service';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  ErrorBox,
  Field,
  FilterSelect,
  Input,
  Modal,
  Notice,
  PageHeader,
  Pill,
  SearchInput,
  Segmented,
  SectionTitle,
  Select,
  Skeleton,
  Toolbar,
  useToast,
} from '../../components/ui';
import { AuditList } from './AuditList';
import { roleLabel } from '../../lib/labels';
import { formatDateTime } from '../../lib/format';
import { now } from '../../lib/clock';
import type { UserRole } from '../../types/domain';

type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

/* ===== Nhân sự ===== */

export function AdminUsers() {
  const { data, loading, reload } = useService(() => listUsers(), []);
  const action = useAction();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [role, setRole] = useState<UserRole>('GROOM');
  const [locking, setLocking] = useState<UserRow | null>(null);

  const rows = useMemo(
    () =>
      (data ?? [])
        .filter((user) => !roleFilter || user.role === roleFilter)
        .filter((user) => !search || `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase())),
    [data, roleFilter, search],
  );

  if (loading) return <Skeleton rows={6} />;

  const counts = (data ?? []).reduce<Record<string, number>>((acc, user) => {
    acc[user.role] = (acc[user.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhân sự"
        description="Gán vai trò và khóa tài khoản. Khu phụ trách của huấn luyện viên được gán ở danh mục khu chuồng."
      />
      {action.error && <ErrorBox message={action.error} />}

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc email…" className="min-w-[240px] flex-1" />
        <Segmented
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: '', label: 'Tất cả' },
            ...(Object.keys(roleLabel) as UserRole[]).map((item) => ({
              value: item,
              label: roleLabel[item].replace('Quản lý câu lạc bộ', 'Quản lý').replace('Huấn luyện viên trưởng', 'HLV trưởng'),
              badge: counts[item],
            })),
          ]}
        />
      </Toolbar>

      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        pageSize={20}
        columns={[
          {
            key: 'name',
            header: 'Tài khoản',
            render: (row) => (
              <div className="flex items-center gap-3">
                <Avatar name={row.name} size={36} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                    {row.name}
                    {!row.active && <Pill tone="red">Đã khóa</Pill>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {row.email} · {row.phone}
                  </p>
                </div>
              </div>
            ),
          },
          { key: 'role', header: 'Vai trò', render: (row) => <span className="font-medium text-gray-700">{roleLabel[row.role]}</span> },
          {
            key: 'resp',
            header: 'Trách nhiệm đang giữ',
            render: (row) =>
              row.responsibilities.length ? (
                <ul className="space-y-0.5 text-xs text-gray-500">
                  {row.responsibilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-xs text-gray-300">—</span>
              ),
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (row) => (
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(row);
                    setRole(row.role);
                    action.clearError();
                  }}
                >
                  Đổi vai trò
                </Button>
                <Button
                  size="sm"
                  variant={row.active ? 'ghost' : 'soft'}
                  onClick={async () => {
                    if (row.active) {
                      setLocking(row);
                      return;
                    }
                    const done = await action.run(() => setUserActive(row.id, true));
                    if (done !== undefined) {
                      toast.push(`Đã mở khóa ${row.name}`, 'success');
                      reload();
                    }
                  }}
                >
                  {row.active ? 'Khóa' : 'Mở khóa'}
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Đổi vai trò — ${editing?.name ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Hủy
            </Button>
            <Button
              disabled={action.pending}
              onClick={async () => {
                if (!editing) return;
                const done = await action.run(() => setUserRole(editing.id, role));
                if (done !== undefined) {
                  toast.push('Đã đổi vai trò', 'success');
                  setEditing(null);
                  reload();
                }
              }}
            >
              Lưu
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {action.error && <ErrorBox message={action.error} />}
          <Field label="Vai trò mới">
            <Select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              {(Object.keys(roleLabel) as UserRole[]).map((value) => (
                <option key={value} value={value}>
                  {roleLabel[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Notice tone="info">
            Không đổi được vai trò khi tài khoản còn là chủ của ngựa đang ở câu lạc bộ, còn phụ trách khu có ngựa, hoặc còn
            là Groom của ngựa nào. Hãy chuyển trách nhiệm cho người khác trước.
          </Notice>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!locking}
        title={`Khóa tài khoản ${locking?.name ?? ''}`}
        message="Tài khoản bị khóa không đăng nhập được. Các trách nhiệm dưới đây vẫn giữ nguyên và cần được chuyển cho người khác."
        consequences={locking?.responsibilities.length ? locking.responsibilities : ['Tài khoản không giữ trách nhiệm nào.']}
        confirmLabel="Xác nhận khóa"
        pending={action.pending}
        onClose={() => setLocking(null)}
        onConfirm={async () => {
          if (!locking) return;
          const done = await action.run(() => setUserActive(locking.id, false));
          if (done !== undefined) {
            toast.push(`Đã khóa ${locking.name}`, 'success');
            setLocking(null);
            reload();
          }
        }}
      />
    </div>
  );
}

/* ===== Ma trận phân quyền ===== */

export function AdminPermissions() {
  const { data, loading } = useService(() => getPermissionMatrix(), []);

  if (loading || !data) return <Skeleton rows={5} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ma trận phân quyền"
        description="Sinh trực tiếp từ bảng quyền dùng chung — menu, nút bấm và tầng dịch vụ đều hỏi cùng một nơi. Rê chuột lên dấu tích để xem phạm vi."
      />
      {data.groups.map((group) => (
        <Card key={group.group} className="overflow-x-auto p-0 sm:p-0">
          <div className="px-5 pt-5 sm:px-6">
            <SectionTitle icon={<ShieldCheck size={16} />}>{group.group}</SectionTitle>
          </div>
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-y border-emerald-950/[0.06] bg-emerald-50/30">
                <th className="w-16 px-5 py-2.5 text-xs font-semibold text-gray-500">Mã</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Chức năng</th>
                {data.roles.map((item) => (
                  <th key={item} className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500">
                    {roleLabel[item].replace('Quản lý câu lạc bộ', 'Quản lý').replace('Huấn luyện viên trưởng', 'HLV trưởng')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.key} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 font-mono text-xs text-gray-400">{row.code}</td>
                  <td className="px-3 py-2.5 text-gray-700">{row.feature}</td>
                  {row.cells.map((cell) => (
                    <td key={cell.role} className="px-3 py-2.5 text-center" title={cell.scopeLabel ?? 'Không có quyền'}>
                      {cell.allowed ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <Check size={12} />
                          {cell.scopeLabel}
                        </span>
                      ) : (
                        <X size={14} className="mx-auto text-gray-200" />
                      )}
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

/* ===== Nhật ký thao tác ===== */

export function AdminAudit() {
  const [filters, setFilters] = useState({ userId: '', action: '', entityType: '' });
  const options = useService(() => listAuditOptions(), []);
  const { data, loading } = useService(() => listAuditLogs(filters), [filters.userId, filters.action, filters.entityType]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhật ký thao tác"
        description="Mọi thao tác thêm, sửa, xóa đều được ghi kèm người thực hiện, thời điểm, giá trị trước và sau, lý do."
      />
      <Toolbar>
        <FilterSelect label="Người thực hiện" value={filters.userId} onChange={(value) => setFilters({ ...filters, userId: value })}>
          <option value="">Mọi người thực hiện</option>
          {options.data?.users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Hành động" value={filters.action} onChange={(value) => setFilters({ ...filters, action: value })}>
          <option value="">Mọi hành động</option>
          {options.data?.actions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Đối tượng" value={filters.entityType} onChange={(value) => setFilters({ ...filters, entityType: value })}>
          <option value="">Mọi loại đối tượng</option>
          {options.data?.entityTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <span className="ml-auto text-sm text-gray-400">{data?.length ?? 0} dòng</span>
      </Toolbar>
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Công cụ hệ thống"
        description="Giờ hệ thống, bộ mô phỏng thiết bị đeo, tác vụ định kỳ và khôi phục dữ liệu khởi tạo."
      />
      {action.error && <ErrorBox message={action.error} />}

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <SectionTitle icon={<Clock size={16} />}>Giờ hệ thống</SectionTitle>
          <p className="mb-4 text-sm font-light text-gray-500">
            Mọi quy tắc thời gian đọc từ đây. Đặt lệch giờ chỉ dùng khi cần kiểm thử theo mốc thời gian — đồng hồ vẫn chạy
            tiếp, không đứng yên.
          </p>
          <p className="mb-4 rounded-xl bg-emerald-50/60 p-3 font-mono text-sm text-gray-700">
            {formatDateTime(now())} · {offsetLabel(settings.data?.clockMode, settings.data?.clockOffsetMs)}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Đặt tới mốc" className="min-w-[220px] flex-1">
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
            <Button
              variant="secondary"
              onClick={() => {
                nudgeClock(3_600_000);
                settings.reload();
              }}
            >
              +1 giờ
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                nudgeClock(86_400_000);
                settings.reload();
              }}
            >
              +1 ngày
            </Button>
            <Button
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

        <Card variant="flat" className="lg:col-span-5">
          <SectionTitle icon={<Play size={16} />}>Thiết bị đeo mô phỏng</SectionTitle>
          <p className="mb-4 text-sm font-light text-gray-500">
            Buổi tập nhận nhịp tim và tốc độ từ bộ mô phỏng chạy trong ứng dụng. Tốc độ mới áp dụng cho các buổi bắt đầu sau
            khi đổi.
          </p>
          <Segmented
            value={String(settings.data?.simSpeed ?? 1)}
            onChange={(value) => {
              setSimulationSpeed(Number(value));
              settings.reload();
            }}
            options={[1, 5, 10].map((speed) => ({ value: String(speed), label: `×${speed}` }))}
          />
        </Card>

        <Card variant="flat" className="lg:col-span-5">
          <SectionTitle icon={<RefreshCw size={16} />}>Tác vụ định kỳ</SectionTitle>
          <p className="mb-4 text-sm font-light text-gray-500">
            Quét ngựa quá hạn khám định kỳ trên 7 ngày để gửi cảnh báo cho bác sĩ và quản lý (mỗi ngựa một lần cho tới
            khi được khám).
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
            <div className="mt-4 rounded-xl bg-white p-4 text-sm">
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

        <Card tone="danger" className="lg:col-span-7">
          <SectionTitle icon={<Database size={16} />}>Khôi phục dữ liệu khởi tạo</SectionTitle>
          <p className="mb-4 text-sm font-light text-gray-500">
            Xóa toàn bộ dữ liệu đang có và tạo lại bộ dữ liệu mẫu cho buổi demo. Thao tác này không hoàn tác được.
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
          'Mọi hồ sơ, lớp học, buổi tập và bệnh án đã tạo sẽ mất.',
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
