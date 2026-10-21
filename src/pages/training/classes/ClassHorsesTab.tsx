// Tab Ngựa trong lớp: danh sách ghi danh (đang học trước), HLV ghi danh thêm ngựa thuộc khu mình và cho ngựa rời lớp.
// Sheet ghi danh lấy danh sách BE đã lọc (bỏ ngựa trùng giờ, vượt giới hạn trong ngày), báo trước khóa tập và Cần theo dõi.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Lock, LogOut, UserPlus } from 'lucide-react';
import { enrollHorse, leaveEnrollment, listEnrollableHorses } from '../../../api/training';
import { getEligibility } from '../../../api/horses';
import type { Eligibility, EnrollableHorse, Enrollment, HorseListItem } from '../../../api/types';
import { Avatar, Button, EmptyState, ErrorBox, Meter, Notice, Sheet, Skeleton, cn, useToast } from '../../../components/ui';
import { HealthPill } from '../../../components/ui/status';
import { useAction, useService } from '../../../hooks/useService';
import { formatDate } from '../../../lib/format';
import { enrollmentStatusText } from '../../../lib/training-labels';
import { links } from '../../../lib/links';
import { errorMessage } from '../../../lib/errors';
import { ReasonDialog } from '../components/ReasonDialog';
import { useHorseIndex, invalidateTrainingCache } from '../hooks';
import type { ClassBundle } from './class-bundle';

export default function ClassHorsesTab({
  bundle,
  manage,
  reload,
  enrollOpen,
  setEnrollOpen,
  sheetOnly,
}: {
  bundle: ClassBundle;
  manage: boolean;
  reload: () => void;
  enrollOpen: boolean;
  setEnrollOpen: (open: boolean) => void;
  /** Chỉ hiện sheet ghi danh (mở từ đầu trang khi đang ở tab khác). */
  sheetOnly?: boolean;
}) {
  const toast = useToast();
  const { item, enrollments } = bundle;
  const { index, loading } = useHorseIndex();
  const [leaving, setLeaving] = useState<Enrollment | null>(null);
  const leave = useAction();
  const sorted = useMemo(
    () => [...enrollments].sort((a, b) => (a.status === b.status ? b.enrolledAt.localeCompare(a.enrolledAt) : a.status === 'ACTIVE' ? -1 : b.status === 'ACTIVE' ? 1 : 0)),
    [enrollments],
  );
  const active = enrollments.filter((enrollment) => enrollment.status === 'ACTIVE');

  const sheet = enrollOpen && manage && item.status === 'ACTIVE' && (
    <EnrollSheet
      bundle={bundle}
      onClose={() => setEnrollOpen(false)}
      onDone={() => {
        setEnrollOpen(false);
        invalidateTrainingCache('horses');
        reload();
      }}
    />
  );
  if (sheetOnly) return sheet || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-56 flex-1">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-gray-600">Sĩ số</span>
            <span className="font-mono font-semibold">
              {active.length}/{item.maxHorses}
            </span>
          </div>
          <Meter value={active.length} max={item.maxHorses} tone={active.length >= item.maxHorses ? 'amber' : 'green'} />
        </div>
        {manage && item.status === 'ACTIVE' && (
          <Button onClick={() => setEnrollOpen(true)} disabled={active.length >= item.maxHorses}>
            <UserPlus size={15} /> Ghi danh ngựa
          </Button>
        )}
      </div>

      {loading && enrollments.length > 0 ? (
        <Skeleton rows={3} />
      ) : sorted.length === 0 ? (
        <EmptyState title="Chưa có ngựa nào trong lớp" hint={manage ? 'Ghi danh ngựa khu bạn để ngựa có lượt ở các buổi sắp tới.' : undefined} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {sorted.map((enrollment) => {
            const horse = index.get(enrollment.horseId);
            const name = enrollment.horseName || horse?.name || 'Ngựa';
            return (
              <li key={enrollment.id} className={cn('flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-gray-200/80', enrollment.status !== 'ACTIVE' && 'opacity-70')}>
                <Avatar src={enrollment.horsePhotoUrl ?? horse?.photoUrl ?? undefined} name={name} size={44} />
                <div className="min-w-0 flex-1">
                  <Link to={links.horse(enrollment.horseId, 'training')} className="block truncate font-semibold text-gray-900 hover:text-emerald-800">
                    {name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                    {horse && <HealthPill status={horse.healthStatus} className="text-xs" />}
                    <span>Vào lớp {formatDate(enrollment.enrolledAt)}</span>
                    {enrollment.leftAt && <span>Rời {formatDate(enrollment.leftAt)}</span>}
                  </div>
                </div>
                <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', enrollment.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600')}>
                  {enrollmentStatusText[enrollment.status]}
                </span>
                {manage && item.status === 'ACTIVE' && enrollment.status === 'ACTIVE' && (
                  <Button variant="ghost" size="icon" title="Cho ngựa rời lớp" onClick={() => setLeaving(enrollment)}>
                    <LogOut size={15} />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sheet}
      {leaving && (
        <ReasonDialog
          title="Cho ngựa rời lớp"
          message={
            <>
              <b>{leaving.horseName || index.get(leaving.horseId)?.name || 'Ngựa'}</b> rời lớp từ bây giờ. Lượt tập ở các buổi sau đó bị hủy.
            </>
          }
          label="Lý do rời lớp"
          suggestions={['Chuyển sang lớp phù hợp hơn', 'Chủ ngựa yêu cầu', 'Cần nghỉ hồi phục']}
          confirmLabel="Rời lớp"
          pending={leave.pending}
          error={leave.error}
          onClose={() => {
            setLeaving(null);
            leave.clearError();
          }}
          onConfirm={(reason) =>
            void leave.run(
              () => leaveEnrollment(leaving.id, { reason }),
              () => {
                toast.push('Ngựa đã rời lớp', 'success');
                setLeaving(null);
                reload();
              },
            ).then((result) => result === undefined && reload())
          }
        />
      )}
    </div>
  );
}

interface Candidate {
  horse: EnrollableHorse;
  info?: HorseListItem;
  eligibility?: Eligibility;
  warning?: string;
  locked?: boolean;
}

function EnrollSheet({ bundle, onClose, onDone }: { bundle: ClassBundle; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { item, enrollments, sessions } = bundle;
  const { index } = useHorseIndex();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);

  const enrolled = enrollments.filter((enrollment) => enrollment.status === 'ACTIVE').length;
  // BE đã lọc sẵn: chỉ ngựa trong khu của bạn, chưa ghi danh, không trùng giờ với lớp khác, không vượt giới hạn tập trong ngày.
  // FE tải thêm điều kiện tập từng con để báo trước khóa huấn luyện và Cần theo dõi.
  const list = useService(async () => {
    const horses = await listEnrollableHorses(item.id);
    const statuses = await Promise.all(horses.map((horse) => getEligibility(horse.horseId).catch(() => undefined)));
    return horses.map((horse, position) => ({ horse, eligibility: statuses[position] }));
  }, [item.id]);
  const now = new Date().toISOString();
  const heavyAhead = sessions.filter((session) => session.intensity === 'HEAVY' && session.scheduledStartAt > now && session.status === 'SCHEDULED').length;
  const seats = item.maxHorses - enrolled;

  const candidates: Candidate[] = (list.data ?? [])
    .map(({ horse, eligibility }) => {
      const info = index.get(horse.horseId);
      const locked = !!eligibility?.trainingReasons.includes('ACTIVE_TRAINING_LOCK');
      const health = info?.healthStatus;
      let warning: string | undefined;
      if (locked) warning = 'Đang khóa huấn luyện: các lượt tập sẽ bị hủy do khóa';
      else if (health === 'INJURED' || health === 'QUARANTINED') warning = 'Không đủ điều kiện tập: lượt tập thành Không đủ điều kiện';
      else if (health === 'UNDER_OBSERVATION') warning = heavyAhead ? `Đang cần theo dõi: chỉ tập buổi Nhẹ, không tập ${heavyAhead} buổi Nặng sắp tới` : 'Đang cần theo dõi: chỉ tập buổi Nhẹ';
      return { horse, info, eligibility, warning, locked };
    })
    .sort((a, b) => a.horse.horseName.localeCompare(b.horse.horseName, 'vi'));

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : current.length >= seats ? current : [...current, id]));

  const submit = async () => {
    setPending(true);
    setFailures([]);
    const errors: string[] = [];
    let ok = 0;
    for (const id of selected) {
      try {
        await enrollHorse(item.id, id);
        ok += 1;
      } catch (error) {
        errors.push(`${candidates.find((candidate) => candidate.horse.horseId === id)?.horse.horseName ?? 'Ngựa'}: ${errorMessage(error)}`);
      }
    }
    setPending(false);
    if (ok) toast.push(`Đã ghi danh ${ok} ngựa${errors.length ? `, ${errors.length} ngựa lỗi` : ''}`, errors.length ? 'info' : 'success');
    if (errors.length) setFailures(errors);
    else onDone();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Ghi danh ngựa"
      description={`Còn ${Math.max(0, seats)} chỗ trong lớp.`}
      dirty={selected.length > 0}
      onSave={() => void submit()}
      saveLabel="Ghi danh"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={selected.length === 0 || pending} onClick={() => void submit()}>
            <UserPlus size={15} /> {pending ? 'Đang ghi danh…' : `Ghi danh ${selected.length || ''} ngựa`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-gray-600">Sĩ số sau khi ghi danh</span>
            <span className="font-mono font-semibold">
              {enrolled + selected.length}/{item.maxHorses}
            </span>
          </div>
          <Meter value={enrolled + selected.length} max={item.maxHorses} tone={enrolled + selected.length >= item.maxHorses ? 'amber' : 'green'} />
        </div>
        {failures.length > 0 && <ErrorBox message={failures.join('. ')} />}
        {list.error && <ErrorBox message={list.error} />}
        {list.loading && !list.data ? (
          <Skeleton rows={4} />
        ) : candidates.length === 0 ? (
          <EmptyState title="Không còn ngựa nào ghi danh được" hint="Ngựa khu bạn đã ở lớp này, trùng giờ với lớp khác hoặc đã đủ buổi tập trong ngày." />
        ) : (
          <ul className="space-y-1.5">
            {candidates.map((candidate) => {
              const id = candidate.horse.horseId;
              const on = selected.includes(id);
              const full = !on && selected.length >= seats;
              const health = candidate.info?.healthStatus;
              return (
                <li key={id}>
                  <button
                    type="button"
                    disabled={full}
                    onClick={() => toggle(id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl p-2.5 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-60',
                      on ? 'bg-emerald-50/70 ring-2 ring-emerald-500/60' : 'bg-white ring-gray-200 hover:ring-gray-300',
                    )}
                  >
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1', on ? 'bg-emerald-700 text-white ring-emerald-700' : 'ring-gray-300')}>
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    <Avatar src={candidate.horse.horsePhotoUrl ?? candidate.info?.photoUrl ?? undefined} name={candidate.horse.horseName} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-gray-900">{candidate.horse.horseName}</span>
                        {candidate.locked && <Lock size={12} className="text-red-600" />}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                        {health && <HealthPill status={health} className="text-xs" />}
                        {candidate.info && (
                          <span>
                            {candidate.info.location.barn?.name}
                            {candidate.info.location.stall ? ` · ${candidate.info.location.stall.code}` : ''}
                          </span>
                        )}
                      </span>
                      {candidate.warning && <span className={cn('mt-1 block text-xs font-medium', candidate.locked ? 'text-red-700' : 'text-amber-800')}>{candidate.warning}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Notice tone="info">Danh sách đã bỏ ngựa trùng giờ với lớp khác và ngựa vượt giới hạn tập trong ngày. Ngựa ghi danh xong có lượt ở các buổi sắp tới của lớp.</Notice>
      </div>
    </Sheet>
  );
}
