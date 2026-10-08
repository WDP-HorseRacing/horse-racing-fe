// Hộp thoại của Sân tập: ghi thời gian chạy thử (bấm giờ hoặc gõ tay), hoàn thành lượt, đánh giá sau buổi, đổi Groom dắt.
import { useEffect, useRef, useState } from 'react';
import { Flag, Pause, Play } from 'lucide-react';
import { assignParticipantGroom, completeParticipant, createEvaluation, listTrialResults, recordTrialResult } from '../../../api/training';
import { getParticipantSummary } from '../../../api/performance';
import type { GroomWorkload, Participant, TrialResult } from '../../../api/types';
import { Button, ErrorBox, Field, Modal, Notice, Select, Sheet, Skeleton, Textarea, cn, useToast } from '../../../components/ui';
import { useAction, useService } from '../../../hooks/useService';
import { formatDelta, formatRaceTime, formatSpeed } from '../../../lib/training-format';
import { RaceTimeInput } from '../components/RaceTimeInput';
import { ScoreHorseshoe } from '../components/motion';

/* ===== Bấm giờ ===== */

function Stopwatch({ onStop }: { onStop: (ms: number) => void }) {
  const [running, setRunning] = useState(false);
  const started = useRef(0);
  const display = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const loop = () => {
    if (display.current) display.current.textContent = formatRaceTime(performance.now() - started.current);
    frame.current = requestAnimationFrame(loop);
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-white">
      <span ref={display} className="min-w-28 font-mono text-3xl font-bold tabular-nums">
        0.00
      </span>
      {running ? (
        <button
          type="button"
          onClick={() => {
            cancelAnimationFrame(frame.current);
            setRunning(false);
            onStop(Math.round(performance.now() - started.current));
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold hover:bg-red-400"
        >
          <Pause size={15} /> Dừng
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            started.current = performance.now();
            setRunning(true);
            frame.current = requestAnimationFrame(loop);
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold hover:bg-emerald-400"
        >
          <Play size={15} /> Bấm giờ
        </button>
      )}
    </div>
  );
}

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
        if (!skipRecord && elapsed) await recordTrialResult(participant.id, { attemptNo: nextAttempt, elapsedMs: elapsed, notes: notes.trim() || undefined });
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
      description={completeAfter ? 'Ghi thời gian trước khi hoàn thành. Buổi tự đóng khi lượt cuối xong, sau đó không ghi thêm được.' : undefined}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          {canSkipRecord && (
            <Button variant="secondary" disabled={save.pending} onClick={() => submit(true)}>
              Hoàn thành, không ghi thêm
            </Button>
          )}
          <Button disabled={save.pending} onClick={() => submit(false)}>
            <Flag size={15} /> {save.pending ? 'Đang lưu…' : completeAfter ? `Ghi lần ${nextAttempt} và hoàn thành` : `Ghi lần chạy ${nextAttempt}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <ErrorBox message={save.error} />}
        <Stopwatch onStop={(ms) => setElapsed(ms)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Thời gian lần ${nextAttempt}`} required error={touched && !elapsed ? 'Bấm giờ hoặc gõ thời gian, ví dụ 1:16.20' : undefined} hint="Phút:giây.phần trăm giây">
            <RaceTimeInput key={elapsed} value={elapsed} onChange={(ms) => setElapsed(ms)} autoFocus />
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
                    <span className="font-mono text-xs text-gray-500">{targetTimeMs ? formatDelta(item.elapsedMs - targetTimeMs) : ''}</span>
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
      title={`Hoàn thành lượt của ${horseName}`}
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
            {save.pending ? 'Đang lưu…' : 'Hoàn thành lượt'}
          </Button>
        </>
      }
    >
      {save.error && <ErrorBox message={save.error} />}
      <p className="text-sm text-gray-600">Kết thúc bài tập của {horseName}. Cảm biến ngừng nhận số đo cho lượt này.</p>
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
            <p className="text-xs text-gray-500">Cảnh báo</p>
            <p className="font-mono font-semibold">{data.warningCount + data.criticalCount}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ===== Đánh giá sau buổi (HLV, lưu một lần) ===== */

export function EvaluationSheet({
  participant,
  horseName,
  sessionName,
  onClose,
  onDone,
}: {
  participant: Participant;
  horseName: string;
  sessionName: string;
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
  const [score, setScore] = useState(7);
  const [comment, setComment] = useState('');
  const [confirming, setConfirming] = useState(false);
  const save = useAction();
  const summary = data.data?.summary;
  const trials = data.data?.trials ?? [];

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Đánh giá ${horseName}`}
      description={sessionName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => setConfirming(true)} disabled={save.pending}>
            Lưu đánh giá
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
              { label: 'Số lần cảnh báo', value: summary ? summary.warningCount + summary.criticalCount : '—', tone: summary?.criticalCount ? 'red' : undefined },
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
        <Notice tone="warning">Đánh giá lưu một lần, chưa sửa được sau khi lưu.</Notice>
      </div>

      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="Lưu đánh giá"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Xem lại
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
                {save.pending ? 'Đang lưu…' : 'Lưu, không sửa nữa'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            Lưu điểm <b>{score}</b> cho {horseName}. Sau khi lưu không sửa được điểm và nhận xét.
          </p>
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
      title={`Groom dắt ${horseName} buổi này`}
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

