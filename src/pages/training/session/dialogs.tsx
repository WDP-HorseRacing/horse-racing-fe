// Hộp thoại của Sân tập: ghi thời gian chạy thử (kèm video), hoàn thành lượt, đánh giá sau buổi, đổi Groom dắt.
// Sau buổi (không giới hạn thời gian, trừ buổi đã hủy): sửa thời gian chạy thử và sửa đánh giá, đều bắt buộc lý do.
// Lỗi của từng ô hiện khi rời ô hoặc bấm lưu, nằm dưới đúng ô.
import { useState } from 'react';
import { Flag } from 'lucide-react';
import { assignParticipantGroom, completeParticipant, createEvaluation, listTrialResults, recordTrialResult, updateEvaluation, updateTrialResult } from '../../../api/training';
import { getParticipantSummary } from '../../../api/performance';
import type { Evaluation, GroomWorkload, Participant, TrialResult } from '../../../api/types';
import { Button, CancelButton, CharCount, ErrorBox, Field, Input, Modal, Notice, Select, Sheet, Skeleton, Textarea, cn, invalidClass, useToast } from '../../../components/ui';
import { useAction, useService } from '../../../hooks/useService';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { formatDelta, formatRaceTime, formatSpeed } from '../../../lib/training-format';
import { RaceTimeInput } from '../components/RaceTimeInput';
import { ScoreHorseshoe } from '../components/motion';
import { TrialVideoButton, TrialVideoPicker, type VideoUploadState } from '../components/TrialVideo';

/** Ghi chú lần chạy và nhận xét: BE không giới hạn, FE đặt mức hợp lý. Lý do sửa tối đa 500 như BE. */
const TRIAL_NOTES_MAX = 1000;
const COMMENT_MAX = 2000;
const REASON_MAX = 500;

/* ===== Ghi thời gian chạy thử (và có thể hoàn thành lượt ngay) ===== */

/**
 * Ghi một lần chạy cho lượt đang chạy hoặc vừa xong. Với `completeAfter`, lưu xong thì hoàn thành lượt luôn:
 * BE tự đóng buổi khi lượt cuối hoàn thành, sau đó không ghi được kết quả nữa, nên phải ghi trước khi hoàn thành.
 * Ghi được kết quả mà hoàn thành lỗi: nhớ lần đã ghi, bấm lại chỉ hoàn thành (gửi lại cùng lần chạy BE báo trùng).
 */
export function TrialDialog({
  participant,
  horseName,
  targetTimeMs,
  completeAfter,
  onClose,
  onDone,
}: {
  participant: Participant;
  horseName: string;
  targetTimeMs?: number | null;
  completeAfter?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const results = useService(() => listTrialResults(participant.id), [participant.id], { silent: true });
  const [elapsed, setElapsed] = useState<number>();
  const [elapsedIssue, setElapsedIssue] = useState<string>();
  const [notes, setNotes] = useState('');
  const [video, setVideo] = useState<VideoUploadState>({ uploading: false });
  // Lần chạy đã ghi xong ở lần bấm trước (hoàn thành lượt bị lỗi sau đó).
  const [recorded, setRecorded] = useState<TrialResult>();
  const save = useAction();
  const list: TrialResult[] = results.data ?? [];
  const nextAttempt = recorded ? recorded.attemptNo : (list.reduce((max, item) => Math.max(max, item.attemptNo), 0) || 0) + 1;
  const best = list.length ? Math.min(...list.map((item) => item.elapsedMs)) : undefined;
  const canSkipRecord = completeAfter && list.length > 0 && !recorded;

  const errors: Partial<Record<'elapsed' | 'notes', string>> = {};
  if (!recorded) {
    if (elapsedIssue) errors.elapsed = elapsedIssue;
    else if (!elapsed) errors.elapsed = 'Nhập phút và giây, ví dụ 1 phút 14,8 giây';
  }
  const f = useFormErrors(errors);

  const submit = (skipRecord = false) => {
    if (video.uploading) {
      toast.push('Video đang tải lên, đợi tải xong rồi lưu', 'info');
      return;
    }
    if (!skipRecord && !recorded && !f.attempt()) return;
    void save.run(
      async () => {
        if (!skipRecord && !recorded && elapsed) {
          const saved = await recordTrialResult(participant.id, { attemptNo: nextAttempt, elapsedMs: elapsed, notes: notes.trim() || undefined, videoMediaId: video.mediaId });
          setRecorded(saved);
        }
        if (completeAfter) await completeParticipant(participant.id);
      },
      () => {
        toast.push(completeAfter ? `${horseName} đã hoàn thành lượt chạy thử` : `Đã ghi lần chạy ${nextAttempt} của ${horseName}`, 'success');
        onDone();
      },
    );
  };

  return (
    <Modal
      open
      // Đã ghi kết quả mà chưa hoàn thành: đóng thì vẫn tải lại để thấy lần đã ghi.
      onClose={recorded ? onDone : onClose}
      title={completeAfter ? `Hoàn thành lượt chạy thử của ${horseName}` : `Ghi thời gian chạy thử của ${horseName}`}
      description={completeAfter ? 'Hoàn thành rồi thì không ghi thêm được.' : undefined}
      width="max-w-xl"
      dirty={!recorded && (!!elapsed || !!elapsedIssue || notes.trim() !== '' || !!video.mediaId || video.uploading)}
      busy={save.pending}
      onSave={() => submit(false)}
      saveLabel="Lưu"
      footer={
        <>
          <CancelButton />
          {canSkipRecord && (
            <Button variant="secondary" disabled={save.pending} onClick={() => submit(true)}>
              Hoàn thành
            </Button>
          )}
          <Button disabled={save.pending} onClick={() => submit(false)}>
            <Flag size={15} /> {video.uploading ? 'Đang tải video…' : save.pending ? 'Đang lưu…' : recorded ? 'Hoàn thành lượt' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <ErrorBox message={save.error} />}
        {recorded ? (
          <Notice tone="info">
            Đã ghi lần {recorded.attemptNo}: <b className="tabular-nums">{formatRaceTime(recorded.elapsedMs)}</b>. Bấm Hoàn thành lượt để thử lại.
          </Notice>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <Field label={`Thời gian lần ${nextAttempt}`} required name="elapsed" error={f.show('elapsed')} onBlur={f.blur('elapsed')} hint="Ví dụ 14,8 giây">
                <RaceTimeInput
                  value={elapsed}
                  invalid={!!f.show('elapsed')}
                  onChange={(ms, issue) => {
                    setElapsed(ms);
                    setElapsedIssue(issue);
                  }}
                  autoFocus
                />
              </Field>
              <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                <p className="text-xs text-gray-500">So với mục tiêu</p>
                {targetTimeMs && elapsed ? (
                  <p className={cn('tabular-nums text-lg font-bold', elapsed <= targetTimeMs ? 'text-emerald-700' : 'text-amber-700')}>{formatDelta(elapsed - targetTimeMs)}</p>
                ) : (
                  <p className="tabular-nums text-lg text-gray-400">{targetTimeMs ? formatRaceTime(targetTimeMs) : 'Chưa đặt mục tiêu'}</p>
                )}
                {targetTimeMs && <p className="text-xs text-gray-500">Mục tiêu {formatRaceTime(targetTimeMs)}</p>}
              </div>
            </div>
            <Field label="Ghi chú lần chạy" counter={<CharCount value={notes} max={TRIAL_NOTES_MAX} />}>
              <Textarea rows={2} maxLength={TRIAL_NOTES_MAX} value={notes} placeholder="Xuất phát chậm, đổi nhịp ở khúc cua…" onChange={(event) => setNotes(event.target.value)} />
            </Field>
            <TrialVideoPicker onChange={setVideo} disabled={save.pending} />
          </>
        )}
        {results.loading && !results.data ? (
          <Skeleton rows={1} />
        ) : (
          list.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">Các lần đã ghi</p>
              <ul className="space-y-1">
                {list.map((item) => (
                  <li key={item.id} className={cn('flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ring-1', item.elapsedMs === best ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-gray-100')}>
                    <span className="text-gray-500">Lần {item.attemptNo}</span>
                    <span className="tabular-nums font-semibold">{formatRaceTime(item.elapsedMs)}</span>
                    <span className="flex items-center gap-1 tabular-nums text-xs text-gray-500">
                      {targetTimeMs ? formatDelta(item.elapsedMs - targetTimeMs) : ''}
                      <TrialVideoButton url={item.videoUrl} title={`${horseName} lần chạy ${item.attemptNo}`} onExpired={results.reload} size="icon" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>
    </Modal>
  );
}

/* ===== Sửa thời gian một lần chạy thử (sau buổi, HLV của lớp) ===== */

export function TrialEditDialog({
  participantId,
  trial,
  horseName,
  targetTimeMs,
  onClose,
  onDone,
}: {
  participantId: string;
  trial: TrialResult;
  horseName: string;
  targetTimeMs?: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [elapsed, setElapsed] = useState<number | undefined>(trial.elapsedMs);
  const [elapsedIssue, setElapsedIssue] = useState<string>();
  const [notes, setNotes] = useState(trial.notes ?? '');
  const [reason, setReason] = useState('');
  const save = useAction();
  const timeChanged = !!elapsed && elapsed !== trial.elapsedMs;
  const notesChanged = notes.trim() !== (trial.notes ?? '');
  const changed = timeChanged || notesChanged;

  const errors: Partial<Record<'elapsed' | 'notes' | 'reason', string>> = {};
  if (elapsedIssue) errors.elapsed = elapsedIssue;
  else if (!elapsed) errors.elapsed = 'Nhập phút và giây';
  if (!reason.trim()) errors.reason = 'Nhập lý do sửa';
  else if (!changed) errors.reason = 'Chưa đổi thời gian hay ghi chú';
  const serverErrors = { elapsed: save.fieldErrors.elapsedMs, notes: save.fieldErrors.notes, reason: save.fieldErrors.reason };
  const f = useFormErrors(errors, { fieldErrors: Object.fromEntries(Object.entries(serverErrors).filter(([, value]) => value)) as Record<string, string> });
  const fieldShown = Object.values(serverErrors).some(Boolean);
  /** Sửa ô đang có lỗi BE thì bỏ lỗi đó. */
  const cleared = (key: keyof typeof serverErrors) => serverErrors[key] && save.clearError();

  const submit = () => {
    if (!f.attempt()) return;
    void save.run(
      () =>
        updateTrialResult(participantId, trial.attemptNo, {
          ...(timeChanged ? { elapsedMs: elapsed } : {}),
          ...(notesChanged ? { notes: notes.trim() || null } : {}),
          reason: reason.trim(),
        }),
      () => {
        toast.push(`Đã sửa lần chạy ${trial.attemptNo} của ${horseName}`, 'success');
        onDone();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Sửa lần chạy ${trial.attemptNo} của ${horseName}`}
      description={`Đang ghi ${formatRaceTime(trial.elapsedMs)}.`}
      width="max-w-lg"
      dirty={changed || reason.trim() !== ''}
      busy={save.pending}
      onSave={submit}
      saveLabel="Lưu"
      footer={
        <>
          <CancelButton />
          <Button disabled={save.pending} onClick={submit}>
            {save.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && !fieldShown && <ErrorBox message={save.error} />}
        <Field
          label="Thời gian"
          required
          name="elapsed"
          error={f.show('elapsed')}
          onBlur={f.blur('elapsed')}
          hint={targetTimeMs && elapsed ? `${formatDelta(elapsed - targetTimeMs)} so với mục tiêu ${formatRaceTime(targetTimeMs)}` : undefined}
        >
          <RaceTimeInput
            value={elapsed}
            invalid={!!f.show('elapsed')}
            onChange={(ms, issue) => {
              setElapsed(ms);
              setElapsedIssue(issue);
              cleared('elapsed');
            }}
            autoFocus
          />
        </Field>
        <Field label="Ghi chú lần chạy" name="notes" error={f.show('notes')} counter={<CharCount value={notes} max={TRIAL_NOTES_MAX} />}>
          <Textarea
            rows={2}
            maxLength={TRIAL_NOTES_MAX}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              cleared('notes');
            }}
          />
        </Field>
        <Field label="Lý do sửa" required name="reason" error={f.show('reason')} onBlur={f.blur('reason')}>
          <Input
            value={reason}
            maxLength={REASON_MAX}
            placeholder="Ví dụ: Bấm lại theo video"
            onChange={(event) => {
              setReason(event.target.value);
              cleared('reason');
            }}
            className={f.show('reason') ? invalidClass : ''}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ===== Hoàn thành lượt buổi thường ===== */

export function CompleteDialog({ participant, horseName, onClose, onDone }: { participant: Participant; horseName: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const summary = useService(() => getParticipantSummary(participant.id).catch(() => null), [participant.id], { silent: true });
  const save = useAction();
  const data = summary.data;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Hoàn thành: ${horseName}`}
      busy={save.pending}
      footer={
        <>
          <CancelButton />
          <Button
            disabled={save.pending}
            onClick={() =>
              void save.run(
                () => completeParticipant(participant.id),
                () => {
                  toast.push(`${horseName} đã hoàn thành lượt tập`, 'success');
                  onDone();
                },
              )
            }
          >
            {save.pending ? 'Đang lưu…' : 'Hoàn thành'}
          </Button>
        </>
      }
    >
      {save.error && <ErrorBox message={save.error} />}
      <p className="text-sm text-gray-600">Cảm biến sẽ ngừng ghi số đo.</p>
      {data && data.count > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-gray-50 p-2.5 ring-1 ring-gray-100">
            <p className="text-xs text-gray-500">Nhịp tim TB</p>
            <p className="tabular-nums font-semibold">{data.avgHeartRateBpm}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-2.5 ring-1 ring-gray-100">
            <p className="text-xs text-gray-500">Cao nhất</p>
            <p className="tabular-nums font-semibold">{data.maxHeartRateBpm}</p>
          </div>
          <div className={cn('rounded-xl p-2.5 ring-1', data.criticalCount ? 'bg-red-50 ring-red-100' : 'bg-gray-50 ring-gray-100')}>
            <p className="text-xs text-gray-500">Giây vượt ngưỡng</p>
            <p className="tabular-nums font-semibold">{data.warningCount + data.criticalCount}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ===== Đánh giá sau buổi (HLV). Có `existing` là sửa đánh giá đã lưu (lý do bắt buộc) ===== */

export function EvaluationSheet({
  participant,
  horseName,
  sessionName,
  existing,
  onClose,
  onDone,
}: {
  participant: Pick<Participant, 'id'>;
  horseName: string;
  sessionName: string;
  existing?: Evaluation;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const data = useService(
    async () => {
      const [summary, trials] = await Promise.all([getParticipantSummary(participant.id).catch(() => null), listTrialResults(participant.id).catch(() => [] as TrialResult[])]);
      return { summary, trials };
    },
    [participant.id],
    { silent: true },
  );
  const [score, setScore] = useState(existing?.score ?? 7);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const save = useAction();
  const editing = !!existing;
  const commentChanged = comment.trim() !== (existing?.comment ?? '');
  const changed = !existing || score !== existing.score || commentChanged;

  const errors: Partial<Record<'comment' | 'reason', string>> = {};
  if (comment.trim().length > COMMENT_MAX) errors.comment = `Nhận xét tối đa ${COMMENT_MAX} ký tự`;
  if (editing) {
    if (!reason.trim()) errors.reason = 'Nhập lý do sửa';
    else if (!changed) errors.reason = 'Chưa đổi điểm hay nhận xét';
  }
  const serverErrors = { comment: save.fieldErrors.comment, reason: save.fieldErrors.reason };
  const f = useFormErrors(errors, { fieldErrors: Object.fromEntries(Object.entries(serverErrors).filter(([, value]) => value)) as Record<string, string> });
  const fieldShown = Object.values(serverErrors).some(Boolean);
  const cleared = (key: keyof typeof serverErrors) => serverErrors[key] && save.clearError();

  const saveEdit = () => {
    if (!existing || !f.attempt()) return;
    void save.run(
      () =>
        updateEvaluation(participant.id, {
          ...(score !== existing.score ? { score } : {}),
          ...(commentChanged ? { comment: comment.trim() || null } : {}),
          reason: reason.trim(),
        }),
      () => {
        toast.push(`Đã sửa đánh giá của ${horseName}`, 'success');
        onDone();
      },
    );
  };
  const onSave = editing ? saveEdit : () => f.attempt() && setConfirming(true);
  const summary = data.data?.summary;
  const trials = data.data?.trials ?? [];

  return (
    <Sheet
      open
      onClose={onClose}
      title={editing ? `Sửa đánh giá ${horseName}` : `Đánh giá ${horseName}`}
      description={sessionName}
      dirty={editing ? changed || reason.trim() !== '' : comment.trim() !== '' || score !== 7}
      busy={save.pending}
      onSave={onSave}
      saveLabel="Lưu"
      footer={
        <>
          <CancelButton />
          <Button onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {save.error && !fieldShown && <ErrorBox message={save.error} />}
        <div className="flex flex-wrap items-center gap-5">
          <ScoreHorseshoe score={score} />
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-sm font-medium text-gray-700">Điểm phong độ</p>
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScore(value)}
                  className={cn(
                    'h-10 rounded-xl tabular-nums text-sm font-semibold ring-1 transition',
                    value === score ? 'bg-emerald-700 text-white ring-emerald-700' : value < score ? 'bg-emerald-50 text-emerald-800 ring-emerald-100' : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-300',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        {data.loading && !data.data ? (
          <Skeleton rows={2} />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: 'Nhịp tim TB', value: summary?.avgHeartRateBpm ?? '—' },
              { label: 'Nhịp tim cao nhất', value: summary?.maxHeartRateBpm ?? '—' },
              { label: 'Tốc độ TB', value: formatSpeed(summary?.avgSpeedMps) },
              { label: 'Tốc độ cao nhất', value: formatSpeed(summary?.maxSpeedMps) },
              { label: 'Số giây vượt ngưỡng', value: summary ? summary.warningCount + summary.criticalCount : '—', tone: summary?.criticalCount ? 'red' : undefined },
              { label: 'Chạy thử tốt nhất', value: trials.length ? formatRaceTime(Math.min(...trials.map((trial) => trial.elapsedMs))) : '—' },
            ].map((item) => (
              <div key={item.label} className={cn('rounded-xl p-2.5 ring-1', item.tone === 'red' ? 'bg-red-50 ring-red-100' : 'bg-gray-50 ring-gray-100')}>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="tabular-nums text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        <Field
          label="Nhận xét chuyên môn"
          name="comment"
          error={f.show('comment')}
          onBlur={f.blur('comment')}
          hint="Chủ ngựa đọc được nhận xét này trong nhật ký buổi tập."
          counter={<CharCount value={comment} max={COMMENT_MAX} />}
        >
          <Textarea
            rows={5}
            maxLength={COMMENT_MAX}
            value={comment}
            placeholder="Xuất phát, nhịp chạy, sức bền cuối bài, điều cần chỉnh ở buổi sau…"
            onChange={(event) => {
              setComment(event.target.value);
              cleared('comment');
            }}
            className={f.show('comment') ? invalidClass : ''}
          />
        </Field>
        {editing ? (
          <Field label="Lý do sửa" required name="reason" error={f.show('reason')} onBlur={f.blur('reason')}>
            <Input
              value={reason}
              maxLength={REASON_MAX}
              placeholder="Ví dụ: Chấm nhầm, xem lại video"
              onChange={(event) => {
                setReason(event.target.value);
                cleared('reason');
              }}
              className={f.show('reason') ? invalidClass : ''}
            />
          </Field>
        ) : (
          <Notice tone="info">Sửa được sau buổi, cần ghi lý do.</Notice>
        )}
      </div>

      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title={`Lưu ${score} điểm cho ${horseName}?`}
          busy={save.pending}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Quay lại
              </Button>
              <Button
                disabled={save.pending}
                onClick={() =>
                  void save.run(
                    async () => {
                      try {
                        return await createEvaluation(participant.id, { score, comment: comment.trim() || undefined });
                      } catch (error) {
                        // Gửi trùng (bấm hai lần, hai tab): BE trả 409, đánh giá đã lưu ở lần trước.
                        if (error instanceof Error && /đã có đánh giá/i.test(error.message)) return null;
                        throw error;
                      }
                    },
                    (saved) => {
                      toast.push(saved ? `Đã lưu đánh giá ${score} điểm cho ${horseName}` : `${horseName} đã có đánh giá, đã tải lại để xem`, saved ? 'success' : 'info');
                      setConfirming(false);
                      onDone();
                    },
                  )
                }
              >
                {save.pending ? 'Đang lưu…' : 'Lưu'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600">Chủ ngựa đọc được điểm và nhận xét. Muốn đổi sau thì sửa kèm lý do.</p>
          {save.error && <div className="mt-3"><ErrorBox message={save.error} /></div>}
        </Modal>
      )}
    </Sheet>
  );
}

/* ===== Đổi Groom dắt (HLV) ===== */

export function GroomDialog({ participant, horseName, grooms, onClose, onDone }: { participant: Participant; horseName: string; grooms: GroomWorkload[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [groomId, setGroomId] = useState(participant.assignedGroomId ?? '');
  const save = useAction();
  const unchanged = groomId === (participant.assignedGroomId ?? '');
  return (
    <Modal
      open
      onClose={onClose}
      title={`Đổi Groom dắt ${horseName}`}
      description="Chỉ đổi cho buổi này, không đổi Groom phụ trách ngựa."
      busy={save.pending}
      footer={
        <>
          <CancelButton />
          <Button
            disabled={save.pending}
            onClick={() =>
              // Chưa chọn Groom khác thì không có gì để lưu: đóng hộp.
              unchanged
                ? onClose()
                : void save.run(
                    () => assignParticipantGroom(participant.id, groomId || null),
                    () => {
                      toast.push('Đã đổi Groom dắt ngựa', 'success');
                      onDone();
                    },
                  )
            }
          >
            {save.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      {save.error && <ErrorBox message={save.error} />}
      <Field label="Groom">
        <Select value={groomId} onChange={(event) => setGroomId(event.target.value)}>
          <option value="">Chưa giao (HLV tự dắt)</option>
          {grooms.map((groom) => (
            <option key={groom.groomId} value={groom.groomId}>
              {groom.fullName} ({groom.activeHorseCount} ngựa)
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}
