// Tab Tổng quan của hồ sơ ngựa: thông tin hồ sơ, tình trạng hiện tại (lớp, bệnh án, khóa) và chuồng trại – phụ trách.
// Trình bày dạng danh sách nhãn – giá trị trên nền trắng; chỉ điều cần xử lý mới có màu.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAction } from '../../../hooks/useService';
import { unassignGroom, unassignStall, type HorseDetail } from '../../../services/horse.service';
import { Button, Card, InfoGrid, SectionTitle, cn, useToast } from '../../../components/ui';
import { distanceHint, distanceLabel, sexLabel } from '../../../lib/labels';
import { formatDate } from '../../../lib/format';
import { links } from '../../../lib/links';
import OwnerDialog from '../components/OwnerDialog';
import {
  AssignStallDialog,
  AssignZoneDialog,
  GroomDialog,
  ReasonDialog,
  type PlacementHorse,
} from '../../stable/components/PlacementDialogs';

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

export default function OverviewTab({ horse, onChanged }: { horse: HorseDetail; onChanged: () => void }) {
  const toast = useToast();
  const action = useAction();
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

  const parentLink = (parent?: HorseDetail['sire']) =>
    parent ? (
      parent.id ? (
        <Link className="text-emerald-700 hover:underline" to={links.horse(parent.id)}>
          {parent.name}
        </Link>
      ) : (
        parent.name
      )
    ) : undefined;

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
    { label: 'Cha', value: parentLink(horse.sire) },
    { label: 'Mẹ', value: parentLink(horse.dam) },
    { label: 'Ngày tạo hồ sơ', value: formatDate(horse.createdAt) },
  ];

  const inClub = horse.placement !== 'NONE';
  const textButton = (label: ReactNode, onClick: () => void, primary = false) => (
    <Button size="sm" variant={primary ? 'secondary' : 'ghost'} onClick={onClick}>
      {label}
    </Button>
  );

  return (
    <div className="grid items-start gap-5 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-7 xl:col-span-8">
        <Card>
          <SectionTitle>Thông tin hồ sơ</SectionTitle>
          <InfoGrid items={info} className="xl:grid-cols-3" />
        </Card>

        <Card>
          <SectionTitle>Tình trạng hiện tại</SectionTitle>
          {horse.canViewTraining && (
            <Row
              label="Lớp đang học"
              tone={horse.activeClassCount ? 'default' : 'muted'}
              actions={
                <Link
                  to={links.horse(horse.id, 'training')}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                >
                  Lịch tập và kết quả
                </Link>
              }
            >
              {horse.activeClassCount ? `${horse.activeClassCount} lớp` : 'Chưa học lớp nào'}
            </Row>
          )}
          {horse.canViewMedical ? (
            <>
              <Row label="Bệnh án" tone={horse.openCase ? 'waiting' : 'muted'}>
                {horse.openCase ? (
                  <Link to={links.case(horse.openCase.id)} className="hover:underline">
                    Đang điều trị: {horse.openCase.title}
                  </Link>
                ) : (
                  'Không có bệnh án đang mở'
                )}
              </Row>
              <Row label="Khóa huấn luyện" tone={horse.activeLock ? 'danger' : 'muted'}>
                {horse.activeLock ? (
                  <>
                    {horse.activeLock.reason}
                    <span className="block text-xs font-normal text-gray-500">
                      Từ {formatDate(horse.activeLock.placedAt)}
                      {horse.activeLock.expectedLiftDate ? ` · dự kiến gỡ ${formatDate(horse.activeLock.expectedLiftDate)}` : ''}
                    </span>
                  </>
                ) : (
                  'Không có'
                )}
              </Row>
            </>
          ) : (
            <Row label="Y tế" tone="muted">
              Thông tin y tế chi tiết dành cho bác sĩ, huấn luyện viên và quản lý.
            </Row>
          )}
          {horse.quarantineHint && (
            <Row label="Gợi ý" tone="waiting">
              Ngựa đang cách ly — HT của khu có thể cân nhắc chuyển ngựa sang ô trống để tách đàn.
            </Row>
          )}
        </Card>
      </div>

      <Card className="lg:col-span-5 xl:col-span-4">
        <SectionTitle>Chuồng trại và phụ trách</SectionTitle>
        {!inClub ? (
          <p className="text-sm text-gray-500">Ngựa không còn ở câu lạc bộ nên không có chỗ ở.</p>
        ) : (
          <>
            <Row
              label="Khu chuồng"
              tone={horse.zone ? 'default' : 'waiting'}
              actions={horse.canAssignZone && textButton(horse.zone ? 'Đổi khu' : 'Xếp khu', () => setZoneOpen(true), !horse.zone)}
            >
              {horse.zone ? (
                <>
                  {horse.zone.name}
                  {horse.zone.headTrainerName && <span className="block text-xs font-normal text-gray-500">HT {horse.zone.headTrainerName}</span>}
                </>
              ) : (
                'Chờ xếp khu'
              )}
            </Row>
            <Row
              label="Ô chuồng"
              tone={horse.stall ? 'default' : horse.zone ? 'waiting' : 'muted'}
              actions={
                horse.canAssignStall && (
                  <>
                    {textButton(horse.stall ? 'Đổi ô' : 'Xếp ô', () => setStallOpen(true), !horse.stall)}
                    {horse.stall && textButton('Gỡ', () => setUnassign('stall'))}
                  </>
                )
              }
            >
              {horse.stall ? <span className="font-mono">{horse.stall.code}</span> : horse.zone ? 'Chờ xếp ô' : 'Chưa có khu'}
            </Row>
            <Row
              label="Groom"
              tone={horse.groom ? 'default' : horse.stall ? 'waiting' : 'muted'}
              actions={
                horse.canAssignGroom &&
                (horse.groom || horse.stall) && (
                  <>
                    {textButton(horse.groom ? 'Đổi' : 'Phân công', () => setGroomOpen(true), !horse.groom)}
                    {horse.groom && textButton('Gỡ', () => setUnassign('groom'))}
                  </>
                )
              }
            >
              {horse.groom ? `${horse.groom.name}${horse.groom.active ? '' : ' (tài khoản bị khóa)'}` : horse.stall ? 'Chờ phân công Groom' : 'Phân công khi xếp ô'}
            </Row>
          </>
        )}
        <Row
          label="Chủ sở hữu"
          tone={horse.owner ? 'default' : 'muted'}
          actions={horse.canAssignOwner && textButton(horse.owner ? 'Đổi chủ' : 'Gán chủ', () => setOwnerOpen(true))}
        >
          {horse.owner ? (
            <>
              {horse.owner.name}
              {!horse.owner.active && <span className="block text-xs font-normal text-amber-700">Tài khoản đang bị khóa — vẫn giữ quyền sở hữu</span>}
              {horse.owner.active && !horse.owner.isOwnerRole && (
                <span className="block text-xs font-normal text-amber-700">Tài khoản không còn vai trò Chủ ngựa</span>
              )}
              {horse.lifecycleStatus === 'TRANSFERRED' && <span className="block text-xs font-normal text-gray-500">Chủ tại thời điểm chuyển nhượng</span>}
            </>
          ) : (
            'Chưa có chủ sở hữu'
          )}
        </Row>
        {inClub && !horse.zone && !horse.canAssignZone && (
          <p className="mt-3 text-xs text-gray-500">Ngựa chưa xếp khu thì chỉ Quản lý câu lạc bộ xử lý.</p>
        )}
      </Card>

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
