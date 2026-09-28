// F1.3 — hồ sơ ngựa: dải header full width + các tab (khóa tab qua ?tab=).
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Pencil, Trash2, Undo2, UserX } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getHorse, type LifecycleAction } from '../../services/horse.service';
import { ActionMenu, Avatar, Button, Notice, NotFound, Skeleton, Tabs } from '../../components/ui';
import { DeletedPill, EligibilityBadge, HealthPill, LifecyclePill, LockPill } from '../../components/ui/status';
import { distanceLabel, sexLabel } from '../../lib/labels';
import { formatDate } from '../../lib/format';
import { links } from '../../lib/links';
import OverviewTab from './tabs/OverviewTab';
import PedigreeTab from './tabs/PedigreeTab';
import BodyTab from './tabs/BodyTab';
import AuditTab from './tabs/AuditTab';
import MedicalTab from './tabs/MedicalTab';
import TrainingTab from './tabs/TrainingTab';
import LifecycleDialog from './components/LifecycleDialog';
import { lifecycleActionLabel, lifecycleActionsFor } from './components/lifecycle';

function Fact({ label, value, warn }: { label: string; value?: string; warn?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-emerald-100/60">{label}</p>
      <div className={value ? 'truncate text-sm font-semibold text-white' : warn ? 'truncate text-sm font-semibold text-amber-300' : 'truncate text-sm font-semibold text-white/40'}>{value ?? warn ?? '—'}</div>
    </div>
  );
}

export default function HorseDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: horse, loading, error, reload } = useService(() => getHorse(id), [id]);
  const [lifecycle, setLifecycle] = useState<LifecycleAction | null>(null);

  if (loading && !horse) return <Skeleton rows={6} />;
  if (error || !horse) return <NotFound message={error === 'Không tìm thấy dữ liệu' ? undefined : error} />;

  const tabs = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'pedigree', label: 'Phả hệ' },
    { key: 'body', label: 'Chỉ số cơ thể' },
    ...(horse.canViewMedical ? [{ key: 'medical', label: 'Y tế' }] : []),
    ...(horse.canViewTraining ? [{ key: 'training', label: 'Huấn luyện' }] : []),
    ...(horse.canViewAudit ? [{ key: 'audit', label: 'Nhật ký' }] : []),
  ];
  const requested = params.get('tab') ?? 'overview';
  const tab = tabs.some((item) => item.key === requested) ? requested : 'overview';

  const actions = lifecycleActionsFor(horse.lifecycleStatus, horse.deleted).filter((item) =>
    item === 'DELETE' || item === 'RESTORE' ? horse.canDelete : horse.canLifecycle,
  );
  const canEdit = !horse.readOnly && (horse.canEditIdentity || horse.canEditPreference);

  return (
    <div className="space-y-6">
      <Link to={links.horses} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-emerald-700">
        <ArrowLeft size={15} /> Danh sách ngựa
      </Link>

      {/* Dải header */}
      <section className="relative overflow-hidden rounded-3xl bg-emerald-950 text-white shadow-grass-lift">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(52,211,153,0.28),transparent_55%)]" />
        <div className="relative grid gap-6 p-6 lg:grid-cols-12 lg:p-8">
          <div className="flex min-w-0 gap-5 lg:col-span-7">
            <Avatar src={horse.avatar} name={horse.name} size={112} className="rounded-2xl ring-4 ring-white/10" />
            <div className="min-w-0 space-y-2.5">
              <div>
                <h2 className="truncate text-3xl font-bold tracking-tight">{horse.name}</h2>
                <p className="font-mono text-sm text-emerald-200/70">{horse.chipNumber ?? 'chưa có số chip'}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {horse.deleted ? <DeletedPill /> : <HealthPill status={horse.healthStatus} />}
                <LifecyclePill status={horse.lifecycleStatus} />
                {horse.activeLock && <LockPill reason={horse.activeLock.reason} />}
              </div>
              <p className="text-sm text-emerald-100/80">
                {sexLabel[horse.sex]}
                {horse.breed ? ` · ${horse.breed}` : ''}
                {horse.age !== undefined ? ` · ${horse.age} tuổi` : ''}
                {horse.distancePreference ? ` · ${distanceLabel[horse.distancePreference]}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-5 lg:col-span-5">
            <div className="flex flex-wrap items-start justify-end gap-2">
              {canEdit && (
                <Button variant="soft" onClick={() => navigate(links.horseEdit(horse.id))}>
                  <Pencil size={15} /> {horse.canEditIdentity ? 'Sửa hồ sơ' : 'Sửa sở trường'}
                </Button>
              )}
              {actions.length > 0 && (
                <ActionMenu
                  items={actions.map((item) => ({
                    label: lifecycleActionLabel[item],
                    danger: item === 'DELETE' || item === 'TRANSFERRED',
                    icon: item === 'DELETE' ? <Trash2 size={14} /> : item === 'RESTORE' || item === 'ACTIVE' ? <Undo2 size={14} /> : <UserX size={14} />,
                    onSelect: () => setLifecycle(item),
                  }))}
                  trigger={
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
                    >
                      Vòng đời <ChevronDown size={15} />
                    </button>
                  }
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-2xl bg-white/[0.06] p-4 sm:grid-cols-4">
              <Fact label="Chủ sở hữu" value={horse.owner?.name} warn={horse.placement === 'NONE' ? undefined : 'Chưa có'} />
              <Fact label="Khu" value={horse.zone?.name} warn={horse.placement === 'NONE' ? undefined : 'Chờ xếp khu'} />
              <Fact label="Ô" value={horse.stall?.code} warn={horse.zone ? 'Chờ xếp ô' : undefined} />
              <Fact label="Groom" value={horse.groom?.name} warn={horse.stall ? 'Chờ phân công' : undefined} />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-2xl bg-white p-4 lg:col-span-12">
            <EligibilityBadge allowed={horse.train.allowed} reason={horse.train.reason} label={horse.train.allowed ? 'Được tập' : 'Không được tập'} />
            <EligibilityBadge allowed={horse.race.allowed} reason={horse.race.reason} label={horse.race.allowed ? 'Được đua' : 'Không được đua'} />
            {horse.train.allowed && !horse.race.allowed && horse.healthStatus === 'UNDER_OBSERVATION' && (
              <span className="self-center text-xs text-gray-400">Chỉ tập cường độ Nhẹ và Trung bình</span>
            )}
          </div>
        </div>
      </section>

      {horse.deleted && (
        <Notice tone="danger">
          Hồ sơ đã bị xóa ngày {formatDate(horse.deletedAt)}
          {horse.deletedByName ? ` bởi ${horse.deletedByName}` : ''}. Lý do: {horse.deleteReason ?? '—'}. Hồ sơ chỉ đọc
          {horse.canDelete ? ' — dùng menu Vòng đời để khôi phục.' : '.'}
        </Notice>
      )}
      {!horse.deleted && horse.lifecycleStatus === 'TRANSFERRED' && (
        <Notice tone="info">
          Ngựa đã chuyển nhượng khỏi câu lạc bộ. Hồ sơ chỉ đọc, giữ tên chủ cũ{horse.owner ? ` (${horse.owner.name})` : ''}.
          {horse.canLifecycle ? ' Khi câu lạc bộ mua lại, dùng "Kích hoạt lại" trong menu Vòng đời.' : ''}
        </Notice>
      )}
      {horse.owner && !horse.owner.active && horse.canAssignOwner && (
        <Notice tone="warning">Tài khoản chủ sở hữu {horse.owner.name} đang bị khóa. Quyền sở hữu vẫn giữ nguyên.</Notice>
      )}

      <Tabs tabs={tabs} active={tab} onChange={(key) => setParams(key === 'overview' ? {} : { tab: key }, { replace: true })} />

      <div>
        {tab === 'overview' && <OverviewTab horse={horse} onChanged={reload} />}
        {tab === 'pedigree' && <PedigreeTab horseId={horse.id} />}
        {tab === 'body' && <BodyTab horseId={horse.id} canRecord={horse.canRecordMetrics} canDelete={horse.canDeleteMetrics} />}
        {tab === 'medical' && <MedicalTab horseId={horse.id} />}
        {tab === 'training' && <TrainingTab horseId={horse.id} />}
        {tab === 'audit' && <AuditTab horseId={horse.id} />}
      </div>

      <LifecycleDialog horse={{ id: horse.id, name: horse.name }} action={lifecycle} onClose={() => setLifecycle(null)} onDone={reload} />
    </div>
  );
}
