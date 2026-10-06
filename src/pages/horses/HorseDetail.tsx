/// F1.3 — hồ sơ ngựa: hero ảnh lớn (bấm xem ảnh lớn, CM đổi / kéo thả ảnh) + tên, tình trạng, các ô thông tin chính,
// một dải cảnh báo khi bị chặn, rồi các tab (khóa tab qua ?tab=).
// Hồ sơ và cờ quyền tải song song; ảnh tải riêng để không chặn trang. Nút nào hiện là do cờ quyền quyết định.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, HeartOff, HeartPulse, Lock, MapPinned, Pencil, Trash2, Undo2, UserX } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getHorse, getPermissions, getPhotoUrl, updateHorse } from '../../api/horses';
import { uploadHorsePhoto } from '../../api/media';
import { ActionMenu, Button, Notice, NotFound, Reveal, Tabs, cn, useToast } from '../../components/ui';
import { DeletedPill, EligibilityView, HealthPill, LifecyclePill } from '../../components/ui/status';
import { HorseDetailSkeleton } from '../../components/skeletons';
import { distanceLabel, sexLabel } from '../../lib/labels';
import { placementStatusLabel } from '../../lib/api-labels';
import { formatDate } from '../../lib/format';
import { validateImageFile } from '../../lib/files';
import { links } from '../../lib/links';
import { breedLabel, colorLabel } from '../../lib/horse-options';
import { useStore } from '../../store/store';
import { useCrumbs } from '../../components/Breadcrumb';
import OverviewTab from './tabs/OverviewTab';
import PedigreeTab from './tabs/PedigreeTab';
import BodyTab from './tabs/BodyTab';
import LifecycleDialog from './components/LifecycleDialog';
import { HorseMedia } from './components/HorseMedia';
import { destructiveActions, lifecycleActionLabel, lifecycleActionsFor, type LifecycleAction } from './components/lifecycle';
import { horseAgeText } from '../../lib/horse-rules';
import { AssignZoneDialog } from '../stable/components/PlacementDialogs';

/** Một ô thông tin trong lưới bento của hero. `waiting` = đang chờ xử lý (chữ và viền hổ phách). */
function Fact({ label, value, waiting, mono, to, className = '' }: { label: string; value?: ReactNode; waiting?: string; mono?: boolean; to?: string; className?: string }) {
  const body = (
    <>
      <p className="text-xs text-gray-500">{label}</p>
      <div
        className={cn(
          'mt-1 truncate text-[15px] font-semibold',
          value ? 'text-gray-900' : waiting ? 'text-amber-800' : 'text-gray-400',
          mono && value && 'font-mono text-sm',
        )}
      >
        {value ?? waiting ?? '—'}
      </div>
    </>
  );
  const tile = cn(
    'min-w-0 rounded-xl px-3.5 py-3 transition',
    waiting && !value ? 'bg-amber-50/70 ring-1 ring-amber-200/70' : 'bg-gray-50/90 ring-1 ring-gray-100',
    to && 'hover:bg-emerald-50/60 hover:ring-emerald-200',
    className,
  );
  return to ? (
    <Link to={to} className={tile}>
      {body}
    </Link>
  ) : (
    <div className={tile}>{body}</div>
  );
}

export default function HorseDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useStore((state) => state.currentUser);
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useService(async () => {
    const [horse, permissions] = await Promise.all([getHorse(id), getPermissions(id)]);
    return { horse, permissions };
  }, [id]);
  // Ảnh tải riêng: hồ sơ hiện ngay, khung ảnh shimmer trong lúc lấy link.
  const mediaId = data?.horse.mediaId;
  const photo = useService(() => (mediaId ? getPhotoUrl(id).then((result) => result.url) : Promise.resolve(undefined)), [id, mediaId], { silent: true });
  const [lifecycle, setLifecycle] = useState<LifecycleAction | null>(null);
  const [barnOpen, setBarnOpen] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);
  // Ảnh vừa chọn hiện ngay trong lúc tải lên.
  const [preview, setPreview] = useState<string>();
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  useCrumbs(data ? [{ label: data.horse.name }] : null);

  if (loading && !data) return <HorseDetailSkeleton />;
  if (error || !data) return <NotFound message={error && !error.startsWith('Không tìm thấy') ? error : undefined} />;
  const { horse, permissions } = data;

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

  const pickAvatar = async (file: File) => {
    setAvatarPending(true);
    try {
      await validateImageFile(file);
      setPreview(URL.createObjectURL(file));
      const uploaded = await uploadHorsePhoto(file);
      await updateHorse(horse.id, { version: horse.version, mediaId: uploaded });
      toast.push('Đã thay ảnh đại diện', 'success');
      reload();
    } catch (caught) {
      setPreview(undefined);
      toast.push(caught instanceof Error ? caught.message : 'Không đọc được ảnh', 'error');
    } finally {
      setAvatarPending(false);
    }
  };

  const summary = [
    horse.gender ? sexLabel[horse.gender] : undefined,
    horseAgeText(horse.dateOfBirth, horse.dateOfDeath)?.toLowerCase(),
    horse.raceAptitude ? `Sở trường ${distanceLabel[horse.raceAptitude].toLowerCase()}` : undefined,
  ].filter(Boolean);
  const photoSrc = preview ?? photo.data;

  return (
    <Reveal className="space-y-5">
      <Link to={links.horses} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900">
        <ArrowLeft size={15} /> Danh sách ngựa
      </Link>

      {/* Hero hồ sơ: ảnh lớn bên trái, thông tin bên phải */}
      <section data-reveal className="grid gap-5 rounded-3xl bg-white p-3 shadow-[0_28px_60px_-40px_rgba(6,78,59,0.5)] ring-1 ring-gray-200/80 sm:p-4 lg:grid-cols-12">
        <HorseMedia
          src={photoSrc}
          name={horse.name}
          loading={!!mediaId && photo.loading && !photo.data}
          canEdit={permissions.canEditProfile && !horse.isDeleted}
          pending={avatarPending}
          onPick={pickAvatar}
          onExpired={() => photo.reload()}
          className="aspect-[4/3] lg:col-span-5 lg:aspect-auto lg:min-h-[22rem]"
        />

        <div className="flex min-w-0 flex-col gap-4 p-1 sm:p-2 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-4xl font-bold leading-[1.05] tracking-tight text-gray-900 sm:text-5xl">{horse.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-gray-600">
                {summary.length > 0 && <span>{summary.join(' · ')}</span>}
                {!blocked && !horse.isDeleted && <EligibilityView eligibility={horse.eligibility} lifecycle={horse.lifecycleStatus} />}
              </div>
              <p className="mt-1.5 font-mono text-xs text-gray-500">{horse.microchipId ? `Chip ${horse.microchipId}` : 'Chưa có số chip'}</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-1 lg:justify-end">
              {horse.isDeleted ? <DeletedPill /> : <LifecyclePill status={horse.lifecycleStatus} />}
              {!horse.isDeleted && <HealthPill status={horse.healthStatus} className="text-sm" />}
              {horse.activeTrainingLock && (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-sm font-medium text-red-700 ring-1 ring-red-100">
                  <Lock size={13} /> Khóa huấn luyện
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <Fact
              label="Khu · Ô"
              className="col-span-2 sm:col-span-3"
              value={barn ? `${barn.name} · ${stall ? stall.code : 'chờ xếp ô'}` : undefined}
              waiting={inClub ? (barn ? placementStatusLabel.PENDING_STALL : placementStatusLabel.PENDING_BARN) : undefined}
              to={barn?.id && user?.role !== 'HORSE_OWNER' ? `${links.stable}?zone=${barn.id}` : undefined}
            />
            <Fact label="Chủ sở hữu" className="col-span-2 sm:col-span-3" value={horse.owner?.fullName} waiting={inClub ? 'Chưa có chủ' : undefined} />
            <Fact label="Groom phụ trách" className="sm:col-span-2" value={horse.groom?.fullName} waiting={inClub && barn ? 'Chưa có Groom' : undefined} />
            <Fact label="Giống · màu lông" className="sm:col-span-2" value={[breedLabel(horse.breed), colorLabel(horse.color)].filter(Boolean).join(' · ') || undefined} />
            {horse.dateOfDeath ? (
              <Fact
                label="Ngày sinh · ngày mất"
                className="col-span-2 sm:col-span-2"
                value={`${horse.dateOfBirth ? formatDate(horse.dateOfBirth) : 'Chưa rõ'} · ${formatDate(horse.dateOfDeath)}`}
              />
            ) : (
              <Fact label="Ngày sinh" className="col-span-2 sm:col-span-2" value={horse.dateOfBirth ? formatDate(horse.dateOfBirth) : undefined} />
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            {canOpenMedical && !horse.isDeleted && (
              <Button onClick={() => navigate(links.horseMedical(horse.id))}>
                <HeartPulse size={15} /> {permissions.canViewMedicalTab ? 'Hồ sơ y tế' : 'Chăm sóc'}
              </Button>
            )}
            {canEdit && (
              <Button variant="secondary" onClick={() => navigate(links.horseEdit(horse.id))}>
                <Pencil size={15} /> {permissions.canEditProfile ? 'Sửa hồ sơ' : 'Sửa sở trường'}
              </Button>
            )}
            {permissions.canAssignBarn && inClub && (
              <Button variant="secondary" onClick={() => setBarnOpen(true)}>
                <MapPinned size={15} /> {barn ? 'Đổi khu' : 'Xếp khu'}
              </Button>
            )}
            {actions.length > 0 && (
              <ActionMenu
                items={actions.map((item) => ({
                  label: lifecycleActionLabel[item],
                  danger: destructiveActions.has(item),
                  icon:
                    item === 'DELETE' ? (
                      <Trash2 size={14} />
                    ) : item === 'DECEASED' ? (
                      <HeartOff size={14} />
                    ) : item === 'RESTORE' || item === 'ACTIVE' ? (
                      <Undo2 size={14} />
                    ) : (
                      <UserX size={14} />
                    ),
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
          Hồ sơ đã bị xóa và chỉ còn Quản lý câu lạc bộ xem được. Hồ sơ chỉ đọc.{permissions.canRestore ? ' Dùng menu Vòng đời để khôi phục.' : ''}
        </Notice>
      )}
      {!horse.isDeleted && horse.lifecycleStatus === 'TRANSFERRED' && (
        <Notice>
          Ngựa đã chuyển nhượng khỏi câu lạc bộ{horse.lifecycleChangedAt ? ` ngày ${formatDate(horse.lifecycleChangedAt)}` : ''}.
        </Notice>
      )}
      {!horse.isDeleted && horse.lifecycleStatus === 'DECEASED' && (
        <Notice icon={<HeartOff size={16} />}>
          <span className="font-semibold">Ngựa đã mất{horse.dateOfDeath ? ` ngày ${formatDate(horse.dateOfDeath)}` : ''}.</span> Hồ sơ chỉ được xem.
          {horse.lifecycleReason && <span className="mt-1 block">Nguyên nhân: {horse.lifecycleReason}</span>}
        </Notice>
      )}

      <div data-reveal className="sticky top-0 z-10 -mx-1 bg-canvas/95 px-1 backdrop-blur">
        <Tabs tabs={tabs} active={tab} onChange={(key) => setParams(key === 'overview' ? {} : { tab: key }, { replace: true })} />
      </div>

      <div data-reveal>
        {tab === 'overview' && <OverviewTab horse={horse} permissions={permissions} onChanged={reload} />}
        {tab === 'pedigree' && <PedigreeTab horseId={horse.id} />}
        {tab === 'body' && <BodyTab horseId={horse.id} canRecord={permissions.canRecordMeasurement} canDelete={permissions.canDeleteMeasurement} />}
      </div>

      <LifecycleDialog
        horse={{ id: horse.id, name: horse.name, dateOfBirth: horse.dateOfBirth }}
        action={lifecycle}
        onClose={() => setLifecycle(null)}
        onDone={reload}
      />
      <AssignZoneDialog
        horse={
          barnOpen
            ? { id: horse.id, name: horse.name, barnId: barn?.id, barnName: barn?.name, stallId: stall?.id, stallCode: stall?.code, placementStatus }
            : null
        }
        onClose={() => setBarnOpen(false)}
        onDone={reload}
      />
    </Reveal>
  );
}

