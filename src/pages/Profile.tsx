import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useStore } from '../store/store';
import { useService } from '../hooks/useService';
import { getPermissionMatrix } from '../services/system.service';
import { getDb } from '../services/db';
import { managedZoneIds } from '../services/selectors';
import { Avatar, Card, InfoRow, PageHeader, Pill, SectionTitle, Skeleton } from '../components/ui';
import { roleLabel, SCOPE_TEXT } from '../lib/profile-labels';

export default function Profile() {
  const user = useStore((state) => state.currentUser);
  const { data, loading } = useService(() => getPermissionMatrix(), []);

  if (!user) return null;

  const db = getDb();
  const zoneNames = managedZoneIds(db, user.id).map((id) => db.zones.find((zone) => zone.id === id)?.name ?? id);

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

  return (
    <div className="space-y-6">
      <PageHeader title="Hồ sơ cá nhân" description="Thông tin tài khoản và phạm vi quyền của bạn trong hệ thống." />

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
              <InfoRow label="Điện thoại" value={user.phone} />
              <InfoRow label="Trạng thái" value="Đang hoạt động" />
              {user.role === 'HEAD_TRAINER' && (
                <InfoRow label="Khu phụ trách" value={zoneNames.length ? zoneNames.join(', ') : 'Chưa được giao khu'} />
              )}
            </div>
          </Card>
          <Card variant="flat">
            <p className="text-sm font-medium text-gray-700">Phạm vi dữ liệu</p>
            <p className="mt-1 text-sm text-gray-500">{SCOPE_TEXT[user.role]}</p>
            <p className="mt-4 text-xs text-gray-500">
              Cần đổi vai trò hoặc khu phụ trách? Liên hệ quản lý câu lạc bộ — vai trò gán ở mục Nhân sự, khu gán ở danh
              mục khu chuồng.
            </p>
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
