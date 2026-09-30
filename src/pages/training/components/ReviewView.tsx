// Đánh giá từng ngựa sau buổi (F2.9): danh sách ngựa bên trái, bên phải là kế hoạch–thực tế và phiếu chấm.
import { useEffect, useRef, useState } from 'react';
import { AlertOctagon, Check, Film, Lock, Save, Timer, UserX } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Dot,
  Field,
  Input,
  Notice,
  Pill,
  SectionTitle,
  Textarea,
  ToggleChip,
  cn,
  useToast,
} from '../../../components/ui';
import { AttendancePill } from '../../../components/ui/status';
import { useAction } from '../../../hooks/useService';
import { scoreHorse, type SessionDetail, type SessionHorseRow } from '../../../services/session.service';
import { readVideoFile } from '../../../lib/files';
import { formatDateTime, formatDistance, formatDuration, formatPercent } from '../../../lib/format';
import GroomTaskChecklist from './GroomTaskChecklist';
import { secondText, speedText, trialText, workoutText } from './session-helpers';

export default function ReviewView({ detail, onChanged }: { detail: SessionDetail; onChanged: () => void }) {
  const firstPending =
    detail.horses.find((row) => row.status === 'PRESENT' && !row.evaluation && row.canScore) ??
    detail.horses.find((row) => row.status === 'PRESENT') ??
    detail.horses[0];
  const [selected, setSelected] = useState(firstPending?.horseId);
  const current = detail.horses.find((row) => row.horseId === selected) ?? firstPending;
  const present = detail.horses.filter((row) => row.status === 'PRESENT');
  const scored = present.filter((row) => row.evaluation);

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <aside className="space-y-3 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
        <Card className="p-5">
          <p className="text-sm text-gray-500">Đã chấm</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-gray-900">
            {scored.length}
            <span className="text-lg font-medium text-gray-400">/{present.length} ngựa có mặt</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {detail.header.status === 'COMPLETED'
              ? `Hoàn thành ${formatDateTime(detail.header.completedAt)}`
              : 'Buổi chuyển sang Hoàn thành khi mọi ngựa có mặt đã được chấm.'}
          </p>
        </Card>

        <div className="space-y-1.5">
          {detail.horses.map((row) => {
            const active = row.horseId === current?.horseId;
            return (
              <button
                key={row.horseId}
                type="button"
                onClick={() => setSelected(row.horseId)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left ring-1 transition',
                  active ? 'bg-gray-50 ring-gray-400' : 'ring-gray-200/80 hover:ring-gray-300',
                )}
              >
                <Avatar src={row.avatar} name={row.horseName} size={34} className={cn(row.status === 'ABSENT' && 'grayscale')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{row.horseName}</p>
                  <p className="truncate text-xs text-gray-500">
                    {row.status === 'ABSENT'
                      ? `Vắng — ${row.absenceLabel ?? ''}`
                      : row.evaluation
                        ? `Đã chấm ${row.evaluation.score}/10`
                        : 'Chưa chấm'}
                    {row.stopped ? ' · đã dừng giữa buổi' : ''}
                  </p>
                </div>
                {row.redAlertCount > 0 && (
                  <span
                    className={cn(
                      'flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-bold',
                      'bg-red-50 text-red-700',
                    )}
                    title="Cảnh báo đỏ trong buổi"
                  >
                    {row.redAlertCount}
                  </span>
                )}
                {row.status === 'PRESENT' &&
                  (row.evaluation ? (
                    <Check size={15} strokeWidth={2.5} className="shrink-0 text-emerald-600" aria-label="Đã chấm" />
                  ) : (
                    <Dot tone="warn" className="mr-1" />
                  ))}
              </button>
            );
          })}
          {detail.hiddenCount > 0 && (
            <p className="px-1 pt-1 text-xs text-gray-500">Bạn chỉ xem được ngựa của mình trong buổi này.</p>
          )}
        </div>
      </aside>

      <div className="lg:col-span-8">
        {current ? (
          current.status === 'ABSENT' ? (
            <Card tone="warning">
              <div className="flex items-start gap-3">
                <UserX size={20} className="mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <p className="font-semibold text-gray-900">{current.horseName} vắng buổi này</p>
                  <div className="mt-2">
                    <AttendancePill status="ABSENT" reason={current.absenceReason} />
                  </div>
                  {current.absenceNote && <p className="mt-2 text-sm text-gray-700">{current.absenceNote}</p>}
                  <p className="mt-2 text-xs text-gray-500">
                    Đánh dấu bởi {current.markedByName ?? 'Hệ thống'} · {formatDateTime(current.markedAt)}. Ngựa vắng không
                    có chỉ số và không cần chấm.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <HorseReview key={current.horseId} row={current} detail={detail} onChanged={onChanged} />
          )
        ) : (
          <Card variant="outline" tone="muted">
            <p className="text-sm text-gray-500">Buổi không có ngựa nào.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function HorseReview({ row, detail, onChanged }: { row: SessionHorseRow; detail: SessionDetail; onChanged: () => void }) {
  const { header } = detail;
  const summary = row.summary;
  const isTrial = header.workoutType === 'TIME_TRIAL';
  const alerts = detail.alerts.filter((alert) => alert.horseId === row.horseId);
  const ratio = summary?.volumeRatio ?? 0;

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar src={row.avatar} name={row.horseName} size={46} />
            <div>
              <p className="text-lg font-bold text-gray-900">{row.horseName}</p>
              <p className="text-sm text-gray-500">
                {workoutText(header)}
                {row.groomName ? ` · Groom ${row.groomName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {row.stopped && <Pill tone="red">Dừng ở giây {secondText(row.stopped.atSecond)}</Pill>}
            {row.scenarioLabel && row.scenarioLabel !== 'Bình thường' && <Pill tone="slate">Kịch bản: {row.scenarioLabel}</Pill>}
            <Pill tone="gray">
              <Lock size={11} /> Chỉ số đã chốt
            </Pill>
          </div>
        </div>

        <SectionTitle>Kế hoạch đặt cạnh thực tế</SectionTitle>
        {summary ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="py-2 pr-3 font-medium">Chỉ tiêu</th>
                  <th className="py-2 pr-3 font-medium">Kế hoạch</th>
                  <th className="py-2 font-medium">Thực tế</th>
                </tr>
              </thead>
              <tbody className="[&_td]:py-2.5 [&_td]:pr-3 [&_tr]:border-b [&_tr]:border-gray-100 [&_tr:last-child]:border-0">
                <tr>
                  <td className="text-gray-600">Khối lượng chạy nhanh</td>
                  <td className="tabular-nums text-gray-800">{formatDistance(detail.plannedVolumeM)}</td>
                  <td className="tabular-nums font-medium text-gray-900">
                    {formatDistance(summary.fastDistanceM)} ·{' '}
                    <span className={ratio >= 0.9 ? 'text-gray-900' : 'text-amber-700'}>{formatPercent(ratio)}</span>
                  </td>
                </tr>
                <tr>
                  <td className="text-gray-600">Tốc độ phần chính</td>
                  <td className="text-gray-500">Chạy nhanh ≥ {detail.fastThreshold} m/s</td>
                  <td className="tabular-nums font-medium text-gray-900">
                    {speedText(summary.mainAvgSpeedMps)} <span className="font-normal text-gray-500">· cao nhất {speedText(summary.maxSpeedMps)}</span>
                  </td>
                </tr>
                <tr>
                  <td className="text-gray-600">Nhịp tim TB / cao nhất</td>
                  <td className={row.maxHeartRate ? 'text-gray-500' : 'text-amber-700'}>
                    {row.maxHeartRate ? `Ngưỡng ${row.maxHeartRate}` : 'Chưa đặt ngưỡng — R1 không chạy'}
                  </td>
                  <td
                    className={cn(
                      'tabular-nums font-medium',
                      row.maxHeartRate && summary.maxHeartRate > row.maxHeartRate ? 'text-red-700' : 'text-gray-900',
                    )}
                  >
                    {summary.avgHeartRate} / {summary.maxHeartRate} nhịp/phút
                  </td>
                </tr>
                <tr>
                  <td className="text-gray-600">Tổng quãng đường · thời gian</td>
                  <td className="text-gray-500">{workoutText(header)}</td>
                  <td className="tabular-nums font-medium text-gray-900">
                    {formatDistance(summary.distanceM)} · {formatDuration(summary.durationSec)}
                  </td>
                </tr>
                {isTrial && (
                  <tr>
                    <td className="text-gray-600">Thời gian chạy thử (thiết bị)</td>
                    <td className="text-gray-500">{formatDistance(header.distanceM)}</td>
                    <td className="tabular-nums font-medium text-gray-900">{trialText(summary.suggestedTrialSeconds)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Không có chỉ số đã chốt.</p>
        )}

        {row.stopped?.reason && (
          <p className="mt-4 text-sm text-red-700">
            Dừng bởi {row.stopped.byName}: {row.stopped.reason}
          </p>
        )}

        {alerts.length > 0 && (
          <div className="mt-4 space-y-1.5 border-l-2 border-red-400 pl-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
              <AlertOctagon size={13} /> Cảnh báo của ngựa trong buổi
            </p>
            {alerts.map((alert) => (
              <p key={alert.id} className="text-sm text-gray-800">
                {alert.ruleLabel} ở giây {secondText(alert.atSecond)} — {alert.text}.{' '}
                <span className={alert.acknowledgedByName ? 'text-gray-500' : 'font-medium text-red-700'}>
                  {alert.acknowledgedByName
                    ? `${alert.acknowledgedByName} ${alert.ackAction === 'STOP_HORSE' ? 'đã dừng ngựa' : 'cho tiếp tục theo dõi'}`
                    : 'Chưa xác nhận'}
                </span>
              </p>
            ))}
          </div>
        )}

        {row.canDoTasks && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            <span className="text-xs text-gray-500">Việc của Groom</span>
            <GroomTaskChecklist sessionId={header.id} horseId={row.horseId} tasks={row.tasks} onChanged={onChanged} />
          </div>
        )}
      </Card>

      {row.canScore ? (
        <ScoreForm row={row} detail={detail} onChanged={onChanged} />
      ) : row.evaluation ? (
        <Card>
          <div className="flex flex-wrap items-start gap-5">
            <div className="rounded-xl px-4 py-3 text-center ring-1 ring-gray-200">
              <p className="text-4xl font-bold tabular-nums text-gray-900">{row.evaluation.score}</p>
              <p className="text-xs text-gray-500">/10 điểm</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800">Nhận xét của HT</p>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{row.evaluation.notes}</p>
              {isTrial && (
                <p className="mt-2 text-sm text-gray-600">
                  Thời gian chạy thử: <span className="font-semibold">{trialText(row.evaluation.trialTimeSeconds, row.evaluation.trialNotCompleted)}</span>
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                {row.evaluation.evaluatedByName} · {formatDateTime(row.evaluation.evaluatedAt)}
                {row.evaluation.editedAt ? ` · sửa lúc ${formatDateTime(row.evaluation.editedAt)}` : ''}
              </p>
            </div>
          </div>
          {row.evaluation.videoSrc && (
            <video src={row.evaluation.videoSrc} controls className="mt-4 w-full max-w-xl rounded-xl" />
          )}
        </Card>
      ) : (
        <Card variant="outline" tone="muted">
          <p className="text-sm text-gray-500">
            {detail.header.status === 'COMPLETED' ? 'Ngựa không được chấm.' : 'HT của khu chưa chấm ngựa này.'}
          </p>
        </Card>
      )}
    </div>
  );
}

function ScoreForm({ row, detail, onChanged }: { row: SessionHorseRow; detail: SessionDetail; onChanged: () => void }) {
  const action = useAction();
  const toast = useToast();
  const videoRef = useRef<HTMLInputElement>(null);
  const [videoError, setVideoError] = useState<string>();
  const isTrial = detail.header.workoutType === 'TIME_TRIAL';
  const [form, setForm] = useState({
    score: 0,
    notes: '',
    trial: '',
    notCompleted: false,
    videoSrc: undefined as string | undefined,
  });

  useEffect(() => {
    setForm({
      score: row.evaluation?.score ?? 0,
      notes: row.evaluation?.notes ?? '',
      trial:
        row.evaluation?.trialTimeSeconds?.toString() ??
        (row.summary?.suggestedTrialSeconds !== undefined ? row.summary.suggestedTrialSeconds.toFixed(2) : ''),
      notCompleted: row.evaluation?.trialNotCompleted ?? false,
      videoSrc: row.evaluation?.videoSrc,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.horseId]);

  const fieldError = (field: string) => (action.field === field ? action.error : undefined);

  const submit = async () => {
    const result = await action.run(() =>
      scoreHorse(detail.header.id, row.horseId, {
        score: form.score,
        notes: form.notes,
        trialTimeSeconds: isTrial && !form.notCompleted && form.trial ? Number(form.trial.replace(',', '.')) : undefined,
        trialNotCompleted: isTrial ? form.notCompleted : undefined,
        videoSrc: form.videoSrc,
        videoThumbnail: form.videoSrc ? row.avatar : undefined,
      }),
    );
    if (result === undefined) return;
    toast.push(
      result.completed
        ? 'Đã chấm đủ mọi ngựa — buổi chuyển sang Hoàn thành'
        : `Đã lưu đánh giá ${row.horseName}${result.remaining > 0 ? ` · còn ${result.remaining} ngựa chưa chấm` : ''}`,
      'success',
    );
    onChanged();
  };

  return (
    <Card>
      <SectionTitle
        action={
          row.scoreEditableUntil ? (
            <span className="text-xs text-gray-500">Sửa được tới {formatDateTime(row.scoreEditableUntil)}</span>
          ) : undefined
        }
      >
        {row.evaluation ? 'Sửa đánh giá' : 'Chấm điểm'} {row.horseName}
      </SectionTitle>
      <div className="space-y-5">
        <Field label="Điểm" required error={fieldError('score')} hint="1 là rất kém, 10 là xuất sắc">
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm({ ...form, score: value })}
                className={cn(
                  'h-10 w-10 rounded-lg text-sm font-semibold tabular-nums ring-1 transition',
                  form.score === value
                    ? 'bg-emerald-700 text-white ring-emerald-700'
                    : 'bg-white text-gray-700 ring-gray-200 hover:ring-gray-400',
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Nhận xét"
          required
          hint="Tối thiểu 10 ký tự. Chủ ngựa đọc được nhận xét này."
          error={fieldError('notes')}
        >
          <Textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Ví dụ: vào bài đều, hồi phục tốt sau lần chạy thứ hai; giữ khối lượng cho tuần tới."
          />
        </Field>

        {isTrial && (
          <div className="grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field
              label="Thời gian chạy thử (giây)"
              required={!form.notCompleted}
              hint={
                row.summary?.suggestedTrialSeconds !== undefined
                  ? `Gợi ý từ thiết bị: ${trialText(row.summary.suggestedTrialSeconds)}`
                  : 'Thiết bị không ghi nhận được thời gian'
              }
              error={fieldError('trialTimeSeconds')}
            >
              <div className="relative">
                <Timer size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-9"
                  inputMode="decimal"
                  value={form.trial}
                  disabled={form.notCompleted}
                  onChange={(event) => setForm({ ...form, trial: event.target.value })}
                />
              </div>
            </Field>
            <ToggleChip checked={form.notCompleted} onChange={(value) => setForm({ ...form, notCompleted: value })}>
              Không hoàn thành cự ly
            </ToggleChip>

            <div className="sm:col-span-2">
              <input
                ref={videoRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  setVideoError(undefined);
                  try {
                    const src = await readVideoFile(file);
                    setForm((current) => ({ ...current, videoSrc: src }));
                  } catch (caught) {
                    setVideoError(caught instanceof Error ? caught.message : 'Không đọc được tệp video');
                  }
                }}
              />
              <Button size="sm" variant="secondary" onClick={() => videoRef.current?.click()}>
                <Film size={14} /> {form.videoSrc ? 'Đổi video chạy thử' : 'Tải video chạy thử'}
              </Button>
              <p className="mt-1.5 text-xs text-gray-500">MP4, MOV hoặc WebM, tối đa 40 MB.</p>
              {videoError && <p className="mt-1 text-xs font-medium text-red-600">{videoError}</p>}
              {form.videoSrc && <video src={form.videoSrc} controls className="mt-3 w-full max-w-md rounded-xl" />}
            </div>
          </div>
        )}

        {action.error && !['score', 'notes', 'trialTimeSeconds'].includes(action.field ?? '') && (
          <Notice tone="danger">{action.error}</Notice>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={action.pending}>
            <Save size={15} /> {action.pending ? 'Đang lưu…' : row.evaluation ? 'Lưu thay đổi' : 'Lưu đánh giá'}
          </Button>
          {detail.header.status === 'COMPLETED' && (
            <span className="text-xs text-gray-500">Chỉ sửa được trong 24 giờ kể từ lúc chấm lần đầu.</span>
          )}
        </div>
      </div>
    </Card>
  );
}
