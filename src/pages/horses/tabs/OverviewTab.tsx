// Tab Tổng quan của hồ sơ ngựa: thông tin hồ sơ, tình trạng hiện tại, chuồng trại – phụ trách, lịch sử Groom.
// Trình bày dạng danh sách nhãn – giá trị trên nền trắng; chỉ điều cần xử lý mới có màu.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { getPedigree, listOwnerships } from '../../../api/horses';
import { listGroomHistory } from '../../../api/stable';
import { getCareInstructions } from '../../../api/medical';
import type { HorseDetail, HorsePermissions } from '../../../api/types';
import { Button, Card, InfoGrid, SectionTitle, Skeleton, cn } from '../../../components/ui';
import { EligibilityView, HealthPill } from '../../../components/ui/status';
import { distanceHint, distanceLabel, sexLabel, lifecycleLabel } from '../../../lib/labels';
import { measurementSpec, placementStatusLabel } from '../../../lib/api-labels';
import { formatDate, formatDateTime } from '../../../lib/format';
import { links } from '../../../lib/links';
import { breedLabel, colorLabel } from '../../../lib/horse-options';
import { horseAgeText, isReadOnlyHorse } from '../../../lib/horse-rules';
import { useStore } from '../../../store/store';
import OwnerDialog from '../components/OwnerDialog';
import { AssignStallDialog, AssignZoneDialog, GroomDialog, RemoveStallDialog, type PlacementHorse } from '../../stable/components/PlacementDialogs';

/** Một dòng nhãn – giá trị – thao tác. `tone` chỉ dùng khi cần xử lý (hổ phách) hoặc nghiêm trọng (đỏ). */
function Row({
  label,
  children,
  actions,
  tone = 'default',
}: {
  label: string;
  children: ReactNode;
  actions?: ReactNode;
  tone?: 'default' | 'waiting' | 'danger' | 'muted';
}) {
  return (
    <div className="flex items-start gap-4 border-b border-gray-100 py-3 last:border-0 last:pb-0 first:pt-0">
      <span className="w-32 shrink-0 pt-px text-sm text-gray-500">{label}</span>
      <div
        className={cn(
          'min-w-0 flex-1 text-sm',
          tone === 'default' && 'font-medium text-gray-900',
          tone === 'waiting' && 'font-medium text-amber-700',
          tone === 'danger' && 'font-medium text-red-700',
          tone === 'muted' && 'text-gray-500',
        )}
      >
        {children}
      </div>
      {actions && <div className="-my-1 flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

/** "07/05/2024 · 2 tuổi". Ngựa đã mất: tuổi tính tới ngày mất. */
function birthText(dateOfBirth: string, dateOfDeath: string | null) {
  return `${formatDate(dateOfBirth)} · ${horseAgeText(dateOfBirth, dateOfDeath)?.toLowerCase()}`;
}

export default function OverviewTab({
  horse,
  permissions,
  onChanged,
  onTransferOwnership,
}: {
  horse: HorseDetail;
  permissions: HorsePermissions;
  onChanged: () => void;
  /** Mở hộp chuyển chủ trong câu lạc bộ (hộp thoại do trang hồ sơ giữ). */
  onTransferOwnership: () => void;
}) {
  const user = useStore((state) => state.currentUser);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [stallOpen, setStallOpen] = useState(false);
  const [groomOpen, setGroomOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);

  const isOwner = user?.role === 'HORSE_OWNER';
  const isHorseGroom = !!horse.groom && horse.groom.id === user?.id;
  const canReadCare = permissions.canViewMedicalTab || isHorseGroom;
  const pedigree = useService(() => getPedigree(horse.id), [horse.id, horse.version]);
  const care = useService(() => (canReadCare && !horse.isDeleted ? getCareInstructions(horse.id) : Promise.resolve(undefined)), [horse.id, canReadCare]);
  const grooms = useService(() => (isOwner ? Promise.resolve([]) : listGroomHistory(horse.id)), [horse.id, isOwner, horse.version]);
  const ownerships = useService(() => listOwnerships(horse.id), [horse.id, horse.version]);
  // Chỉ hiện lịch sử khi có hơn một giai đoạn hoặc có ghi chú chuyển nhượng; một giai đoạn từ đầu thì dòng chủ sở hữu đã đủ.
  const showOwnerships = (ownerships.data?.length ?? 0) > 1 || (ownerships.data ?? []).some((item) => item.reason);

  const { barn, stall, placementStatus } = horse.location;
  const placementHorse: PlacementHorse = {
    id: horse.id,
    name: horse.name,
    barnId: barn?.id,
    barnName: barn?.name,
    stallId: stall?.id,
    stallCode: stall?.code,
    groomId: horse.groom?.id,
    groomName: horse.groom?.fullName,
    placementStatus,
    healthStatus: horse.healthStatus,
  };

  const parent = (role: 'SIRE' | 'DAM') => {
    const node = pedigree.data?.ancestors.find((item) => item.generation === 1 && item.parentRole === role);
    if (!node) return horse[role === 'SIRE' ? 'sireId' : 'damId'] ? '…' : undefined;
    return node.canOpen ? (
      <Link className="text-emerald-700 hover:underline" to={links.horse(node.id)}>
        {node.name}
      </Link>
    ) : (
      node.name
    );
  };

  const info = [
    { label: 'Giới tính', value: horse.gender ? sexLabel[horse.gender] : undefined },
    { label: 'Giống', value: breedLabel(horse.breed) },
    { label: 'Màu lông', value: colorLabel(horse.color) },
    { label: 'Ngày sinh', value: horse.dateOfBirth ? birthText(horse.dateOfBirth, horse.dateOfDeath) : undefined },
    ...(horse.dateOfDeath ? [{ label: 'Ngày mất', value: formatDate(horse.dateOfDeath) }] : []),
    { label: 'Số chip', value: horse.microchipId ? <span className="font-mono">{horse.microchipId}</span> : undefined },
    {
      label: 'Sở trường cự ly',
      value: horse.raceAptitude ? `${distanceLabel[horse.raceAptitude]} (${distanceHint[horse.raceAptitude]})` : 'Chưa xác định',
    },
    { label: 'Cha', value: parent('SIRE') },
    { label: 'Mẹ', value: parent('DAM') },
  ];

  const inClub = placementStatus !== 'NOT_APPLICABLE' && !horse.isDeleted;
  const textButton = (label: ReactNode, onClick: () => void, primary = false) => (
    <Button size="sm" variant={primary ? 'secondary' : 'ghost'} onClick={onClick}>
      {label}
    </Button>
  );
  const careNote = care.data?.current;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-7 xl:col-span-8">
        <Card>
          <SectionTitle>Thông tin hồ sơ</SectionTitle>
          <InfoGrid items={info} className="xl:grid-cols-3" />
        </Card>

        <Card>
          <SectionTitle
            action={
              canReadCare &&
              !horse.isDeleted && (
                <Link to={links.horseMedical(horse.id)} className="text-sm font-medium text-emerald-700 hover:underline">
                  {permissions.canViewMedicalTab ? 'Hồ sơ y tế' : 'Lịch chăm sóc'} →
                </Link>
              )
            }
          >
            Tình trạng hiện tại
          </SectionTitle>
          <Row label="Sức khỏe">
            <HealthPill status={horse.healthStatus} className="text-sm" />
          </Row>
          <Row label="Tập và đua">
            <EligibilityView eligibility={horse.eligibility} lifecycle={horse.lifecycleStatus} />
          </Row>
          <Row label="Khóa huấn luyện" tone={horse.activeTrainingLock ? 'danger' : 'muted'}>
            {horse.activeTrainingLock ? (
              <>
                Đang có lệnh khóa của bác sĩ
                {permissions.canViewMedicalTab && (
                  <Link to={links.horseMedical(horse.id)} className="ml-2 text-xs font-normal text-gray-500 hover:text-gray-800 hover:underline">
                    Xem chi tiết
                  </Link>
                )}
              </>
            ) : (
              'Không có'
            )}
          </Row>
          {canReadCare && (
            <Row label="Bác sĩ dặn" tone={careNote ? 'default' : 'muted'}>
              {care.loading ? (
                <Skeleton rows={1} />
              ) : careNote ? (
                <>
                  <span className="flex items-start gap-2 whitespace-pre-line">
                    <Stethoscope size={14} className="mt-0.5 shrink-0 text-emerald-700" />
                    {careNote.careInstructions}
                  </span>
                  <span className="mt-1 block text-xs font-normal text-gray-500">Từ buổi khám ngày {formatDate(careNote.examDate)}</span>
                </>
              ) : (
                'Chưa có ghi chú chăm sóc từ buổi khám gần nhất'
              )}
            </Row>
          )}
          <Row label="Chỉ số mới nhất" tone={horse.latestMeasurements.length ? 'default' : 'muted'}>
            {horse.latestMeasurements.length ? (
              <span className="flex flex-wrap gap-x-5 gap-y-1">
                {horse.latestMeasurements.map((item) => (
                  <span key={item.type} className={cn(item.isAbnormal && 'text-amber-800')} title={`Đo lúc ${formatDateTime(item.measuredAt)}`}>
                    <span className="font-normal text-gray-500">{measurementSpec[item.type].name}</span>{' '}
                    <span className="tabular-nums">{Number(item.value).toLocaleString('vi-VN')}</span>
                    {measurementSpec[item.type].unit === '/9' ? '/9' : ` ${measurementSpec[item.type].unit}`}
                  </span>
                ))}
              </span>
            ) : (
              'Chưa ghi chỉ số nào'
            )}
          </Row>
          {horse.lifecycleReason && (
            <div className="pt-2">
              <h4 className="mb-2 text-sm font-semibold text-gray-900">Lịch sử vòng đời</h4>
              <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-sm">
                <p className="font-medium text-gray-900">
                  {horse.lifecycleChangedAt ? formatDate(horse.lifecycleChangedAt) : 'Chưa rõ ngày'}
                  <span className="font-normal text-gray-400"> · Chuyển sang trạng thái </span>
                  <span className={cn('font-semibold', horse.lifecycleStatus === 'ACTIVE' ? 'text-emerald-700' : 'text-gray-900')}>
                    {lifecycleLabel[horse.lifecycleStatus]}
                  </span>
                </p>
                <p className="mt-1.5 text-gray-600">
                  <span className="font-medium text-gray-700">{horse.lifecycleStatus === 'DECEASED' ? 'Nguyên nhân: ' : 'Lý do: '}</span>
                  {horse.lifecycleReason}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-5 lg:col-span-5 xl:col-span-4">
        <Card>
          <SectionTitle>Chuồng trại và phụ trách</SectionTitle>
          {!inClub ? (
            <p className="text-sm text-gray-500">
              {horse.isDeleted
                ? 'Hồ sơ đã xóa nên không có chỗ ở.'
                : horse.lifecycleStatus === 'DECEASED'
                  ? 'Ngựa đã mất nên không còn chỗ ở.'
                  : 'Ngựa không còn ở câu lạc bộ nên không có chỗ ở.'}
            </p>
          ) : (
            <>
              <Row
                label="Khu chuồng"
                tone={barn ? 'default' : 'waiting'}
                actions={permissions.canAssignBarn && textButton(barn ? 'Đổi khu' : 'Xếp khu', () => setZoneOpen(true), !barn)}
              >
                {barn ? barn.name : placementStatusLabel.PENDING_BARN}
              </Row>
              <Row
                label="Ô chuồng"
                tone={stall ? 'default' : barn ? 'waiting' : 'muted'}
                actions={
                  permissions.canAssignStallAndGroom && (
                    <>
                      {textButton(stall ? 'Chuyển ô' : 'Xếp ô', () => setStallOpen(true), !stall)}
                      {stall && textButton('Gỡ', () => setRemoveOpen(true))}
                    </>
                  )
                }
              >
                {stall ? <span className="font-mono">{stall.code}</span> : barn ? placementStatusLabel.PENDING_STALL : 'Chưa có khu'}
              </Row>
              <Row
                label="Groom"
                tone={horse.groom ? 'default' : barn ? 'waiting' : 'muted'}
                actions={permissions.canAssignStallAndGroom && barn && textButton(horse.groom ? 'Đổi' : 'Giao Groom', () => setGroomOpen(true), !horse.groom)}
              >
                {horse.groom ? horse.groom.fullName : barn ? 'Chưa có Groom' : 'Chưa có khu'}
              </Row>
            </>
          )}
          <Row
            label="Chủ sở hữu"
            tone={horse.owner ? 'default' : 'muted'}
            actions={permissions.canEditProfile && (horse.owner ? textButton('Chuyển chủ', onTransferOwnership) : textButton('Gán chủ', () => setOwnerOpen(true), true))}
          >
            {horse.owner ? (
              <>
                {horse.owner.fullName}
                {horse.ownerSince && !isReadOnlyHorse(horse) && (
                  <span className="block text-xs font-normal text-gray-500">Sở hữu từ {formatDate(horse.ownerSince)}</span>
                )}
                {horse.lifecycleStatus === 'TRANSFERRED' && <span className="block text-xs font-normal text-gray-500">Chủ tại thời điểm chuyển nhượng</span>}
                {horse.lifecycleStatus === 'DECEASED' && <span className="block text-xs font-normal text-gray-500">Chủ tại thời điểm ngựa mất</span>}
              </>
            ) : (
              'Chưa có chủ sở hữu'
            )}
          </Row>
          {inClub && !barn && !permissions.canAssignBarn && <p className="mt-3 text-xs text-gray-500">Ngựa chưa xếp khu thì chỉ Quản lý câu lạc bộ xử lý.</p>}
        </Card>

        {!isOwner && (grooms.data?.length ?? 0) > 0 && (
          <Card variant="flat">
            <SectionTitle>Lịch sử phân công Groom</SectionTitle>
            <ul className="space-y-2">
              {(grooms.data ?? []).map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={cn('truncate', item.endAt ? 'text-gray-500' : 'font-medium text-gray-900')}>{item.groom?.fullName ?? 'Groom'}</span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500">
                    {formatDate(item.startAt)} – {item.endAt ? formatDate(item.endAt) : 'nay'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {showOwnerships && (
          <Card variant="flat">
            <SectionTitle>{isOwner ? 'Thời gian bạn sở hữu' : 'Lịch sử chủ sở hữu'}</SectionTitle>
            <ul className="space-y-3">
              {(ownerships.data ?? []).map((item) => (
                <li key={item.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={cn('truncate', item.endedAt ? 'text-gray-500' : 'font-medium text-gray-900')}>{item.owner.fullName}</span>
                    <span className="shrink-0 text-xs tabular-nums text-gray-500">
                      {formatDate(item.startedAt)} – {item.endedAt ? formatDate(item.endedAt) : 'nay'}
                    </span>
                  </div>
                  {item.reason && <p className="mt-0.5 text-xs text-gray-500">{item.reason}</p>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <AssignZoneDialog horse={zoneOpen ? placementHorse : null} onClose={() => setZoneOpen(false)} onDone={onChanged} />
      <AssignStallDialog horse={stallOpen ? placementHorse : null} onClose={() => setStallOpen(false)} onDone={onChanged} onAssignGroom={() => setGroomOpen(true)} />
      <GroomDialog horse={groomOpen ? placementHorse : null} onClose={() => setGroomOpen(false)} onDone={onChanged} />
      <RemoveStallDialog horse={removeOpen ? placementHorse : null} onClose={() => setRemoveOpen(false)} onDone={onChanged} />
      <OwnerDialog
        open={ownerOpen}
        horse={{ id: horse.id, name: horse.name, version: horse.version }}
        onClose={() => setOwnerOpen(false)}
        onDone={onChanged}
      />
    </div>
  );
}
