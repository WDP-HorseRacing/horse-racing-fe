// Áp dụng tuần đang xem cho các tuần còn lại của cùng giai đoạn: chép mọi buổi chưa hủy của tuần (kể cả buổi đã xong,
// để chép được mẫu của tuần hiện tại), mỗi tuần cộng 7 ngày. FE lọc trước bằng luật của BE (trùng giờ, nghỉ 3 giờ,
// giới hạn ngày, trùng lịch HLV, giờ đã qua) và cho xem trước buổi nào thêm, buổi nào bỏ kèm lý do, rồi lưu theo lô.
// BE vẫn có thể từ chối phần FE không thấy (ngựa trùng lịch lớp khác): bỏ buổi đó rồi thử lại.
import { useMemo, useState } from 'react';
import type { ClassPlan, ClassPlanPhase, SessionInput, TrainingClass, TrainingSession } from '../../../api/types';
import { Button, CancelButton, ErrorBox, Modal, Notice, cn, useToast } from '../../../components/ui';
import { useService } from '../../../hooks/useService';
import { addDateKey, addMinutes, clubDateKey } from '../../../lib/club-time';
import { now } from '../../../lib/clock';
import { useStore } from '../../../store/store';
import { classPhaseAt, classWeekStart } from '../plan-helpers';
import { loadTrainerBusy, saveSessionsInChunks, type SaveFailure } from '../save-sessions';
import { acceptInOrder, sessionItem, slotText, type PlannedItem } from '../schedule-rules';

interface Copy extends PlannedItem {
  week: number;
  input: SessionInput;
}

export function ApplyWeekDialog({
  item,
  classPlan,
  sessions,
  week,
  phase,
  onClose,
  onDone,
}: {
  item: TrainingClass;
  classPlan: ClassPlan;
  sessions: TrainingSession[];
  week: number;
  phase: ClassPlanPhase;
  onClose: () => void;
  /** Đã lưu ít nhất một buổi: tải lại lịch. */
  onDone: () => void;
}) {
  const toast = useToast();
  const userId = useStore((state) => state.currentUser?.id);
  const busy = useService(() => loadTrainerBusy(userId, item.id), [userId, item.id]);
  const [skips, setSkips] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<{ saved: number; total: number } | null>(null);
  const [failure, setFailure] = useState<SaveFailure | null>(null);

  const weekStart = classWeekStart(item.startDate, week);
  const weekEnd = addDateKey(weekStart, 6);
  const live = useMemo(() => sessions.filter((session) => session.status !== 'CANCELLED'), [sessions]);
  const targets = useMemo(() => {
    const list: number[] = [];
    for (let next = week + 1; classWeekStart(item.startDate, next) <= phase.endDate; next += 1) list.push(next);
    return list;
  }, [week, item.startDate, phase.endDate]);

  const copies = useMemo<Copy[]>(() => {
    const source = live.filter((session) => session.subjectId && clubDateKey(session.scheduledStartAt) >= weekStart && clubDateKey(session.scheduledStartAt) <= weekEnd);
    return targets.flatMap((target) =>
      source.map((session) => {
        const shift = (target - week) * 7 * 24 * 60;
        const startAt = addMinutes(session.scheduledStartAt, shift);
        const endAt = addMinutes(session.scheduledEndAt, shift);
        const trial = session.sessionType === 'TIME_TRIAL';
        return {
          ...sessionItem(session),
          key: `${session.id}@${target}`,
          startAt,
          endAt,
          week: target,
          input: {
            name: session.name,
            sessionType: session.sessionType,
            subjectId: session.subjectId!,
            intensity: session.intensity,
            plannedDistanceM: session.plannedDistanceM,
            scheduledStartAt: startAt,
            scheduledEndAt: endAt,
            location: session.location ?? undefined,
            surface: session.surface ?? undefined,
            notes: session.notes ?? undefined,
            ...(trial ? { targetTimeMs: session.targetTimeMs } : {}),
          },
        };
      }),
    );
  }, [live, targets, week, weekStart, weekEnd]);

  const { accepted, skipped } = useMemo(() => {
    const ctx = {
      range: { from: item.startDate, to: item.endDate },
      phaseSubjects: (dateKey: string) => {
        const found = classPhaseAt(classPlan, dateKey);
        return found ? { position: found.position, ids: new Set(found.subjects.map((entry) => entry.subject.id)) } : undefined;
      },
      trainerBusy: busy.data ?? [],
      pastBefore: now(),
    };
    const result = acceptInOrder(
      copies.filter((copy) => !skips.has(copy.key)),
      live.map(sessionItem),
      ctx,
    );
    const manual = copies.filter((copy) => skips.has(copy.key)).map((copy) => ({ item: copy, problem: { kind: 'OVERLAP' as const, message: 'Đã bỏ theo yêu cầu' } }));
    return { accepted: result.accepted, skipped: [...result.skipped, ...manual].sort((a, b) => a.item.startAt.localeCompare(b.item.startAt)) };
  }, [copies, skips, live, busy.data, item.startDate, item.endDate, classPlan]);

  const targetText = targets.length > 1 ? `tuần ${targets[0]} đến ${targets.at(-1)}` : `tuần ${targets[0]}`;
  const byWeek = targets.map((target) => ({ week: target, items: accepted.filter((copy) => copy.week === target) }));
  const failedCopy = failure?.item ? copies.find((copy) => copy.input.scheduledStartAt === failure.item!.scheduledStartAt && copy.input.subjectId === failure.item!.subjectId) : undefined;

  const submit = async () => {
    if (!accepted.length || saving) return;
    setFailure(null);
    setSaving({ saved: 0, total: accepted.length });
    const result = await saveSessionsInChunks(item.id, accepted.map((copy) => copy.input), (saved, total) => setSaving({ saved, total }));
    setSaving(null);
    if (result.saved > 0) onDone();
    if (result.failure) {
      setFailure(result.failure);
      return;
    }
    toast.push(`Đã thêm ${result.saved} buổi vào ${targetText}`, 'success');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      busy={!!saving}
      title={`Áp dụng tuần ${week} cho các tuần còn lại của giai đoạn ${phase.position}`}
      description={`Chép các buổi của tuần ${week} sang ${targetText}, cùng thứ, cùng giờ.`}
      footer={
        <>
          <CancelButton />
          <Button onClick={() => void submit()} disabled={!accepted.length || !!saving || busy.loading}>
            {saving ? `Đang lưu ${saving.saved}/${saving.total}…` : `Thêm ${accepted.length} buổi`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {failure && (
          <div className="space-y-2">
            <ErrorBox message={failure.message} />
            {failedCopy && (
              <Button
                variant="inline"
                size="sm"
                onClick={() => {
                  setSkips((current) => new Set(current).add(failedCopy.key));
                  setFailure(null);
                }}
              >
                Bỏ buổi này rồi thử lại
              </Button>
            )}
          </div>
        )}
        {busy.loading ? (
          <p className="text-sm text-gray-500">Đang kiểm lịch các lớp khác của bạn…</p>
        ) : accepted.length === 0 ? (
          <Notice tone="info">Không còn buổi nào để thêm: các tuần sau đã có đủ buổi trùng giờ với tuần này, hoặc mọi buổi đều vướng luật.</Notice>
        ) : (
          <div>
            <p className="text-sm text-gray-700">
              Sẽ thêm <span className="font-semibold text-gray-900 tabular-nums">{accepted.length}</span> buổi.
            </p>
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl ring-1 ring-gray-200">
              {byWeek.map((entry) => (
                <li key={entry.week} className="flex gap-3 px-3 py-2 text-sm">
                  <span className="w-16 shrink-0 font-medium text-gray-900">Tuần {entry.week}</span>
                  <span className={cn('min-w-0', entry.items.length ? 'text-gray-600' : 'text-gray-400')}>
                    {entry.items.length ? entry.items.map((copy) => `${copy.name} ${slotText(copy.startAt)}`).join(', ') : 'Không thêm buổi nào'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {skipped.length > 0 && (
          <div>
            <p className="text-sm font-medium text-amber-800">Bỏ qua {skipped.length} buổi</p>
            <ul className="mt-1.5 space-y-1 text-sm text-gray-600">
              {skipped.map(({ item: copy, problem }) => (
                <li key={copy.key}>
                  <span className="font-medium text-gray-800">
                    {copy.name} {slotText(copy.startAt)}
                  </span>
                  : {problem.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-gray-500">Ngựa trùng lịch ở lớp khác chỉ được kiểm khi lưu.</p>
      </div>
    </Modal>
  );
}
