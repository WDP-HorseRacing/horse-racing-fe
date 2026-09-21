import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useStore } from '../store/store';
import { useService } from '../hooks/useService';
import { getPermissionMatrix } from '../services/system.service';
import { Avatar, Card, InfoRow, PageHeader, Pill, SectionTitle, Skeleton } from '../components/ui';
import { roleLabel, SCOPE_TEXT } from '../lib/profile-labels';

export default function Profile() {
  const user = useStore((state) => state.currentUser);
  const { data, loading } = useService(() => getPermissionMatrix(), []);

  if (!user) return null;

  const myCapabilities = (data?.groups ?? []).flatMap((group) =>
    group.rows
      .map((row) => {
        const cell = row.cells.find((item) => item.role === user.role);
        return cell?.allowed ? { group: group.group, feature: row.feature, scope: cell.scopeLabel } : null;
      })
      .filter(Boolean),
  ) as { group: string; feature: string; scope?: string }[];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <PageHeader title="Hồ sơ cá nhân" description="Thông tin tài khoản và phạm vi quyền của bạn trong hệ thống." />

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user.name} size={64} />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-400">{roleLabel[user.role]}</p>
          </div>
          <Pill tone="green">Đang hoạt động</Pill>
        </div>
        <div className="mt-6 border-t border-gray-100 pt-4">
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Điện thoại" value={user.phone} />
          <InfoRow label="Phạm vi dữ liệu" value={SCOPE_TEXT[user.role]} />
          {user.zoneId && (
            <InfoRow label="Khu phụ trách" value={user.zoneId === 'zone_a' ? 'Khu A' : 'Khu B'} />
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<ShieldCheck size={16} className="text-emerald-600" />}>
          Những việc bạn được làm
        </SectionTitle>
        {loading && <Skeleton rows={4} />}
        <div className="space-y-1">
          {myCapabilities.map((item) => (
            <div key={item.feature} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 py-2 last:border-0">
              <div>
                <p className="text-sm text-gray-700">{item.feature}</p>
                <p className="text-[11px] text-gray-300">{item.group}</p>
              </div>
              {item.scope && <Pill tone="gray">{item.scope}</Pill>}
            </div>
          ))}
        </div>
        {user.role === 'CLUB_MANAGER' && (
          <Link to="/admin/permissions" className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:underline">
            Xem ma trận phân quyền đầy đủ
          </Link>
        )}
      </Card>

      <Card tone="muted">
        <p className="text-sm text-gray-500">
          Cần đổi vai trò hoặc khu phụ trách? Liên hệ quản lý câu lạc bộ — việc gán vai trò thực hiện ở mục Nhân sự.
        </p>
      </Card>
    </div>
  );
}
