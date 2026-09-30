import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/store';
import { useAction, useService } from '../hooks/useService';
import { getPermissionMatrix } from '../auth/permission-matrix';
import { listBarns } from '../api/stable';
import { changePassword } from '../api/auth';
import { Avatar, Button, Card, ErrorBox, Field, InfoRow, Notice, PageHeader, PasswordInput, Pill, SectionTitle, Skeleton, useToast } from '../components/ui';
import { roleLabel, SCOPE_TEXT } from '../lib/profile-labels';

export default function Profile() {
  const user = useStore((state) => state.currentUser);
  const logout = useStore((state) => state.logout);
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading } = useService(() => getPermissionMatrix(), []);
  const isTrainer = user?.role === 'HEAD_TRAINER';
  const barns = useService(() => (isTrainer ? listBarns() : Promise.resolve([])), [isTrainer]);
  const action = useAction();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  if (!user) return null;

  const zoneNames = (barns.data ?? []).filter((barn) => barn.headTrainerId === user.id).map((barn) => barn.name);
  const otherRoles = (user.roles ?? []).filter((role) => role !== user.role);

  const groups = (data?.groups ?? [])
    .map((group) => ({
      group: group.group,
      rows: group.rows
        .map((row) => {
          const cell = row.cells.find((item) => item.role === user.role);
          return cell?.allowed ? { code: row.code, feature: row.feature, scope: cell.scopeLabel } : null;
        })
        .filter(Boolean) as { code: string; feature: string; scope?: string }[],
    }))
    .filter((group) => group.rows.length > 0);

  const mismatch = confirm.length > 0 && confirm !== next;
  const tooShort = next.length > 0 && next.length < 8;

  const submitPassword = async () => {
    const done = await action.run(async () => {
      await changePassword(current, next);
      return true;
    });
    if (!done) return;
    toast.push('Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.', 'success');
    await logout();
    navigate('/login');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Hồ sơ cá nhân" description="Thông tin tài khoản, phạm vi quyền và đổi mật khẩu." />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:sticky lg:top-6 lg:col-span-4">
          <Card>
            <div className="flex items-center gap-4">
              <Avatar name={user.name} size={64} />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">{roleLabel[user.role]}</p>
              </div>
            </div>
            <div className="mt-5 border-t border-gray-100 pt-3">
              <InfoRow label="Email" value={user.email} />
              <InfoRow label="Trạng thái" value={user.active ? 'Đang hoạt động' : 'Đã khóa'} />
              {otherRoles.length > 0 && <InfoRow label="Kiêm nhiệm" value={otherRoles.map((role) => roleLabel[role]).join(', ')} />}
              {isTrainer && (
                <InfoRow label="Khu phụ trách" value={barns.loading ? '…' : zoneNames.length ? zoneNames.join(', ') : 'Chưa được giao khu'} />
              )}
            </div>
          </Card>
          <Card variant="flat">
            <p className="text-sm font-medium text-gray-700">Phạm vi dữ liệu</p>
            <p className="mt-1 text-sm text-gray-500">{SCOPE_TEXT[user.role]}</p>
            <p className="mt-4 text-xs text-gray-500">
              Cần đổi vai trò hoặc khu phụ trách? Liên hệ Quản lý câu lạc bộ — vai trò gán ở mục Nhân sự, khu gán ở danh mục khu chuồng.
            </p>
          </Card>
          <Card>
            <SectionTitle icon={<KeyRound size={16} />}>Đổi mật khẩu</SectionTitle>
            <div className="space-y-3">
              {action.error && <ErrorBox message={action.error} />}
              <Field label="Mật khẩu hiện tại">
                <PasswordInput value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" />
              </Field>
              <Field label="Mật khẩu mới" error={tooShort ? 'Tối thiểu 8 ký tự' : undefined}>
                <PasswordInput value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" />
              </Field>
              <Field label="Nhập lại mật khẩu mới" error={mismatch ? 'Hai lần nhập chưa khớp' : undefined}>
                <PasswordInput value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />
              </Field>
              <Notice tone="info">Đổi xong, mọi phiên đăng nhập của bạn bị đăng xuất.</Notice>
              <Button
                className="w-full"
                disabled={action.pending || !current || next.length < 8 || next !== confirm}
                onClick={submitPassword}
              >
                {action.pending ? 'Đang đổi…' : 'Đổi mật khẩu'}
              </Button>
            </div>
          </Card>
        </div>

        <Card className="lg:col-span-8">
          <SectionTitle
            icon={<ShieldCheck size={16} />}
            action={
              user.role === 'CLUB_MANAGER' ? (
                <Link to="/admin/permissions" className="text-sm font-medium text-emerald-700 hover:underline">
                  Ma trận phân quyền đầy đủ
                </Link>
              ) : undefined
            }
          >
            Những việc bạn được làm
          </SectionTitle>
          {loading && <Skeleton rows={4} />}
          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
            {groups.map((group) => (
              <div key={group.group}>
                <p className="mb-2 text-sm font-semibold text-gray-900">{group.group}</p>
                <div className="space-y-1">
                  {group.rows.map((item) => (
                    <div key={item.feature} className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0">
                      <p className="text-sm text-gray-700">
                        <span className="mr-2 font-mono text-[11px] text-gray-400">{item.code}</span>
                        {item.feature}
                      </p>
                      {item.scope && <Pill tone="slate">{item.scope}</Pill>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
