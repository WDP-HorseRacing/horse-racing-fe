// Tab Tổng quan của hồ sơ ngựa: thông tin định danh, xếp chỗ khu/ô/Groom, chủ sở hữu, ảnh và tóm tắt y tế – lớp.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, Building2, GraduationCap, HeartPulse, Lock, UserRound, Users, Warehouse } from 'lucide-react';
import { useAction } from '../../../hooks/useService';
import { setAvatar, unassignGroom, unassignStall, type HorseDetail } from '../../../services/horse.service';
import { Button, Card, InfoGrid, Notice, SectionTitle, cn, useToast } from '../../../components/ui';
import { PlacementPill } from '../../../components/ui/status';
import { distanceHint, distanceLabel, sexLabel } from '../../../lib/labels';
import { formatDate } from '../../../lib/format';
import { links } from '../../../lib/links';
import AvatarPicker from '../components/AvatarPicker';
import OwnerDialog from '../components/OwnerDialog';
import {
  AssignStallDialog,
  AssignZoneDialog,
  GroomDialog,
  ReasonDialog,
  type PlacementHorse,
} from '../../stable/components/PlacementDialogs';

function Slot({
  icon,
  label,
  value,
  empty,
  actions,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value?: ReactNode;
  empty: string;
  actions?: ReactNode;
  tone?: 'default' | 'waiting';
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-3.5 py-3',
        tone === 'waiting' ? 'bg-amber-50/80 ring-1 ring-amber-200/60' : 'bg-emerald-50/40',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone === 'waiting' ? 'bg-amber-100 text-amber-700' : 'bg-white text-emerald-700')}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400">{label}</p>
        <div className={cn('truncate text-sm font-semibold', value ? 'text-gray-900' : 'text-amber-700')}>{value ?? empty}</div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap justify-end gap-1">{actions}</div>}
    </div>
  );
}

export default function OverviewTab({ horse, onChanged }: { horse: HorseDetail; onChanged: () => void }) {
  const toast = useToast();
  const action = useAction();
  const avatarAction = useAction();
  const [zoneOpen, setZoneOpen] = useState(false);
  const [stallOpen, setStallOpen] = useState(false);
  const [groomOpen, setGroomOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [unassign, setUnassign] = useState<'stall' | 'groom' | null>(null);

  const placementHorse: PlacementHorse = {
    id: horse.id,
    name: horse.name,
    zoneId: horse.zone?.id,
    zoneName: horse.zone?.name,
    stallCode: horse.stall?.code,
    groomId: horse.groom?.id,
    groomName: horse.groom?.name,
    quarantined: horse.healthStatus === 'QUARANTINED',
  };

  const changeAvatar = async (value: string | undefined) => {
    const done = await avatarAction.run(() => setAvatar(horse.id, value ?? null));
    if (done) {
      toast.push(value ? 'Đã thay ảnh đại diện' : 'Đã gỡ ảnh đại diện', 'success');
      onChanged();
    }
  };

  const info = [
    { label: 'Giới tính', value: sexLabel[horse.sex] },
    { label: 'Giống', value: horse.breed },
    { label: 'Màu lông', value: horse.color },
    { label: 'Ngày sinh', value: horse.birthDate ? `${formatDate(horse.birthDate)}${horse.age !== undefined ? ` · ${horse.age} tuổi` : ''}` : undefined },
    { label: 'Số chip', value: horse.chipNumber ? <span className="font-mono">{horse.chipNumber}</span> : undefined },
    {
      label: 'Sở trường cự ly',
      value: horse.distancePreference ? `${distanceLabel[horse.distancePreference]} (${distanceHint[horse.distancePreference]})` : 'Chưa xác định',
    },
    {
      label: 'Cha',
      value: horse.sire ? (horse.sire.id ? <Link className="text-emerald-700 hover:underline" to={links.horse(horse.sire.id)}>{horse.sire.name}</Link> : horse.sire.name) : undefined,
    },
    {
      label: 'Mẹ',
      value: horse.dam ? (horse.dam.id ? <Link className="text-emerald-700 hover:underline" to={links.horse(horse.dam.id)}>{horse.dam.name}</Link> : horse.dam.name) : undefined,
    },
    { label: 'Ngày tạo hồ sơ', value: formatDate(horse.createdAt) },
  ];

  const waitingStall = horse.placement === 'WAITING_STALL';
  const waitingGroom = horse.placement === 'WAITING_GROOM';

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-7 xl:col-span-8">
        <Card>
          <SectionTitle>Thông tin hồ sơ</SectionTitle>
          <InfoGrid items={info} />
        </Card>

        <div className="grid gap-4 md:grid-cols-5">
          <Card variant="flat" className="md:col-span-2">
            <div className="flex items-start gap-3">
              <GraduationCap size={18} className="mt-0.5 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{horse.activeClassCount}</p>
                <p className="text-sm text-gray-500">lớp đang học</p>
                {horse.canViewTraining && (
                  <Link to={links.horse(horse.id, 'training')} className="mt-1 inline-block text-xs font-semibold text-emerald-700 hover:underline">
                    Xem lịch tập và kết quả
                  </Link>
                )}
              </div>
            </div>
          </Card>
          <Card variant="flat" tone={horse.openCase || horse.activeLock ? 'warning' : 'default'} className="md:col-span-3">
            <div className="flex items-start gap-3">
              <HeartPulse size={18} className="mt-0.5 text-amber-600" />
              <div className="min-w-0 space-y-1.5 text-sm">
                {horse.canViewMedical ? (
                  <>
                    <p className="font-semibold text-gray-900">
                      {horse.openCase ? (
                        <Link to={links.case(horse.openCase.id)} className="hover:underline">
                          Bệnh án đang mở: {horse.openCase.title}
                        </Link>
                      ) : (
                        'Không có bệnh án đang mở'
                      )}
                    </p>
                    {horse.activeLock ? (
                      <p className="flex items-start gap-1.5 text-red-700">
                        <Lock size={13} className="mt-0.5 shrink-0" />
                        Khóa huấn luyện từ {formatDate(horse.activeLock.placedAt)}: {horse.activeLock.reason}
                        {horse.activeLock.expectedLiftDate ? ` · dự kiến gỡ ${formatDate(horse.activeLock.expectedLiftDate)}` : ''}
                      </p>
                    ) : (
                      <p className="text-gray-500">Không có khóa huấn luyện</p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500">Thông tin y tế chi tiết dành cho bác sĩ, huấn luyện viên và quản lý.</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {horse.quarantineHint && (
          <Notice tone="warning">
            Ngựa đang cách ly. Gợi ý cho HT của khu: cân nhắc chuyển ngựa sang ô trống để tách đàn (không bắt buộc, không có ô cách ly riêng).
          </Notice>
        )}
      </div>

      <div className="space-y-5 lg:col-span-5 xl:col-span-4">
        <Card>
          <SectionTitle icon={<Warehouse size={16} />} action={horse.placement !== 'NONE' && <PlacementPill placement={horse.placement} />}>
            Khu, ô và Groom
          </SectionTitle>
          {horse.placement === 'NONE' ? (
            <p className="text-sm text-gray-500">Ngựa không còn ở câu lạc bộ nên không có chỗ ở.</p>
          ) : (
            <div className="space-y-2">
              <Slot
                icon={<Building2 size={16} />}
                label="Khu chuồng"
                value={horse.zone ? `${horse.zone.name}${horse.zone.headTrainerName ? ` · HT ${horse.zone.headTrainerName}` : ''}` : undefined}
                empty="Chờ xếp khu"
                tone={horse.zone ? 'default' : 'waiting'}
                actions={
                  horse.canAssignZone && (
                    <Button size="sm" variant={horse.zone ? 'ghost' : 'primary'} onClick={() => setZoneOpen(true)}>
                      {horse.zone ? <><ArrowRightLeft size={13} /> Đổi khu</> : 'Xếp khu'}
                    </Button>
                  )
                }
              />
              <Slot
                icon={<Warehouse size={16} />}
                label="Ô chuồng"
                value={horse.stall ? <span className="font-mono">{horse.stall.code}</span> : undefined}
                empty={horse.zone ? 'Chờ xếp ô' : 'Chưa có khu'}
                tone={waitingStall ? 'waiting' : 'default'}
                actions={
                  horse.canAssignStall && (
                    <>
                      <Button size="sm" variant={horse.stall ? 'ghost' : 'primary'} onClick={() => setStallOpen(true)}>
                        {horse.stall ? 'Đổi ô' : 'Xếp ô'}
                      </Button>
                      {horse.stall && (
                        <Button size="sm" variant="ghost" onClick={() => setUnassign('stall')}>
                          Gỡ
                        </Button>
                      )}
                    </>
                  )
                }
              />
              <Slot
                icon={<Users size={16} />}
                label="Groom phụ trách"
                value={horse.groom ? `${horse.groom.name}${horse.groom.active ? '' : ' (tài khoản bị khóa)'}` : undefined}
                empty={horse.stall ? 'Chờ phân công Groom' : 'Phân công khi xếp ô'}
                tone={waitingGroom ? 'waiting' : 'default'}
                actions={
                  horse.canAssignGroom && (horse.groom || horse.stall) && (
                    <>
                      <Button size="sm" variant={horse.groom ? 'ghost' : 'primary'} onClick={() => setGroomOpen(true)}>
                        {horse.groom ? 'Đổi' : 'Phân công'}
                      </Button>
                      {horse.groom && (
                        <Button size="sm" variant="ghost" onClick={() => setUnassign('groom')}>
                          Gỡ
                        </Button>
                      )}
                    </>
                  )
                }
              />
            </div>
          )}
          {!horse.zone && horse.placement === 'NO_ZONE' && !horse.canAssignZone && (
            <p className="mt-3 text-xs font-light text-gray-400">Ngựa chưa xếp khu thì chỉ Quản lý câu lạc bộ xử lý.</p>
          )}
        </Card>

        <Card variant="outline">
          <SectionTitle
            icon={<UserRound size={16} />}
            action={
              horse.canAssignOwner && (
                <Button size="sm" variant="soft" onClick={() => setOwnerOpen(true)}>
                  {horse.owner ? 'Đổi chủ' : 'Gán chủ'}
                </Button>
              )
            }
          >
            Chủ sở hữu
          </SectionTitle>
          {horse.owner ? (
            <div>
              <p className="font-semibold text-gray-900">{horse.owner.name}</p>
              {!horse.owner.active && (
                <p className="mt-1 text-xs text-amber-700">Tài khoản chủ đang bị khóa — vẫn giữ nguyên quyền sở hữu.</p>
              )}
              {horse.owner.active && !horse.owner.isOwnerRole && (
                <p className="mt-1 text-xs text-amber-700">Tài khoản không còn vai trò Chủ ngựa.</p>
              )}
              {horse.lifecycleStatus === 'TRANSFERRED' && <p className="mt-1 text-xs text-gray-400">Chủ tại thời điểm chuyển nhượng</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Chưa có chủ sở hữu</p>
          )}
        </Card>

        {horse.canAvatar && (
          <Card variant="flat">
            <SectionTitle>Ảnh đại diện</SectionTitle>
            <AvatarPicker value={horse.avatar} name={horse.name} size={72} disabled={avatarAction.pending} onChange={changeAvatar} />
            {avatarAction.error && <p className="mt-2 text-xs font-medium text-red-600">{avatarAction.error}</p>}
          </Card>
        )}
      </div>

      <AssignZoneDialog horse={zoneOpen ? placementHorse : null} onClose={() => setZoneOpen(false)} onDone={onChanged} />
      <AssignStallDialog horse={stallOpen ? placementHorse : null} onClose={() => setStallOpen(false)} onDone={onChanged} />
      <GroomDialog horse={groomOpen ? placementHorse : null} onClose={() => setGroomOpen(false)} onDone={onChanged} />
      <OwnerDialog
        open={ownerOpen}
        horse={{ id: horse.id, name: horse.name }}
        currentOwnerId={horse.owner?.id}
        onClose={() => setOwnerOpen(false)}
        onDone={onChanged}
      />
      <ReasonDialog
        open={unassign !== null}
        title={unassign === 'stall' ? `Gỡ ${horse.name} khỏi ô ${horse.stall?.code ?? ''}` : `Gỡ Groom của ${horse.name}`}
        message={
          unassign === 'stall'
            ? 'Ngựa về danh sách "Chờ xếp ô" của khu, ô trở về trống. Groom được giữ nguyên.'
            : 'Ngựa về danh sách "Chờ phân công Groom". Groom hiện tại nhận thông báo kết thúc phân công.'
        }
        confirmLabel={unassign === 'stall' ? 'Gỡ khỏi ô' : 'Gỡ Groom'}
        error={action.error}
        onClose={() => {
          setUnassign(null);
          action.clearError();
        }}
        onSubmit={async (reason) => {
          const done = await action.run(() => (unassign === 'stall' ? unassignStall(horse.id, reason) : unassignGroom(horse.id, reason)));
          if (done) {
            toast.push(unassign === 'stall' ? 'Đã gỡ ngựa khỏi ô' : 'Đã gỡ Groom', 'success');
            onChanged();
          }
          return !!done;
        }}
      />
    </div>
  );
}
