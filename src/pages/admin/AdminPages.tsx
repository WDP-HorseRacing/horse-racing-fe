import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { useFormErrors } from '../../hooks/useFormErrors';
import { createUser, listAllUsers, resetUserPassword, setUserStatus, updateUser } from '../../api/users';
import type { Role, UserAccount } from '../../api/types';
import {
  Avatar,
  Button,
  CancelButton,
  ConfirmDialog,
  DataTable,
  ErrorBox,
  FilterTabs,
  Field,
  Input,
  Modal,
  NotFound,
  Notice,
  PageHeader,
  PasswordInput,
  Pill,
  SearchInput,
  Select,
  Skeleton,
  cn,
  invalidClass,
  useToast,
} from '../../components/ui';
import { can } from '../../auth/permissions';
import { roleLabel } from '../../lib/labels';
import { userStatusLabel } from '../../lib/api-labels';
import { useStore } from '../../store/store';
import { FEATURES } from '../../config/features';
import HandoverDialog from './HandoverDialog';

const ROLES: Role[] = ['CLUB_MANAGER', 'HEAD_TRAINER', 'VETERINARIAN', 'GROOM', 'HORSE_OWNER'];
const shortRole = (role: Role) => roleLabel[role].replace('Quản lý câu lạc bộ', 'Quản lý').replace('Huấn luyện viên trưởng', 'HLV trưởng');

// Giới hạn như backend (users/dto/user.dto.ts).
const NAME_MAX = 160;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nameError(value: string) {
  if (!value.trim()) return 'Nhập họ và tên';
  if (value.trim().length > NAME_MAX) return `Tối đa ${NAME_MAX} ký tự`;
  return undefined;
}

function passwordError(value: string) {
  if (!value) return 'Nhập mật khẩu';
  if (!value.trim()) return 'Mật khẩu không được chỉ có khoảng trắng';
  if (value.length < PASSWORD_MIN) return `Mật khẩu tối thiểu ${PASSWORD_MIN} ký tự`;
  return undefined;
}

/* ===== Nhân sự ===== */

export function AdminUsers() {
  const me = useStore((state) => state.currentUser);
  if (!can(me, 'admin.users')) return <NotFound message="Trang này dành cho Quản lý CLB." />;
  return <UsersPage />;
}

function UsersPage() {
  const me = useStore((state) => state.currentUser);
  const { data, loading, error, reload } = useService(() => listAllUsers(), []);
  const lockAction = useAction();
  const unlockAction = useAction();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [locking, setLocking] = useState<UserAccount | null>(null);
  const [unlocking, setUnlocking] = useState<UserAccount | null>(null);
  const [handover, setHandover] = useState<UserAccount | null>(null);
  const [resettingPassword, setResettingPassword] = useState<UserAccount | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? [])
      .filter((user) => user.id !== me?.id)
      .filter((user) => !roleFilter || user.role === roleFilter)
      .filter((user) => !term || `${user.fullName} ${user.email}`.toLowerCase().includes(term));
  }, [data, roleFilter, search, me?.id]);

  const counts = useMemo(
    () =>
      (data ?? []).reduce<Partial<Record<Role, number>>>((acc, user) => {
        if (user.role) acc[user.role] = (acc[user.role] ?? 0) + 1;
        return acc;
      }, {}),
    [data],
  );

  if (loading && !data) return <Skeleton rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhân sự"
        description="Tạo tài khoản, đổi vai trò, khóa hoặc mở lại tài khoản. Khu phụ trách của HLV trưởng gán trên Sơ đồ chuồng."
        actions={
          <Button onClick={() => setCreating(true)}>
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
                  {FEATURES.training && row.role === 'HEAD_TRAINER' && (
                    <Button size="sm" variant="inline" onClick={() => setHandover(row)}>
                      Bàn giao
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setEditing(row)}>
                    Sửa
                  </Button>
                  {row.id !== me?.id && row.role !== 'CLUB_MANAGER' && (
                    <Button size="sm" variant="inline" onClick={() => setResettingPassword(row)}>
                      Đặt lại mật khẩu
                    </Button>
                  )}
                  {row.id !== me?.id && (
                    <Button
                      size="sm"
                      variant={row.status === 'ACTIVE' ? 'inlineDanger' : 'inline'}
                      onClick={() => {
                        if (row.status === 'ACTIVE') {
                          lockAction.clearError();
                          setLocking(row);
                        } else {
                          unlockAction.clearError();
                          setUnlocking(row);
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

      <CreateUserDialog open={creating} onClose={() => setCreating(false)} onDone={reload} />
      <EditUserDialog user={editing} isSelf={editing?.id === me?.id} onClose={() => setEditing(null)} onDone={reload} />
      <ResetPasswordDialog user={resettingPassword} onClose={() => setResettingPassword(null)} onDone={reload} />

      <ConfirmDialog
        open={!!locking}
        title={`Khóa tài khoản ${locking?.fullName ?? ''}`}
        message={
          <>
            <p>Tài khoản bị khóa không đăng nhập được nữa. Có thể mở lại bất cứ lúc nào.</p>
            {lockAction.error && (
              <div className="mt-3">
                <ErrorBox message={lockAction.error} />
                {locking?.role === 'HEAD_TRAINER' && FEATURES.training && (
                  <Button
                    variant="inline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setHandover(locking);
                      setLocking(null);
                    }}
                  >
                    Bàn giao công việc trước
                  </Button>
                )}
              </div>
            )}
          </>
        }
        consequences={['Không khóa được khi tài khoản còn phụ trách ngựa, khu hoặc lịch việc; hãy bàn giao trước.']}
        confirmLabel="Xác nhận khóa"
        pending={lockAction.pending}
        onClose={() => setLocking(null)}
        onConfirm={async () => {
          if (!locking || lockAction.pending) return;
          const done = await lockAction.run(() => setUserStatus(locking.id, 'LOCKED'));
          if (done) {
            toast.push(`Đã khóa ${locking.fullName}`, 'success');
            setLocking(null);
            reload();
          }
        }}
      />
      <ConfirmDialog
        open={!!unlocking}
        title={`Mở lại tài khoản ${unlocking?.fullName ?? ''}`}
        message="Người dùng đăng nhập lại được bằng mật khẩu hiện tại."
        confirmLabel="Mở lại"
        danger={false}
        pending={unlockAction.pending}
        onClose={() => setUnlocking(null)}
        onConfirm={async () => {
          if (!unlocking || unlockAction.pending) return;
          const done = await unlockAction.run(() => setUserStatus(unlocking.id, 'ACTIVE'));
          if (done !== undefined) {
            toast.push(`Đã mở lại tài khoản ${unlocking.fullName}`, 'success');
            setUnlocking(null);
            reload();
          }
        }}
      >
        {unlockAction.error && <ErrorBox message={unlockAction.error} />}
      </ConfirmDialog>
      {handover && (
        <HandoverDialog
          from={handover}
          trainers={data ?? []}
          onClose={() => setHandover(null)}
          onDone={() => {
            setHandover(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ===== Tạo tài khoản ===== */

interface UserForm {
  fullName: string;
  email: string;
  role: Role;
  password: string;
}

const emptyForm: UserForm = { fullName: '', email: '', role: 'GROOM', password: '' };

function CreateUserDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [form, setForm] = useState<UserForm>(emptyForm);
  const errors = useMemo(
    () => ({
      fullName: nameError(form.fullName),
      email: !form.email.trim() ? 'Nhập email' : !EMAIL_PATTERN.test(form.email.trim()) ? 'Email chưa đúng dạng, ví dụ ten@horseracing.vn' : undefined,
      password: passwordError(form.password),
    }),
    [form],
  );
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const { reset } = f;

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    action.clearError();
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof UserForm>(key: K, value: UserForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (action.fieldErrors[key] || action.field === key) action.clearError();
  };
  const serverOnField = (['fullName', 'email', 'password'] as const).some((key) => action.fieldErrors[key] || action.field === key);

  const submit = async () => {
    if (action.pending || !f.attempt()) return;
    const done = await action.run(() => createUser({ fullName: form.fullName.trim(), email: form.email.trim(), role: form.role, password: form.password }));
    if (done) {
      toast.push(`Đã tạo tài khoản ${done.fullName}`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tạo tài khoản"
      dirty={JSON.stringify(form) !== JSON.stringify(emptyForm)}
      busy={action.pending}
      onSave={() => void submit()}
      saveLabel="Tạo tài khoản"
      description="Tài khoản dùng email để đăng nhập. Người dùng nên đổi mật khẩu sau lần đăng nhập đầu."
      footer={
        <>
          <CancelButton variant="secondary" />
          <Button disabled={action.pending} onClick={submit}>
            {action.pending ? 'Đang tạo…' : 'Tạo tài khoản'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {action.error && !serverOnField && <ErrorBox message={action.error} />}
        <Field label="Họ và tên" required name="fullName" error={f.show('fullName')} onBlur={f.blur('fullName')}>
          <Input value={form.fullName} maxLength={NAME_MAX} onChange={(event) => set('fullName', event.target.value)} className={cn(f.show('fullName') && invalidClass)} />
        </Field>
        <Field label="Email" required name="email" error={f.show('email')} onBlur={f.blur('email')}>
          <Input
            type="email"
            value={form.email}
            maxLength={EMAIL_MAX}
            onChange={(event) => set('email', event.target.value)}
            placeholder="ten@horseracing.vn"
            className={cn(f.show('email') && invalidClass)}
          />
        </Field>
        <Field label="Vai trò" required>
          <Select value={form.role} onChange={(event) => set('role', event.target.value as Role)}>
            {ROLES.filter((r) => r !== 'CLUB_MANAGER').map((value) => (
              <option key={value} value={value}>
                {roleLabel[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mật khẩu ban đầu" required name="password" error={f.show('password')} onBlur={f.blur('password')} hint={`Tối thiểu ${PASSWORD_MIN} ký tự`}>
          <PasswordInput value={form.password} autoComplete="new-password" onChange={(event) => set('password', event.target.value)} className={cn(f.show('password') && invalidClass)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ===== Sửa tài khoản ===== */

function EditUserDialog({ user, isSelf, onClose, onDone }: { user: UserAccount | null; isSelf: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('GROOM');
  const errors = useMemo(() => ({ fullName: nameError(name) }), [name]);
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const { reset } = f;

  useEffect(() => {
    if (!user) return;
    setName(user.fullName);
    setRole(user.role ?? 'GROOM');
    action.clearError();
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const submit = async () => {
    if (!user || action.pending || !f.attempt()) return;
    const input: { fullName?: string; role?: Role } = {};
    if (name.trim() !== user.fullName) input.fullName = name.trim();
    if (role !== user.role) input.role = role;
    if (!input.fullName && !input.role) {
      onClose();
      return;
    }
    const done = await action.run(() => updateUser(user.id, input));
    if (done) {
      toast.push('Đã lưu tài khoản', 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={`Sửa tài khoản: ${user?.fullName ?? ''}`}
      dirty={!!user && (name !== user.fullName || role !== user.role)}
      busy={action.pending}
      onSave={() => void submit()}
      footer={
        <>
          <CancelButton variant="secondary" />
          <Button disabled={action.pending} onClick={submit}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {action.error && !action.fieldErrors.fullName && action.field !== 'fullName' && <ErrorBox message={action.error} />}
        <Field label="Họ và tên" required name="fullName" error={f.show('fullName')} onBlur={f.blur('fullName')}>
          <Input
            value={name}
            maxLength={NAME_MAX}
            onChange={(event) => {
              setName(event.target.value);
              if (action.error) action.clearError();
            }}
            className={cn(f.show('fullName') && invalidClass)}
          />
        </Field>
        <Field label="Vai trò" hint={isSelf ? 'Không tự đổi vai trò của mình.' : undefined}>
          <Select value={role} onChange={(event) => setRole(event.target.value as Role)} disabled={isSelf}>
            {ROLES.filter((r) => r !== 'CLUB_MANAGER' || user?.role === 'CLUB_MANAGER').map((value) => (
              <option key={value} value={value}>
                {roleLabel[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Notice tone="info">Không đổi được vai trò khi tài khoản còn phụ trách ngựa, khu hoặc lịch việc; hãy bàn giao trước.</Notice>
      </div>
    </Modal>
  );
}

/* ===== Đặt lại mật khẩu ===== */

function ResetPasswordDialog({ user, onClose, onDone }: { user: UserAccount | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [password, setPassword] = useState('');
  const errors = useMemo(() => ({ newPassword: passwordError(password) }), [password]);
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });
  const { reset } = f;

  useEffect(() => {
    if (!user) return;
    setPassword('');
    action.clearError();
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const submit = async () => {
    if (!user || action.pending || !f.attempt()) return;
    const done = await action.run(() => resetUserPassword(user.id, password));
    if (done !== undefined) {
      toast.push(`Đã đặt lại mật khẩu cho ${user.fullName}`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={`Đặt lại mật khẩu cho ${user?.fullName ?? ''}`}
      dirty={password.length > 0}
      busy={action.pending}
      description="Nhân viên đăng nhập ngay bằng mật khẩu này; các phiên đăng nhập cũ bị đăng xuất."
      footer={
        <>
          <CancelButton variant="secondary" />
          <Button disabled={action.pending} onClick={submit}>
            {action.pending ? 'Đang lưu…' : 'Xác nhận đặt lại'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {action.error && !action.fieldErrors.newPassword && action.field !== 'newPassword' && <ErrorBox message={action.error} />}
        <Field label="Mật khẩu mới" required name="newPassword" error={f.show('newPassword')} onBlur={f.blur('newPassword')} hint={`Tối thiểu ${PASSWORD_MIN} ký tự.`}>
          <PasswordInput
            autoFocus
            autoComplete="new-password"
            placeholder="Nhập mật khẩu mới…"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (action.error) action.clearError();
            }}
            className={cn(f.show('newPassword') && invalidClass)}
          />
        </Field>
      </div>
    </Modal>
  );
}
