import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { createUser, listAllUsers, setUserStatus, updateUser } from '../../api/users';
import type { Role, UserAccount } from '../../api/types';
import {
  Avatar,
  Button,
  ConfirmDialog,
  DataTable,
  ErrorBox,
  FilterTabs,
  Field,
  Input,
  Modal,
  Notice,
  PageHeader,
  Pill,
  SearchInput,
  Select,
  Skeleton,
  useToast,
} from '../../components/ui';
import { roleLabel } from '../../lib/labels';
import { userStatusLabel } from '../../lib/api-labels';
import { useStore } from '../../store/store';

const ROLES: Role[] = ['CLUB_MANAGER', 'HEAD_TRAINER', 'VETERINARIAN', 'GROOM', 'HORSE_OWNER'];
const shortRole = (role: Role) => roleLabel[role].replace('Quản lý câu lạc bộ', 'Quản lý').replace('Huấn luyện viên trưởng', 'HLV trưởng');

/* ===== Nhân sự ===== */

interface UserForm {
  fullName: string;
  email: string;
  role: Role;
  password: string;
}

const emptyForm: UserForm = { fullName: '', email: '', role: 'GROOM', password: '' };

export function AdminUsers() {
  const me = useStore((state) => state.currentUser);
  const { data, loading, error, reload } = useService(() => listAllUsers(), []);
  const action = useAction();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Role>('GROOM');
  const [locking, setLocking] = useState<UserAccount | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? [])
      .filter((user) => !roleFilter || user.role === roleFilter)
      .filter((user) => !term || `${user.fullName} ${user.email}`.toLowerCase().includes(term));
  }, [data, roleFilter, search]);

  const counts = useMemo(
    () =>
      (data ?? []).reduce<Partial<Record<Role, number>>>((acc, user) => {
        if (user.role) acc[user.role] = (acc[user.role] ?? 0) + 1;
        return acc;
      }, {}),
    [data],
  );

  if (loading && !data) return <Skeleton rows={6} />;

  const passwordShort = form.password.length > 0 && form.password.length < 8;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhân sự"
        description="Tạo tài khoản, đổi vai trò, khóa hoặc mở lại tài khoản. Khu phụ trách của HLV trưởng gán trên Sơ đồ chuồng."
        actions={
          <Button
            onClick={() => {
              setForm(emptyForm);
              action.clearError();
              setCreating(true);
            }}
          >
            <Plus size={16} /> Tạo tài khoản
          </Button>
        }
      />
      {error && <ErrorBox message={error} />}

      <FilterTabs
        active={roleFilter}
        onChange={(key) => setRoleFilter(key as Role | '')}
        tabs={[{ key: '', label: 'Tất cả', count: data?.length ?? 0 }, ...ROLES.map((item) => ({ key: item, label: shortRole(item), count: counts[item] ?? 0 }))]}
        toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc email…" className="min-w-60 flex-1" />}
      >
        <DataTable
          flat
          rows={rows}
          rowKey={(row) => row.id}
          pageSize={20}
          emptyTitle="Không có tài khoản phù hợp"
          columns={[
            {
              key: 'name',
              header: 'Tài khoản',
              render: (row) => (
                <div className="flex items-center gap-3">
                  <Avatar name={row.fullName} size={36} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                      {row.fullName}
                      {row.id === me?.id && <Pill tone="slate">Bạn</Pill>}
                    </p>
                    <p className="text-xs text-gray-500">{row.email}</p>
                  </div>
                </div>
              ),
            },
            { key: 'role', header: 'Vai trò', render: (row) => <span className="font-medium text-gray-700">{row.role ? roleLabel[row.role] : '—'}</span> },
            {
              key: 'status',
              header: 'Trạng thái',
              render: (row) =>
                row.status === 'ACTIVE' ? (
                  <span className="text-sm text-gray-500">{userStatusLabel.ACTIVE}</span>
                ) : (
                  <Pill tone="amber">{userStatusLabel[row.status]}</Pill>
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
                      setEditName(row.fullName);
                      setEditRole(row.role ?? 'GROOM');
                      action.clearError();
                    }}
                  >
                    Sửa
                  </Button>
                  {row.id !== me?.id && (
                    <Button
                      size="sm"
                      variant={row.status === 'ACTIVE' ? 'ghost' : 'soft'}
                      onClick={async () => {
                        if (row.status === 'ACTIVE') {
                          action.clearError();
                          setLocking(row);
                          return;
                        }
                        const done = await action.run(() => setUserStatus(row.id, 'ACTIVE'));
                        if (done !== undefined) {
                          toast.push(`Đã mở lại tài khoản ${row.fullName}`, 'success');
                          reload();
                        }
                      }}
                    >
                      {row.status === 'ACTIVE' ? 'Khóa' : 'Mở lại'}
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </FilterTabs>
      {action.error && !creating && !editing && !locking && <ErrorBox message={action.error} />}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Tạo tài khoản"
        description="Tài khoản dùng email để đăng nhập. Người dùng nên đổi mật khẩu sau lần đăng nhập đầu."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Hủy
            </Button>
            <Button
              disabled={action.pending || !form.fullName.trim() || !form.email.trim() || form.password.length < 8}
              onClick={async () => {
                const done = await action.run(() =>
                  createUser({ fullName: form.fullName.trim(), email: form.email.trim(), role: form.role, password: form.password }),
                );
                if (done) {
                  toast.push(`Đã tạo tài khoản ${done.fullName}`, 'success');
                  setCreating(false);
                  reload();
                }
              }}
            >
              {action.pending ? 'Đang tạo…' : 'Tạo tài khoản'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {action.error && <ErrorBox message={action.error} />}
          <Field label="Họ và tên" required>
            <Input value={form.fullName} maxLength={160} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="ten@horseracing.vn" />
          </Field>
          <Field label="Vai trò" required>
            <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {roleLabel[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mật khẩu ban đầu" required error={passwordShort ? 'Mật khẩu tối thiểu 8 ký tự' : undefined} hint="Tối thiểu 8 ký tự">
            <Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Sửa tài khoản — ${editing?.fullName ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Hủy
            </Button>
            <Button
              disabled={action.pending || !editName.trim()}
              onClick={async () => {
                if (!editing) return;
                const input: { fullName?: string; role?: Role } = {};
                if (editName.trim() !== editing.fullName) input.fullName = editName.trim();
                if (editRole !== editing.role) input.role = editRole;
                if (!input.fullName && !input.role) {
                  setEditing(null);
                  return;
                }
                const done = await action.run(() => updateUser(editing.id, input));
                if (done) {
                  toast.push('Đã lưu tài khoản', 'success');
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
          <Field label="Họ và tên" required>
            <Input value={editName} maxLength={160} onChange={(event) => setEditName(event.target.value)} />
          </Field>
          <Field label="Vai trò">
            <Select value={editRole} onChange={(event) => setEditRole(event.target.value as Role)} disabled={editing?.id === me?.id}>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {roleLabel[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Notice tone="info">
            Hệ thống không cho đổi vai trò khi tài khoản còn là chủ của ngựa đang ở câu lạc bộ, còn là Groom của ngựa nào, hoặc
            còn đứng tên HLV trưởng của một khu. Hãy chuyển trách nhiệm cho người khác trước.
          </Notice>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!locking}
        title={`Khóa tài khoản ${locking?.fullName ?? ''}`}
        message={
          <>
            <p>Tài khoản bị khóa không đăng nhập được nữa. Có thể mở lại bất cứ lúc nào.</p>
            {action.error && (
              <div className="mt-3">
                <ErrorBox message={action.error} />
              </div>
            )}
          </>
        }
        consequences={[
          'Không khóa được khi tài khoản còn phụ trách: Groom còn ngựa được giao, chủ còn ngựa ở câu lạc bộ, HLV trưởng còn đứng tên khu.',
        ]}
        confirmLabel="Xác nhận khóa"
        pending={action.pending}
        onClose={() => setLocking(null)}
        onConfirm={async () => {
          if (!locking) return;
          const done = await action.run(() => setUserStatus(locking.id, 'LOCKED'));
          if (done) {
            toast.push(`Đã khóa ${locking.fullName}`, 'success');
            setLocking(null);
            reload();
          }
        }}
      />
    </div>
  );
}
