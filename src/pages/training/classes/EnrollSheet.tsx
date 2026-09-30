// Panel đăng ký ngựa vào lớp (F2.5): ngựa đạt có nút Đăng ký, ngựa không đạt bị khóa và hiện ĐỦ lý do.
import { AlertTriangle, Lock, UserPlus } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import { enrollHorse, listEnrollCandidates, type EnrollCandidate } from '../../../services/training.service';
import { Avatar, Button, cn, EmptyState, ErrorBox, Meter, Notice, Pill, Sheet, Skeleton, useToast } from '../../../components/ui';
import { HealthPill, IntensityMeter } from '../../../components/ui/status';
import { formatDate } from '../../../lib/format';

export function EnrollSheet({
  classId,
  open,
  onClose,
  onChanged,
}: {
  classId: string;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const { data, loading, error, reload } = useService(
    () => (open ? listEnrollCandidates(classId) : Promise.resolve(undefined)),
    [classId, open],
  );

  const enroll = async (candidate: EnrollCandidate) => {
    const id = await action.run(() => enrollHorse(classId, candidate.horseId));
    if (id) {
      toast.push(`Đã đăng ký ${candidate.horseName} vào lớp`, 'success');
      reload();
      onChanged();
    }
  };

  const allowed = data?.candidates.filter((item) => item.allowed) ?? [];
  const blocked = data?.candidates.filter((item) => !item.allowed) ?? [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={data ? `Đăng ký ngựa vào lớp ${data.className}` : 'Đăng ký ngựa vào lớp'}
      description="Chỉ ngựa thuộc khu của lớp, đang hoạt động và được tập ở cường độ cao nhất còn lại của lớp."
    >
      {loading && !data && <Skeleton rows={5} />}
      {error && <ErrorBox message={error} />}
      {data && (
        <div className="space-y-5">
          <div className="grid gap-3 rounded-xl bg-gray-50 px-4 py-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Nhận buổi từ</p>
              <p className="font-semibold text-gray-900 tabular-nums">{formatDate(data.fromDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cường độ cao nhất còn lại</p>
              <div className="mt-1">{data.maxIntensity ? <IntensityMeter intensity={data.maxIntensity} /> : '—'}</div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Sĩ số</p>
              <p className="font-semibold text-gray-900 tabular-nums">
                {data.enrolled}/{data.capacity}
              </p>
              <Meter value={data.enrolled} max={data.capacity} className="mt-1.5" />
            </div>
          </div>

          {data.full && (
            <Notice tone="warning" icon={<AlertTriangle size={16} />}>
              Lớp đã đủ sĩ số. Muốn nhận thêm ngựa, hãy tăng sĩ số tối đa của lớp (tối đa 20) hoặc rút bớt ngựa.
            </Notice>
          )}
          {action.error && <ErrorBox message={action.error} />}

          {data.candidates.length === 0 && (
            <EmptyState title="Khu này chưa có ngựa nào" hint="Lớp chỉ nhận ngựa thuộc khu của lớp." />
          )}

          {allowed.length > 0 && (
            <section>
              <p className="mb-2 text-sm font-semibold text-gray-900">Có thể đăng ký ({allowed.length})</p>
              <ul className="space-y-2">
                {allowed.map((candidate) => (
                  <CandidateCard
                    key={candidate.horseId}
                    candidate={candidate}
                    pending={action.pending}
                    onEnroll={() => enroll(candidate)}
                  />
                ))}
              </ul>
            </section>
          )}

          {blocked.length > 0 && (
            <section>
              <p className="mb-2 text-sm font-semibold text-gray-600">Không đăng ký được ({blocked.length})</p>
              <ul className="space-y-2">
                {blocked.map((candidate) => (
                  <CandidateCard key={candidate.horseId} candidate={candidate} pending={action.pending} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}

function CandidateCard({
  candidate,
  pending,
  onEnroll,
}: {
  candidate: EnrollCandidate;
  pending: boolean;
  onEnroll?: () => void;
}) {
  return (
    <li
      className={cn(
        'rounded-2xl p-4 ring-1',
        candidate.allowed ? 'bg-white ring-gray-200' : 'bg-gray-50/80 ring-gray-200/70',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar src={candidate.horseAvatar} name={candidate.horseName} size={44} className={cn(!candidate.allowed && 'grayscale')} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('font-semibold', candidate.allowed ? 'text-gray-900' : 'text-gray-600')}>{candidate.horseName}</span>
            {candidate.healthStatus !== 'ELIGIBLE' && <HealthPill status={candidate.healthStatus} />}
            {candidate.lifecycleStatus === 'RETIRED' && <Pill tone="gray">Đã giải nghệ</Pill>}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {candidate.stallCode ? `Ô ${candidate.stallCode}` : 'Chờ xếp ô'} · Groom {candidate.groomName ?? 'chưa phân công'}
            {candidate.otherClasses.length > 0 && ` · đang học ${candidate.otherClasses.join(', ')}`}
          </p>
        </div>
        {candidate.allowed ? (
          <Button size="sm" variant="secondary" onClick={onEnroll} disabled={pending}>
            <UserPlus size={14} /> Đăng ký
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500">
            <Lock size={12} /> Bị chặn
          </span>
        )}
      </div>
      {candidate.reasons.length > 0 && (
        <ul className="mt-2.5 space-y-1 pl-14 text-sm text-red-700">
          {candidate.reasons.map((reason) => (
            <li key={reason} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-red-500" />
              {reason}
            </li>
          ))}
        </ul>
      )}
      {candidate.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 pl-14 text-sm text-amber-800">
          {candidate.warnings.map((warning) => (
            <li key={warning} className="flex gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
