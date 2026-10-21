// Hộp thoại của Sân tập: ghi thời gian chạy thử (kèm video), hoàn thành lượt, đánh giá sau buổi, đổi Groom dắt.
// Sau buổi (7 ngày): sửa thời gian chạy thử và sửa đánh giá, đều bắt buộc lý do.
import { useState } from 'react';
import { Flag } from 'lucide-react';
import { assignParticipantGroom, completeParticipant, createEvaluation, listTrialResults, recordTrialResult, updateEvaluation, updateTrialResult } from '../../../api/training';
import { getParticipantSummary } from '../../../api/performance';
import type { Evaluation, GroomWorkload, Participant, TrialResult } from '../../../api/types';
import { Button, ErrorBox, Field, Input, Modal, Notice, Select, Sheet, Skeleton, Textarea, cn, useToast } from '../../../components/ui';
import { useAction, useService } from '../../../hooks/useService';
import { formatDelta, formatRaceTime, formatSpeed } from '../../../lib/training-format';
import { RaceTimeInput } from '../components/RaceTimeInput';
import { ScoreHorseshoe } from '../components/motion';
import { TrialVideoButton, TrialVideoPicker, type VideoUploadState } from '../components/TrialVideo';

/* ===== Ghi thời gian chạy thử (và có thể hoàn thành lượt ngay) ===== */

/**
 * Ghi một lần chạy cho lượt đang chạy hoặc vừa xong. Với `completeAfter`, lưu xong thì hoàn thành lượt luôn:
 * BE tự đóng buổi khi lượt cuối hoàn thành, sau đó không ghi được kết quả nữa, nên phải ghi trước khi hoàn thành.
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
  const [notes, setNotes] = useState('');
  const [video, setVideo] = useState<VideoUploadState>({ uploading: false });
  const [touched, setTouched] = useState(false);
  const save = useAction();
  const list: TrialResult[] = results.data ?? [];
  const nextAttempt = (list.reduce((max, item) => Math.max(max, item.attemptNo), 0) || 0) + 1;
  const best = list.length ? Math.min(...list.map((item) => item.elapsedMs)) : undefined;
  const canSkipRecord = completeAfter && list.length > 0;

  const submit = (skipRecord = false) => {
    setTouched(true);
    if (!skipRecord && !elapsed) return;
    void save.run(
      async () => {
        if (!skipRecord && elapsed) await recordTrialResult(participant.id, { attemptNo: nextAttempt, elapsedMs: elapsed, notes: notes.trim() || undefined, videoMediaId: video.mediaId });
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
      onClose={onClose}
      title={completeAfter ? `Hoàn thành lượt chạy thử của ${horseName}` : `Ghi thời gian chạy thử của ${horseName}`}
      description={completeAfter ? 'Hoàn thành rồi thì không ghi thêm được.' : undefined}
      width="max-w-xl"
      dirty={!!elapsed || notes.trim() !== '' || !!video.mediaId || video.uploading}
      onSave={() => submit(false)}
      saveLabel="Lưu"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          {canSkipRecord && (
            <Button variant="secondary" disabled={save.pending} onClick={() => submit(true)}>
              Hoàn thành
            </Button>
          )}
          <Button disabled={save.pending || video.uploading} onClick={() => submit(false)}>
            <Flag size={15} /> {video.uploading ? 'Đang tải video…' : save.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <ErrorBox message={save.error} />}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <Field label={`Thời gian lần ${nextAttempt}`} required error={touched && !elapsed ? 'Nhập phút và giây, ví dụ 1 phút 14,8 giây' : undefined} hint="Ví dụ 14,8 giây">
            <RaceTimeInput value={elapsed} invalid={touched && !elapsed} onChange={(ms) => setElapsed(ms)} autoFocus />
          </Field>
          <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
            <p className="text-xs text-gray-500">So với mục tiêu</p>
            {targetTimeMs && elapsed ? (
              <p className={cn('font-mono text-lg font-bold', elapsed <= targetTimeMs ? 'text-emerald-700' : 'text-amber-700')}>{formatDelta(elapsed - targetTimeMs)}</p>
            ) : (
              <p className="font-mono text-lg text-gray-400">{targetTimeMs ? formatRaceTime(targetTimeMs) : 'Chưa đặt mục tiêu'}</p>
            )}
            {targetTimeMs && <p className="text-xs text-gray-500">Mục tiêu {formatRaceTime(targetTimeMs)}</p>}
          </div>
        </div>
        <Field label="Ghi chú lần chạy">
          <Textarea rows={2} value={notes} placeholder="Xuất phát chậm, đổi nhịp ở khúc cua…" onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <TrialVideoPicker onChange={setVideo} disabled={save.pending} />
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
                    <span className="font-mono font-semibold">{formatRaceTime(item.elapsedMs)}</span>
                    <span className="flex items-center gap-1 font-mono text-xs text-gray-500">
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
  const [notes, setNotes] = useState(trial.notes ?? '');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const save = useAction();
  const timeChanged = !!elapsed && elapsed !== trial.elapsedMs;
  const notesChanged = notes.trim() !== (trial.notes ?? '');
  const changed = timeChanged || notesChanged;

  const submit = () => {
    setTouched(true);
    if (!elapsed || !changed || !reason.trim()) return;
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
      description={`Đang ghi ${formatRaceTime(trial.elapsedMs)}. Nhật ký thao tác giữ số cũ và lý do.`}
      width="max-w-lg"
      dirty={changed || reason.trim() !== ''}
      onSave={submit}
      saveLabel="Lưu"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={save.pending} onClick={submit}>
            {save.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <ErrorBox message={save.error} />}
        <Field label="Thời gian" required error={touched && !elapsed ? 'Nhập phút và giây' : undefined} hint={targetTimeMs && elapsed ? `${formatDelta(elapsed - targetTimeMs)} so với mục tiêu ${formatRaceTime(targetTimeMs)}` : undefined}>
          <RaceTimeInput value={elapsed} invalid={touched && !elapsed} onChange={(ms) => setElapsed(ms)} autoFocus />
        </Field>
        <Field label="Ghi chú lần chạy">
          <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <Field label="Lý do sửa" required error={touched && !reason.trim() ? 'Nhập lý do sửa' : touched && !changed ? 'Chưa đổi thời gian hay ghi chú' : undefined}>
          <Input value={reason} maxLength={500} placeholder="Ví dụ: Bấm lại theo video" onChange={(event) => setReason(event.target.value)} />
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
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
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
            <p className="font-mono font-semibold">{data.avgHeartRateBpm}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-2.5 ring-1 ring-gray-100">
            <p className="text-xs text-gray-500">Cao nhất</p>
            <p className="font-mono font-semibold">{data.maxHeartRateBpm}</p>
          </div>
          <div className={cn('rounded-xl p-2.5 ring-1', data.criticalCount ? 'bg-red-50 ring-red-100' : 'bg-gray-50 ring-gray-100')}>
            <p className="text-xs text-gray-500">Giây vượt ngưỡng</p>
            <p className="font-mono font-semibold">{data.warningCount + data.criticalCount}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ===== Đánh giá sau buổi (HLV). Có `existing` là sửa đánh giá đã lưu (7 ngày sau buổi, lý do bắt buộc) ===== */

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
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const save = useAction();
  const editing = !!existing;
  const commentChanged = comment.trim() !== (existing?.comment ?? '');
  const changed = !existing || score !== existing.score || commentChanged;
  const saveEdit = () => {
    setTouched(true);
    if (!existing || !changed || !reason.trim()) return;
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
  const onSave = editing ? saveEdit : () => setConfirming(true);
  const summary = data.data?.summary;
  const trials = data.data?.trials ?? [];

  return (
    <Sheet
      open
      onClose={onClose}
      title={editing ? `Sửa đánh giá ${horseName}` : `Đánh giá ${horseName}`}
      description={sessionName}
      dirty={editing ? changed || reason.trim() !== '' : comment.trim() !== '' || score !== 7}
      onSave={onSave}
      saveLabel="Lưu"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {save.error && <ErrorBox message={save.error} />}
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
                    'h-10 rounded-xl font-mono text-sm font-semibold ring-1 transition',
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
                <p className="font-mono text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        <Field label="Nhận xét chuyên môn" hint="Chủ ngựa đọc được nhận xét này trong nhật ký buổi tập.">
          <Textarea rows={5} value={comment} placeholder="Xuất phát, nhịp chạy, sức bền cuối bài, điều cần chỉnh ở buổi sau…" onChange={(event) => setComment(event.target.value)} />
        </Field>
        {editing ? (
          <Field label="Lý do sửa" required error={touched && !reason.trim() ? 'Nhập lý do sửa' : touched && !changed ? 'Chưa đổi điểm hay nhận xét' : undefined}>
            <Input value={reason} maxLength={500} placeholder="Ví dụ: Chấm nhầm, xem lại video" onChange={(event) => setReason(event.target.value)} />
          </Field>
        ) : (
          <Notice tone="info">Sửa được trong 7 ngày sau buổi, cần ghi lý do. Chủ ngựa không nhận thông báo khi sửa.</Notice>
        )}
      </div>

      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title={`Lưu ${score} điểm cho ${horseName}?`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Quay lại
              </Button>
              <Button
                disabled={save.pending}
                onClick={() =>
                  void save.run(
                    () => createEvaluation(participant.id, { score, comment: comment.trim() || undefined }),
                    () => {
                      toast.push(`Đã lưu đánh giá ${score} điểm cho ${horseName}`, 'success');
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
          <p className="text-sm text-gray-600">Chủ ngựa đọc được điểm và nhận xét. Muốn đổi sau thì sửa kèm lý do trong 7 ngày.</p>
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
  return (
    <Modal
      open
      onClose={onClose}
      title={`Đổi Groom dắt ${horseName}`}
      description="Chỉ đổi cho buổi này, không đổi Groom phụ trách ngựa."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={save.pending || groomId === (participant.assignedGroomId ?? '')}
            onClick={() =>
              void save.run(
                () => assignParticipantGroom(participant.id, groomId || null),
                () => {
                  toast.push('Đã đổi Groom dắt ngựa', 'success');
                  onDone();
                },
              )
            }
          >
            Lưu
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

