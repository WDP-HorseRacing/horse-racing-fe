// Tab Ngựa trong lớp: danh sách ghi danh (đang học trước), HLV ghi danh thêm ngựa thuộc khu mình và cho ngựa rời lớp.
// Sheet ghi danh báo trước hậu quả từng con: đang khóa thì lượt bị hủy, cần theo dõi thì không tập buổi nặng.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Lock, LogOut, UserPlus } from 'lucide-react';
import { enrollHorse, leaveEnrollment } from '../../../api/training';
import { getEligibility } from '../../../api/horses';
import type { Eligibility, Enrollment, HorseListItem } from '../../../api/types';
import { Avatar, Button, EmptyState, ErrorBox, Meter, Notice, Sheet, Skeleton, cn, useToast } from '../../../components/ui';
import { HealthPill } from '../../../components/ui/status';
import { useAction, useService } from '../../../hooks/useService';
import { useMyScope } from '../../../hooks/useMyScope';
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
      {manage && item.status === 'DRAFT' && <Notice tone="info">Lớp còn nháp. Kích hoạt lớp trước rồi mới ghi danh ngựa được.</Notice>}

      {loading && enrollments.length > 0 ? (
        <Skeleton rows={3} />
      ) : sorted.length === 0 ? (
        <EmptyState title="Chưa có ngựa nào trong lớp" hint={manage ? 'Ghi danh ngựa thuộc khu của bạn. Ngựa ghi danh sau khi buổi đã công bố vẫn có lượt ở các buổi sắp tới.' : undefined} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {sorted.map((enrollment) => {
            const horse = index.get(enrollment.horseId);
            return (
              <li key={enrollment.id} className={cn('flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-gray-200/80', enrollment.status !== 'ACTIVE' && 'opacity-70')}>
                <Avatar src={horse?.photoUrl ?? undefined} name={horse?.name ?? 'Ngựa'} size={44} />
                <div className="min-w-0 flex-1">
                  <Link to={links.horse(enrollment.horseId, 'training')} className="block truncate font-semibold text-gray-900 hover:text-emerald-800">
                    {horse?.name ?? 'Ngựa'}
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
              <b>{index.get(leaving.horseId)?.name ?? 'Ngựa'}</b> rời lớp từ bây giờ. Lượt tập ở các buổi sau đó bị hủy.
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
            )
          }
        />
      )}
    </div>
  );
}

interface Candidate {
  horse: HorseListItem;
  eligibility?: Eligibility;
  blocked?: string;
  warning?: string;
  locked?: boolean;
}

function EnrollSheet({ bundle, onClose, onDone }: { bundle: ClassBundle; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { item, enrollments, sessions } = bundle;
  const { scope } = useMyScope();
  const { horses, loading } = useHorseIndex();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);

  const enrolled = new Set(enrollments.filter((enrollment) => enrollment.status === 'ACTIVE').map((enrollment) => enrollment.horseId));
  const mine = horses.filter((horse) => !horse.isDeleted && horse.location.barn?.id && scope?.myBarnIds.has(horse.location.barn.id));
  const eligibility = useService(
    async () => {
      const entries = await Promise.all(mine.map(async (horse) => [horse.id, await getEligibility(horse.id).catch(() => undefined)] as const));
      return new Map(entries);
    },
    [mine.map((horse) => horse.id).join(',')],
    { silent: true },
  );
  const now = new Date().toISOString();
  const heavyAhead = sessions.filter((session) => session.intensity === 'HEAVY' && session.scheduledStartAt > now && (session.status === 'DRAFT' || session.status === 'SCHEDULED')).length;
  const seats = item.maxHorses - enrolled.size;

  const candidates: Candidate[] = mine
    .map((horse) => {
      const status = eligibility.data?.get(horse.id);
      const locked = !!status?.trainingReasons.includes('ACTIVE_TRAINING_LOCK');
      let blocked: string | undefined;
      let warning: string | undefined;
      if (enrolled.has(horse.id)) blocked = 'Đang học lớp này';
      else if (horse.lifecycleStatus === 'RETIRED') blocked = 'Đã giải nghệ';
      else if (horse.lifecycleStatus === 'TRANSFERRED') blocked = 'Đã chuyển nhượng';
      else if (horse.lifecycleStatus === 'DECEASED') blocked = 'Ngựa đã mất';
      else if (locked) warning = 'Đang khóa huấn luyện: các lượt tập sẽ bị hủy do khóa';
      else if (horse.healthStatus === 'INJURED' || horse.healthStatus === 'QUARANTINED') warning = 'Không đủ điều kiện tập: lượt tập thành Không đủ điều kiện';
      else if (horse.healthStatus === 'UNDER_OBSERVATION') warning = heavyAhead ? `Đang cần theo dõi: không tập được ${heavyAhead} buổi nặng sắp tới` : 'Đang cần theo dõi: không tập được buổi nặng';
      return { horse, eligibility: status, blocked, warning, locked };
    })
    .sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked) || a.horse.name.localeCompare(b.horse.name, 'vi'));

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
        errors.push(`${horses.find((horse) => horse.id === id)?.name ?? 'Ngựa'}: ${errorMessage(error)}`);
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
      description={`Chỉ ngựa thuộc khu của bạn. Còn ${Math.max(0, seats)} chỗ trong lớp.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Đóng
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
              {enrolled.size + selected.length}/{item.maxHorses}
            </span>
          </div>
          <Meter value={enrolled.size + selected.length} max={item.maxHorses} tone={enrolled.size + selected.length >= item.maxHorses ? 'amber' : 'green'} />
        </div>
        {failures.length > 0 && <ErrorBox message={failures.join('. ')} />}
        {loading || (eligibility.loading && !eligibility.data) ? (
          <Skeleton rows={4} />
        ) : candidates.length === 0 ? (
          <EmptyState title="Khu của bạn chưa có ngựa" />
        ) : (
          <ul className="space-y-1.5">
            {candidates.map((candidate) => {
              const on = selected.includes(candidate.horse.id);
              const full = !on && selected.length >= seats;
              return (
                <li key={candidate.horse.id}>
                  <button
                    type="button"
                    disabled={!!candidate.blocked || full}
                    onClick={() => toggle(candidate.horse.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl p-2.5 text-left ring-1 transition disabled:cursor-not-allowed',
                      on ? 'bg-emerald-50/70 ring-2 ring-emerald-500/60' : candidate.blocked ? 'bg-gray-50 opacity-60 ring-gray-100' : 'bg-white ring-gray-200 hover:ring-gray-300',
                    )}
                  >
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1', on ? 'bg-emerald-700 text-white ring-emerald-700' : 'ring-gray-300')}>
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    <Avatar src={candidate.horse.photoUrl ?? undefined} name={candidate.horse.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-gray-900">{candidate.horse.name}</span>
                        {candidate.locked && <Lock size={12} className="text-red-600" />}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                        <HealthPill status={candidate.horse.healthStatus} className="text-xs" />
                        <span>{candidate.horse.location.barn?.name}{candidate.horse.location.stall ? ` · ${candidate.horse.location.stall.code}` : ''}</span>
                      </span>
                      {(candidate.blocked || candidate.warning) && (
                        <span className={cn('mt-1 block text-xs font-medium', candidate.blocked ? 'text-gray-500' : candidate.locked ? 'text-red-700' : 'text-amber-800')}>{candidate.blocked ?? candidate.warning}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Notice tone="info">Ghi danh khi lớp đã công bố buổi: ngựa có lượt ở các buổi đã công bố trong tương lai. Buổi công bố sau sẽ có lượt cho ngựa đang học.</Notice>
      </div>
    </Sheet>
  );
}
