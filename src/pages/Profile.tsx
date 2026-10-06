// Hồ sơ cá nhân: thông tin tài khoản, công việc của tôi (vài con số theo vai trò, bấm để đi tới trang liên quan)
// và bảo mật (đổi mật khẩu). Quyền chi tiết của từng vai trò không hiển thị ở đây.
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/store';
import { useAction, useService } from '../hooks/useService';
import { countHorses, listAllHorses } from '../api/horses';
import { listBarns } from '../api/stable';
import { listAllUsers } from '../api/users';
import { getMedicalDashboard, listExamRequests } from '../api/medical';
import { changePassword } from '../api/auth';
import type { UserRole } from '../types/domain';
import { Button, Card, ErrorBox, Field, PageHeader, PasswordInput, SectionTitle, Skeleton, cn, useToast } from '../components/ui';
import { roleLabel, SCOPE_TEXT } from '../lib/profile-labels';
import { links } from '../lib/links';
import { useCrumbs } from '../components/Breadcrumb';
import { isReadOnlyHorse } from '../lib/horse-rules';

interface WorkStat {
  value: number | string;
  label: string;
  to: string;
  warn?: boolean;
}

/** Vài con số công việc theo vai trò, lấy từ các API đã có. */
async function loadWork(role: UserRole, userId: string): Promise<{ stats: WorkStat[]; zones?: string[] }> {
  switch (role) {
    case 'CLUB_MANAGER': {
      const [horses, barns, users] = await Promise.all([countHorses(), listBarns(), listAllUsers({ status: 'ACTIVE' })]);
      return {
        stats: [
          { value: horses, label: 'ngựa ở câu lạc bộ', to: links.horses },
          { value: barns.length, label: 'khu chuồng', to: links.stable },
          { value: users.length, label: 'tài khoản đang hoạt động', to: links.adminUsers },
        ],
      };
    }
    case 'HEAD_TRAINER': {
      const [barns, horses] = await Promise.all([listBarns(), countHorses({ myBarns: true })]);
      const mine = barns.filter((barn) => barn.headTrainerId === userId);
      const waiting = mine.reduce((sum, barn) => sum + barn.pendingStallHorseCount, 0);
      return {
        zones: mine.map((barn) => barn.name),
        stats: [
          { value: mine.length, label: 'khu phụ trách', to: links.stable },
          { value: horses, label: 'ngựa trong khu', to: links.horses },
          { value: waiting, label: 'ngựa chờ xếp ô', to: links.stable, warn: waiting > 0 },
        ],
      };
    }
    case 'VETERINARIAN': {
      const medical = await getMedicalDashboard();
      const urgent = medical.pendingRequests.filter((item) => item.urgent).length;
      return {
        stats: [
          { value: medical.pendingRequests.length, label: 'yêu cầu khám đang chờ', to: links.requests, warn: urgent > 0 },
          { value: medical.openCases.length, label: 'bệnh án đang điều trị', to: links.cases },
          { value: medical.checkups.filter((item) => item.daysLeft < 0).length, label: 'ngựa quá hạn khám định kỳ', to: links.periodic },
        ],
      };
    }
    case 'GROOM': {
      const [horses, requests] = await Promise.all([countHorses({ myHorses: true }), listExamRequests({ status: 'PENDING', limit: 1 })]);
      return {
        stats: [
          { value: horses, label: 'ngựa được giao chăm sóc', to: links.horses },
          { value: requests.meta.total, label: 'yêu cầu khám chờ bác sĩ', to: links.requests },
        ],
      };
    }
    default: {
      const horses = await listAllHorses();
      const active = horses.filter((horse) => !isReadOnlyHorse(horse));
      const unwell = active.filter((horse) => horse.lifecycleStatus === 'ACTIVE' && horse.healthStatus !== 'ELIGIBLE').length;
      return {
        stats: [
          { value: active.length, label: 'ngựa đang ở câu lạc bộ', to: links.horses },
          { value: unwell, label: 'ngựa cần chú ý sức khỏe', to: links.horses, warn: unwell > 0 },
        ],
      };
    }
  }
}

function StatLink({ stat }: { stat: WorkStat }) {
  return (
    <Link to={stat.to} className="group flex flex-col justify-between rounded-xl bg-gray-50 px-4 py-3.5 transition hover:bg-emerald-50/60">
      <span className={cn('text-2xl font-bold tabular-nums', stat.warn ? 'text-amber-700' : 'text-gray-900')}>{stat.value}</span>
      <span className="mt-1 flex items-center justify-between gap-2 text-sm text-gray-500">
        {stat.label}
        <ArrowRight size={14} className="shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
      </span>
    </Link>
  );
}

function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <div className="text-sm font-medium text-gray-900">{children}</div>
      </div>
    </div>
  );
}

export default function Profile() {
  const user = useStore((state) => state.currentUser);
  const logout = useStore((state) => state.logout);
  const navigate = useNavigate();
  const toast = useToast();
  const work = useService(() => (user ? loadWork(user.role, user.id) : Promise.resolve(undefined)), [user?.role, user?.id]);
  const action = useAction();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  // Trang nằm ngoài menu: đường dẫn trên header chỉ có một đoạn.
  useCrumbs([{ label: 'Hồ sơ cá nhân' }], []);

  if (!user) return null;

  const otherRoles = (user.roles ?? []).filter((role) => role !== user.role);
  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((word) => word[0])
      .join('') || '?';
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
    <div className="space-y-5">
      <PageHeader title="Hồ sơ cá nhân" />

      {/* Dải đầu trang */}
      <section className="flex flex-wrap items-center gap-5 rounded-2xl bg-white p-5 shadow-[0_18px_40px_-30px_rgba(6,78,59,0.5)] ring-1 ring-gray-200/80 sm:p-6">
        <span className="flex h-18 w-18 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-2xl font-bold text-white">{initials}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-bold tracking-tight text-gray-900">{user.name}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">{roleLabel[user.role]}</span>
            {otherRoles.map((role) => (
              <span key={role} className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700">
                Kiêm {roleLabel[role].toLowerCase()}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-gray-500">
              <span className={cn('h-2 w-2 rounded-full', user.active ? 'bg-emerald-500' : 'bg-gray-300')} />
              {user.active ? 'Đang hoạt động' : 'Đã khóa'}
            </span>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        {/* Công việc của tôi */}
        <Card className="lg:col-span-7">
          <SectionTitle icon={<BriefcaseBusiness size={16} />}>Công việc của tôi</SectionTitle>
          {work.loading && !work.data ? (
            <Skeleton rows={2} />
          ) : work.error ? (
            <ErrorBox message={work.error} />
          ) : (
            <div className={cn('grid gap-3', (work.data?.stats.length ?? 0) > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
              {work.data?.stats.map((stat) => (
                <StatLink key={stat.label} stat={stat} />
              ))}
            </div>
          )}
          <div className="mt-5 divide-y divide-gray-100 border-t border-gray-100">
            <Detail icon={<Mail size={15} />} label="Email đăng nhập">
              {user.email}
            </Detail>
            {user.role === 'HEAD_TRAINER' && (
              <Detail icon={<ShieldCheck size={15} />} label="Khu phụ trách">
                {work.data?.zones ? (work.data.zones.length ? work.data.zones.join(', ') : 'Chưa được giao khu') : '…'}
              </Detail>
            )}
            <Detail icon={<ShieldCheck size={15} />} label="Phạm vi dữ liệu">
              <span className="font-normal text-gray-700">{SCOPE_TEXT[user.role]}</span>
            </Detail>
          </div>
          <p className="mt-3 text-xs text-gray-500">Cần đổi vai trò hoặc khu phụ trách? Liên hệ Quản lý câu lạc bộ.</p>
        </Card>

        {/* Bảo mật */}
        <Card className="lg:col-span-5">
          <SectionTitle icon={<KeyRound size={16} />}>Bảo mật</SectionTitle>
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
            <Button className="w-full" disabled={action.pending || !current || next.length < 8 || next !== confirm} onClick={submitPassword}>
              {action.pending ? 'Đang đổi…' : 'Đổi mật khẩu'}
            </Button>
            <ul className="space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
              <li>Đổi xong, mọi phiên đăng nhập của bạn bị đăng xuất.</li>
              <li>Phiên đăng nhập tự hết hạn sau 30 phút không thao tác.</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
