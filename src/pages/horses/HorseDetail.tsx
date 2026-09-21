import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Archive, ArrowLeft, Edit3, Lock, Trash2 } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { changeLifecycle, getDeleteBlockers, getHorse, softDeleteHorse } from '../../services/horse.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  ErrorBox,
  Field,
  InfoRow,
  Modal,
  NotFound,
  Pill,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from '../../components/ui';
import { HealthPill, LifecyclePill } from '../../components/ui/status';
import { distanceHint, distanceLabel, lifecycleLabel, sexLabel } from '../../lib/labels';
import { formatDate } from '../../lib/format';
import PedigreeTab from './tabs/PedigreeTab';
import OwnershipTab from './tabs/OwnershipTab';
import BodyTab from './tabs/BodyTab';
import PhotosTab from './tabs/PhotosTab';
import MedicalTab from './tabs/MedicalTab';
import TrainingTab from './tabs/TrainingTab';
import RaceTab from './tabs/RaceTab';
import ExpenseTab from './tabs/ExpenseTab';
import AuditTab from './tabs/AuditTab';
import { StallAndRateCard } from './StallAndRateCard';
import type { LifecycleStatus } from '../../types/domain';

export default function HorseDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const currentUser = useStore((state) => state.currentUser);
  const role = currentUser?.role;

  const { data: horse, loading, error, reload } = useService(() => getHorse(id), [id]);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [target, setTarget] = useState<LifecycleStatus>('RETIRED');
  const [reason, setReason] = useState('');
  const action = useAction();
  const blockers = useService(() => (deleteOpen ? getDeleteBlockers(id) : Promise.resolve([])), [deleteOpen, id]);

  const tabs = useMemo(() => {
    if (!horse) return [];
    if (horse.isReference) {
      return [
        { key: 'overview', label: 'Tổng quan' },
        { key: 'pedigree', label: 'Phả hệ' },
      ];
    }
    const list = [
      { key: 'overview', label: 'Tổng quan' },
      { key: 'photos', label: 'Ảnh' },
    ];
    if (role !== 'GROOM') list.push({ key: 'pedigree', label: 'Phả hệ' });
    if (role === 'CLUB_MANAGER' || role === 'HEAD_TRAINER' || role === 'HORSE_OWNER') {
      list.push({ key: 'ownership', label: 'Sở hữu' });
    }
    list.push({ key: 'body', label: 'Chỉ số cơ thể' });
    list.push({ key: 'medical', label: 'Y tế' });
    if (role !== 'GROOM') list.push({ key: 'training', label: 'Huấn luyện' });
    if (role === 'CLUB_MANAGER' || role === 'HEAD_TRAINER' || role === 'HORSE_OWNER') {
      list.push({ key: 'races', label: 'Thi đấu' });
    }
    if (role === 'CLUB_MANAGER' || role === 'HORSE_OWNER') list.push({ key: 'expenses', label: 'Chi phí' });
    if (role === 'CLUB_MANAGER') list.push({ key: 'audit', label: 'Nhật ký' });
    return list;
  }, [horse, role]);

  const active = params.get('tab') ?? 'overview';

  if (loading) return <Skeleton rows={6} />;
  if (error || !horse) return <NotFound />;

  const submitLifecycle = async () => {
    const done = await action.run(() => changeLifecycle(id, target, reason));
    if (done !== undefined) {
      setLifecycleOpen(false);
      setReason('');
      reload();
    }
  };

  const submitDelete = async () => {
    const done = await action.run(() => softDeleteHorse(id, reason));
    if (done !== undefined) {
      setDeleteOpen(false);
      navigate('/horses');
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <button
        onClick={() => navigate('/horses')}
        className="flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-gray-600"
      >
        <ArrowLeft size={16} /> Danh sách ngựa
      </button>

      {horse.deleted && (
        <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <Trash2 size={18} className="mt-0.5 shrink-0" />
          <span>
            <strong>Hồ sơ đã xóa.</strong> Lý do: {horse.deleteReason ?? '—'}
          </span>
        </div>
      )}

      {horse.activeLockReason && (
        <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <Lock size={18} className="mt-0.5 shrink-0" />
          <span>
            <strong>Đang có khóa huấn luyện.</strong> Bác sĩ đặt khóa ngày {formatDate(horse.activeLockSince)}. Lý do:{' '}
            {horse.activeLockReason}. Mọi buổi tập chưa diễn ra đã bị hủy và không thêm được buổi mới cho tới khi gỡ khóa.
          </span>
        </div>
      )}

      {horse.lifecycleStatus === 'TRANSFERRED' && (
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          <Archive size={18} className="mt-0.5 shrink-0" />
          <span>
            <strong>Ngựa đã rời câu lạc bộ.</strong> Hồ sơ được giữ lại để tra cứu lịch sử, không còn thao tác được:
            không xếp chuồng, không giáo án, không đăng ký thi đấu. Trạng thái sức khỏe ghi nhận tại thời điểm chuyển
            nhượng.
          </span>
        </div>
      )}

      {/* Đầu trang hồ sơ */}
      <Card>
        <div className="flex flex-wrap items-start gap-5">
          <Avatar src={horse.avatar} name={horse.name} size={92} className="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">{horse.name}</h2>
              {horse.isReference && <Pill tone="gray">Ngựa tham chiếu</Pill>}
            </div>
            <p className="mt-1 font-mono text-sm text-gray-400">{horse.chipNumber ?? 'Chưa gắn chip định danh'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!horse.isReference && <HealthPill status={horse.healthStatus} />}
              <LifecyclePill status={horse.lifecycleStatus} />
              {/* Ngựa đã rời câu lạc bộ thì hai nhãn này luôn là "không" — dải thông báo phía trên đã nói rõ hơn. */}
              {!horse.isReference && horse.lifecycleStatus !== 'TRANSFERRED' && (
                <>
                  <Pill tone={horse.raceAllowed ? 'green' : 'gray'}>
                    {horse.raceAllowed ? 'Được đua' : `Không được đua — ${horse.raceReason}`}
                  </Pill>
                  <Pill tone={horse.trainAllowed ? 'green' : 'gray'}>
                    {horse.trainAllowed ? 'Được tập' : `Không được tập — ${horse.trainReason}`}
                  </Pill>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(horse.canEditIdentity || horse.canEditPreference) && !horse.deleted && (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/horses/${id}/edit`)}>
                <Edit3 size={14} /> Sửa hồ sơ
              </Button>
            )}
            {can(currentUser, 'horse.lifecycle') && !horse.isReference && !horse.deleted && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTarget(horse.lifecycleStatus === 'RETIRED' ? 'TRANSFERRED' : 'RETIRED');
                    setLifecycleOpen(true);
                  }}
                >
                  Đổi vòng đời
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 size={14} /> Xóa hồ sơ
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} active={active} onChange={(key) => setParams({ tab: key })} />

      {active === 'overview' && (
        <div className="grid gap-5 md:grid-cols-5">
          <Card className="md:col-span-3">
            <h3 className="mb-4 text-sm font-semibold text-gray-500">Định danh</h3>
            <InfoRow label="Tên" value={horse.name} />
            <InfoRow label="Giới tính" value={sexLabel[horse.sex]} />
            <InfoRow label="Giống" value={horse.breed ?? '—'} />
            <InfoRow label="Màu lông" value={horse.color ?? '—'} />
            <InfoRow
              label="Ngày sinh"
              value={horse.birthDate ? `${formatDate(horse.birthDate)} (${horse.age} tuổi)` : '—'}
            />
            <InfoRow label="Số chip" value={horse.chipNumber ?? '—'} />
            <InfoRow
              label="Sở trường cự ly"
              value={
                horse.distancePreference
                  ? `${distanceLabel[horse.distancePreference]} (${distanceHint[horse.distancePreference]})`
                  : '—'
              }
            />
          </Card>

          {!horse.isReference && <StallAndRateCard horse={horse} onChanged={reload} />}
        </div>
      )}

      {active === 'photos' && <PhotosTab horseId={id} />}
      {active === 'pedigree' && <PedigreeTab horseId={id} onChanged={reload} />}
      {active === 'ownership' && <OwnershipTab horseId={id} />}
      {active === 'body' && <BodyTab horseId={id} />}
      {active === 'medical' && <MedicalTab horseId={id} horseName={horse.name} onChanged={reload} />}
      {active === 'training' && <TrainingTab horseId={id} />}
      {active === 'races' && <RaceTab horseId={id} />}
      {active === 'expenses' && <ExpenseTab horseId={id} />}
      {active === 'audit' && <AuditTab horseId={id} />}

      {/* Đổi vòng đời */}
      <Modal
        open={lifecycleOpen}
        onClose={() => setLifecycleOpen(false)}
        title="Đổi vòng đời ngựa"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLifecycleOpen(false)}>
              Quay lại
            </Button>
            <Button variant="danger" onClick={submitLifecycle} disabled={action.pending}>
              {action.pending ? 'Đang lưu…' : 'Xác nhận'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Trạng thái mới" required>
            <Select value={target} onChange={(event) => setTarget(event.target.value as LifecycleStatus)}>
              {horse.lifecycleStatus === 'ACTIVE' && (
                <>
                  <option value="RETIRED">{lifecycleLabel.RETIRED}</option>
                  <option value="TRANSFERRED">{lifecycleLabel.TRANSFERRED}</option>
                </>
              )}
              {horse.lifecycleStatus === 'RETIRED' && (
                <>
                  <option value="ACTIVE">{lifecycleLabel.ACTIVE} (quay lại hoạt động)</option>
                  <option value="TRANSFERRED">{lifecycleLabel.TRANSFERRED}</option>
                </>
              )}
            </Select>
          </Field>
          <Field label="Lý do" required error={action.field === 'reason' ? action.error : undefined}>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <ul className="space-y-1.5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            {target === 'RETIRED' && (
              <>
                <li>Hủy mọi giáo án sắp tới và đang áp dụng cùng buổi tập chưa diễn ra.</li>
                <li>Hủy các đăng ký thi đấu chưa diễn ra.</li>
                <li>Giữ nguyên ô chuồng và việc chăm sóc y tế.</li>
              </>
            )}
            {target === 'TRANSFERRED' && (
              <>
                <li>Hủy giáo án, buổi tập và đăng ký thi đấu chưa diễn ra.</li>
                <li>Kết thúc xếp chuồng, ô chuồng trở về trống.</li>
                <li>Đóng mọi quyền sở hữu đang mở và tự gỡ khóa huấn luyện.</li>
                <li>Đây là trạng thái cuối, không đổi lại được.</li>
              </>
            )}
            {target === 'ACTIVE' && <li>Giáo án và đăng ký đã hủy trước đó không tự khôi phục.</li>}
          </ul>
          {action.error && !action.field && <ErrorBox message={action.error} />}
        </div>
      </Modal>

      {/* Xóa hồ sơ */}
      <ConfirmDialog
        open={deleteOpen}
        title="Xóa hồ sơ ngựa"
        message={
          (blockers.data?.length ?? 0) > 0
            ? 'Không xóa được hồ sơ này vì đã phát sinh dữ liệu:'
            : 'Hồ sơ sẽ bị ẩn khỏi danh sách. Quản lý câu lạc bộ vẫn xem lại được qua bộ lọc.'
        }
        consequences={blockers.data}
        confirmLabel="Xóa hồ sơ"
        pending={action.pending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={submitDelete}
      >
        {(blockers.data?.length ?? 0) === 0 && (
          <Field label="Lý do xóa" required error={action.field === 'reason' ? action.error : undefined}>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        )}
        {action.error && !action.field && <ErrorBox message={action.error} />}
      </ConfirmDialog>
    </div>
  );
}
