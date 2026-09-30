// F1.3 — hồ sơ ngựa: header sáng đọc theo hàng + một dải cảnh báo khi bị chặn + các tab (khóa tab qua ?tab=).
import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, ChevronDown, Lock, Pencil, Trash2, Undo2, UserX } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { getHorse, setAvatar, type LifecycleAction } from '../../services/horse.service';
import { ActionMenu, Avatar, Button, Notice, NotFound, Skeleton, Tabs, cn, useToast } from '../../components/ui';
import { DeletedPill, EligibilityLine, HealthPill, LifecyclePill } from '../../components/ui/status';
import { distanceLabel, sexLabel } from '../../lib/labels';
import { formatDate } from '../../lib/format';
import { readImageFile } from '../../lib/files';
import { links } from '../../lib/links';
import OverviewTab from './tabs/OverviewTab';
import PedigreeTab from './tabs/PedigreeTab';
import BodyTab from './tabs/BodyTab';
import AuditTab from './tabs/AuditTab';
import MedicalTab from './tabs/MedicalTab';
import TrainingTab from './tabs/TrainingTab';
import LifecycleDialog from './components/LifecycleDialog';
import { lifecycleActionLabel, lifecycleActionsFor } from './components/lifecycle';

/** Một ô trong hàng thông tin chính. `waiting` = đang chờ xử lý (chữ hổ phách). */
function Fact({ label, value, waiting, mono }: { label: string; value?: ReactNode; waiting?: string; mono?: boolean }) {
  return (
    <div className="min-w-0 px-5 py-3.5">
      <p className="text-xs text-gray-500">{label}</p>
      <div
        className={cn(
          'mt-0.5 truncate text-sm font-medium',
          value ? 'text-gray-900' : waiting ? 'text-amber-700' : 'text-gray-400',
          mono && value && 'font-mono',
        )}
      >
        {value ?? waiting ?? '—'}
      </div>
    </div>
  );
}

export default function HorseDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: horse, loading, error, reload } = useService(() => getHorse(id), [id]);
  const [lifecycle, setLifecycle] = useState<LifecycleAction | null>(null);
  const avatarAction = useAction();
  const fileInput = useRef<HTMLInputElement>(null);

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
  const inClub = horse.placement !== 'NONE';
  const blocked = !horse.deleted && horse.lifecycleStatus === 'ACTIVE' && (!horse.train.allowed || !horse.race.allowed);

  const pickAvatar = async (file?: File) => {
    if (!file) return;
    try {
      const src = await readImageFile(file);
      const done = await avatarAction.run(() => setAvatar(horse.id, src));
      if (done) {
        toast.push('Đã thay ảnh đại diện', 'success');
        reload();
      }
    } catch (caught) {
      toast.push(caught instanceof Error ? caught.message : 'Không đọc được ảnh', 'error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const summary = [
    sexLabel[horse.sex],
    horse.age !== undefined ? `${horse.age} tuổi` : undefined,
    horse.distancePreference ? `Sở trường ${distanceLabel[horse.distancePreference].toLowerCase()}` : undefined,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <Link to={links.horses} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900">
        <ArrowLeft size={15} /> Danh sách ngựa
      </Link>

      {/* Header hồ sơ */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-200/80">
        <div className="flex flex-wrap items-start gap-5 p-5 sm:p-6">
          <div className="group relative shrink-0">
            <Avatar src={horse.avatar} name={horse.name} size={84} className="rounded-2xl" />
            {horse.canAvatar && !horse.readOnly && (
              <>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={avatarAction.pending}
                  className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Đổi ảnh đại diện"
                >
                  <Camera size={20} />
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => pickAvatar(event.target.files?.[0])}
                />
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-bold tracking-tight text-gray-900">{horse.name}</h2>
              {horse.deleted ? <DeletedPill /> : <LifecyclePill status={horse.lifecycleStatus} />}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
              {!horse.deleted && <HealthPill status={horse.healthStatus} className="text-sm" />}
              {horse.activeLock && (
                <span className="inline-flex items-center gap-1 font-medium text-red-700">
                  <Lock size={13} /> Khóa huấn luyện
                </span>
              )}
              {summary.length > 0 && <span className="text-gray-300">|</span>}
              <span>{summary.join(' · ')}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-xs text-gray-500">{horse.chipNumber ?? 'Chưa có số chip'}</span>
              {!blocked && !horse.deleted && (
                <EligibilityLine train={horse.train} race={horse.race} lifecycle={horse.lifecycleStatus} />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Button variant="secondary" onClick={() => navigate(links.horseEdit(horse.id))}>
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
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-semibold text-gray-800 ring-1 ring-gray-200 transition hover:bg-gray-50"
                  >
                    Vòng đời <ChevronDown size={15} />
                  </button>
                }
              />
            )}
          </div>
        </div>

        {/* Hàng thông tin chính */}
        <div className="grid grid-cols-2 divide-gray-100 border-t border-gray-100 sm:grid-cols-3 sm:divide-x lg:grid-cols-5">
          <Fact label="Chủ sở hữu" value={horse.owner?.name} waiting={inClub ? 'Chưa có chủ' : undefined} />
          <Fact
            label="Khu · Ô"
            value={horse.zone ? `${horse.zone.name}${horse.stall ? ` · ${horse.stall.code}` : ''}` : undefined}
            waiting={inClub ? 'Chờ xếp khu' : undefined}
          />
          <Fact
            label="Groom phụ trách"
            value={horse.groom?.name}
            waiting={horse.stall ? 'Chờ phân công Groom' : horse.zone ? 'Chờ xếp ô' : undefined}
          />
          <Fact label="Giống · màu lông" value={[horse.breed, horse.color].filter(Boolean).join(' · ') || undefined} />
          <Fact label="Ngày sinh" value={horse.birthDate ? formatDate(horse.birthDate) : undefined} />
        </div>
      </section>

      {/* Một dải cảnh báo duy nhất khi ngựa bị chặn — lý do nói một lần */}
      {blocked && (
        <EligibilityLine
          variant="banner"
          train={horse.train}
          race={horse.race}
          lifecycle={horse.lifecycleStatus}
          action={
            horse.openCase && horse.canViewMedical ? (
              <Link to={links.case(horse.openCase.id)} className="text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline">
                Xem bệnh án →
              </Link>
            ) : undefined
          }
        />
      )}

      {horse.deleted && (
        <Notice tone="danger">
          Hồ sơ đã bị xóa ngày {formatDate(horse.deletedAt)}
          {horse.deletedByName ? ` bởi ${horse.deletedByName}` : ''}. Lý do: {horse.deleteReason ?? '—'}. Hồ sơ chỉ đọc
          {horse.canDelete ? ' — dùng menu Vòng đời để khôi phục.' : '.'}
        </Notice>
      )}
      {!horse.deleted && horse.lifecycleStatus === 'TRANSFERRED' && (
        <Notice>
          Ngựa đã chuyển nhượng khỏi câu lạc bộ. Hồ sơ chỉ đọc, giữ tên chủ cũ{horse.owner ? ` (${horse.owner.name})` : ''}.
          {horse.canLifecycle ? ' Khi câu lạc bộ mua lại, dùng "Kích hoạt lại" trong menu Vòng đời.' : ''}
        </Notice>
      )}
      {horse.owner && !horse.owner.active && horse.canAssignOwner && (
        <Notice tone="warning">Tài khoản chủ sở hữu {horse.owner.name} đang bị khóa. Quyền sở hữu vẫn giữ nguyên.</Notice>
      )}

      <div className="sticky top-0 z-10 -mx-1 bg-canvas/95 px-1 backdrop-blur">
        <Tabs tabs={tabs} active={tab} onChange={(key) => setParams(key === 'overview' ? {} : { tab: key }, { replace: true })} />
      </div>

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
