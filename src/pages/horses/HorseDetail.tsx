// F1.3 — hồ sơ ngựa: header sáng đọc theo hàng + một dải cảnh báo khi bị chặn + các tab (khóa tab qua ?tab=).
// Hồ sơ và cờ quyền tải song song từ backend; nút nào hiện là do cờ quyền quyết định.
import { useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, ChevronDown, HeartPulse, Lock, MapPinned, Pencil, Trash2, Undo2, UserX } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getHorse, getPermissions, getPhotoUrl, updateHorse } from '../../api/horses';
import { uploadHorsePhoto } from '../../api/media';
import { ActionMenu, Avatar, Button, Notice, NotFound, Skeleton, Tabs, cn, useToast } from '../../components/ui';
import { DeletedPill, EligibilityView, HealthPill, LifecyclePill } from '../../components/ui/status';
import { distanceLabel, sexLabel } from '../../lib/labels';
import { placementStatusLabel } from '../../lib/api-labels';
import { formatDate } from '../../lib/format';
import { IMAGE_ACCEPT, validateImageFile } from '../../lib/files';
import { links } from '../../lib/links';
import { breedLabel, colorLabel } from '../../lib/horse-options';
import { useStore } from '../../store/store';
import { useCrumbs } from '../../components/Breadcrumb';
import OverviewTab from './tabs/OverviewTab';
import PedigreeTab from './tabs/PedigreeTab';
import BodyTab from './tabs/BodyTab';
import LifecycleDialog from './components/LifecycleDialog';
import { lifecycleActionLabel, lifecycleActionsFor, type LifecycleAction } from './components/lifecycle';
import { AssignZoneDialog } from '../stable/components/PlacementDialogs';

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

function ageOf(dateOfBirth: string | null) {
  if (!dateOfBirth) return undefined;
  const born = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) age -= 1;
  return Math.max(0, age);
}

export default function HorseDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useStore((state) => state.currentUser);
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useService(async () => {
    const [horse, permissions] = await Promise.all([getHorse(id), getPermissions(id)]);
    const photo = horse.mediaId ? await getPhotoUrl(id).then((result) => result.url).catch(() => undefined) : undefined;
    return { horse, permissions, photo };
  }, [id]);
  const [lifecycle, setLifecycle] = useState<LifecycleAction | null>(null);
  const [barnOpen, setBarnOpen] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useCrumbs(data ? [{ label: data.horse.name }] : null);

  if (loading && !data) return <Skeleton rows={6} />;
  if (error || !data) return <NotFound message={error && !error.startsWith('Không tìm thấy') ? error : undefined} />;
  const { horse, permissions, photo } = data;

  const isHorseGroom = !!horse.groom && horse.groom.id === user?.id;
  const tabs = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'pedigree', label: 'Phả hệ' },
    { key: 'body', label: 'Chỉ số cơ thể' },
  ];
  const requested = params.get('tab') ?? 'overview';
  // Y tế đã thành màn riêng (Flow 3): link cũ ?tab=medical chuyển sang đó.
  const canOpenMedical = permissions.canViewMedicalTab || isHorseGroom;
  if (requested === 'medical' && canOpenMedical) return <Navigate to={links.horseMedical(horse.id)} replace />;
  const tab = tabs.some((item) => item.key === requested) ? requested : 'overview';

  const actions = lifecycleActionsFor(horse.lifecycleStatus, horse.isDeleted).filter((item) =>
    item === 'DELETE' ? permissions.canDelete : item === 'RESTORE' ? permissions.canRestore : permissions.canChangeLifecycle,
  );
  const canEdit = permissions.canEditProfile || permissions.canEditRaceAptitude;
  const { barn, stall, placementStatus } = horse.location;
  const inClub = placementStatus !== 'NOT_APPLICABLE' && !horse.isDeleted;
  const blocked = !horse.isDeleted && horse.lifecycleStatus === 'ACTIVE' && (!horse.eligibility.trainingEligible || !horse.eligibility.racingEligible);

  const pickAvatar = async (file?: File) => {
    if (!file) return;
    setAvatarPending(true);
    try {
      await validateImageFile(file);
      const mediaId = await uploadHorsePhoto(file);
      await updateHorse(horse.id, { version: horse.version, mediaId });
      toast.push('Đã thay ảnh đại diện', 'success');
      reload();
    } catch (caught) {
      toast.push(caught instanceof Error ? caught.message : 'Không đọc được ảnh', 'error');
    } finally {
      setAvatarPending(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const age = ageOf(horse.dateOfBirth);
  const summary = [
    horse.gender ? sexLabel[horse.gender] : undefined,
    age !== undefined ? `${age} tuổi` : undefined,
    horse.raceAptitude ? `Sở trường ${distanceLabel[horse.raceAptitude].toLowerCase()}` : undefined,
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
            <Avatar src={photo} name={horse.name} size={84} className="rounded-2xl" />
            {permissions.canEditProfile && (
              <>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={avatarPending}
                  className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Đổi ảnh đại diện"
                >
                  <Camera size={20} />
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="hidden"
                  onChange={(event) => pickAvatar(event.target.files?.[0])}
                />
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-bold tracking-tight text-gray-900">{horse.name}</h2>
              {horse.isDeleted ? <DeletedPill /> : <LifecyclePill status={horse.lifecycleStatus} />}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
              {!horse.isDeleted && <HealthPill status={horse.healthStatus} className="text-sm" />}
              {horse.activeTrainingLock && (
                <span className="inline-flex items-center gap-1 font-medium text-red-700">
                  <Lock size={13} /> Khóa huấn luyện
                </span>
              )}
              {summary.length > 0 && <span className="text-gray-300">|</span>}
              <span>{summary.join(' · ')}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-xs text-gray-500">{horse.microchipId ?? 'Chưa có số chip'}</span>
              {!blocked && !horse.isDeleted && <EligibilityView eligibility={horse.eligibility} lifecycle={horse.lifecycleStatus} />}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canOpenMedical && !horse.isDeleted && (
              <Button variant="secondary" onClick={() => navigate(links.horseMedical(horse.id))}>
                <HeartPulse size={15} /> {permissions.canViewMedicalTab ? 'Hồ sơ y tế' : 'Chăm sóc'}
              </Button>
            )}
            {canEdit && (
              <Button variant="secondary" onClick={() => navigate(links.horseEdit(horse.id))}>
                <Pencil size={15} /> {permissions.canEditProfile ? 'Sửa hồ sơ' : 'Sửa sở trường'}
              </Button>
            )}
            {permissions.canAssignBarn && inClub && (
              <Button variant={barn ? 'secondary' : 'primary'} onClick={() => setBarnOpen(true)}>
                <MapPinned size={15} /> {barn ? 'Đổi khu' : 'Xếp khu'}
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
          <Fact label="Chủ sở hữu" value={horse.owner?.fullName} waiting={inClub ? 'Chưa có chủ' : undefined} />
          <Fact
            label="Khu · Ô"
            value={barn ? `${barn.name}${stall ? ` · ${stall.code}` : ''}` : undefined}
            waiting={inClub ? placementStatusLabel.PENDING_BARN : undefined}
          />
          <Fact
            label="Groom phụ trách"
            value={horse.groom?.fullName}
            waiting={inClub ? (placementStatus === 'PENDING_STALL' ? placementStatusLabel.PENDING_STALL : barn ? 'Chưa có Groom' : undefined) : undefined}
          />
          <Fact label="Giống · màu lông" value={[breedLabel(horse.breed), colorLabel(horse.color)].filter(Boolean).join(' · ') || undefined} />
          <Fact label="Ngày sinh" value={horse.dateOfBirth ? formatDate(horse.dateOfBirth) : undefined} />
        </div>
      </section>

      {/* Một dải cảnh báo duy nhất khi ngựa bị chặn — lý do nói một lần */}
      {blocked && (
        <EligibilityView
          variant="banner"
          eligibility={horse.eligibility}
          lifecycle={horse.lifecycleStatus}
          action={
            permissions.canViewMedicalTab ? (
              <Link to={links.horseMedical(horse.id)} className="text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline">
                Xem hồ sơ y tế →
              </Link>
            ) : undefined
          }
        />
      )}

      {horse.isDeleted && (
        <Notice tone="danger">
          Hồ sơ đã bị xóa và chỉ còn Quản lý câu lạc bộ xem được. Hồ sơ chỉ đọc{permissions.canRestore ? ' — dùng menu Vòng đời để khôi phục.' : '.'}
        </Notice>
      )}
      {!horse.isDeleted && horse.lifecycleStatus === 'TRANSFERRED' && (
        <Notice>
          Ngựa đã chuyển nhượng khỏi câu lạc bộ{horse.lifecycleChangedAt ? ` ngày ${formatDate(horse.lifecycleChangedAt)}` : ''}. Hồ sơ chỉ đọc, giữ tên chủ cũ
          {horse.owner ? ` (${horse.owner.fullName})` : ''}.{permissions.canChangeLifecycle ? ' Khi câu lạc bộ mua lại, dùng "Kích hoạt lại" trong menu Vòng đời.' : ''}
        </Notice>
      )}

      <div className="sticky top-0 z-10 -mx-1 bg-canvas/95 px-1 backdrop-blur">
        <Tabs tabs={tabs} active={tab} onChange={(key) => setParams(key === 'overview' ? {} : { tab: key }, { replace: true })} />
      </div>

      <div>
        {tab === 'overview' && <OverviewTab horse={horse} permissions={permissions} onChanged={reload} />}
        {tab === 'pedigree' && <PedigreeTab horseId={horse.id} />}
        {tab === 'body' && <BodyTab horseId={horse.id} canRecord={permissions.canRecordMeasurement} canDelete={permissions.canDeleteMeasurement} />}
      </div>

      <LifecycleDialog horse={{ id: horse.id, name: horse.name }} action={lifecycle} onClose={() => setLifecycle(null)} onDone={reload} />
      <AssignZoneDialog
        horse={
          barnOpen
            ? { id: horse.id, name: horse.name, barnId: barn?.id, barnName: barn?.name, stallId: stall?.id, stallCode: stall?.code, placementStatus }
            : null
        }
        onClose={() => setBarnOpen(false)}
        onDone={reload}
      />
    </div>
  );
}

