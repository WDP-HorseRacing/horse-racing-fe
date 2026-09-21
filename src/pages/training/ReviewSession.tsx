import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Film, Save } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { getSession, listAwaitingReview, saveEvaluation } from '../../services/training.service';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  NotFound,
  PageHeader,
  Pill,
  SectionTitle,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { SessionPill } from '../../components/ui/status';
import {
  alertRuleLabel,
  completionLabel,
  earlyEndLabel,
  intensityLabel,
  surfaceLabel,
  workoutLabel,
} from '../../lib/labels';
import { formatDate, formatDuration, formatPercent } from '../../lib/format';
import { readVideoFile } from '../../lib/files';
import type { CompletionLevel } from '../../types/domain';

export function ReviewList() {
  const navigate = useNavigate();
  const { data, loading } = useService(() => listAwaitingReview(), []);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Buổi tập chờ đánh giá"
        description="Buổi tập chỉ chuyển sang Hoàn thành khi huấn luyện viên chấm điểm và viết nhận xét."
      />
      {loading && <Skeleton rows={3} />}
      {!loading && (data?.length ?? 0) === 0 && (
        <EmptyState title="Không có buổi nào chờ đánh giá" hint="Các buổi tập đã được chấm đầy đủ." />
      )}
      <div className="space-y-3">
        {data?.map((session) => (
          <button key={session.id} onClick={() => navigate(`/training/review/${session.id}`)} className="w-full text-left">
            <Card className="transition hover:border-emerald-100 hover:shadow-[0_8px_24px_rgba(5,96,69,0.08)]">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar src={session.horseAvatar} name={session.horseName} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                    {session.horseName}
                    <SessionPill status={session.status} />
                    {session.marks.map((mark) => (
                      <Pill key={mark} tone="amber">
                        {mark}
                      </Pill>
                    ))}
                    {session.overdue && (
                      <Pill tone="red">
                        <Clock size={11} /> Quá 48 giờ chưa đánh giá
                      </Pill>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatDate(session.sessionDate)} · {workoutLabel[session.workoutType]} {session.distanceM} m ×{' '}
                    {session.repetitions}
                  </p>
                </div>
                {session.volumeRatio !== undefined && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 tabular-nums">{formatPercent(session.volumeRatio)}</p>
                    <p className="text-xs text-gray-400">khối lượng</p>
                  </div>
                )}
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReviewSession() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useService(() => getSession(id), [id]);
  const action = useAction();
  const videoRef = useRef<HTMLInputElement>(null);
  const [videoError, setVideoError] = useState<string>();

  const [form, setForm] = useState({
    performanceScore: 7,
    completionLevel: 'MET' as CompletionLevel,
    ownerComment: '',
    internalNote: '',
    trialTimeSeconds: '',
    trialNotCompleted: false,
    videoSrc: '' as string | undefined,
  });

  useEffect(() => {
    if (!data) return;
    const ratio = data.summary?.volumeRatio ?? 0;
    setForm((current) => ({
      ...current,
      performanceScore: data.evaluation?.performanceScore ?? 7,
      completionLevel: data.evaluation?.completionLevel ?? (ratio >= 0.9 ? 'MET' : 'BELOW'),
      ownerComment: data.evaluation?.ownerComment ?? '',
      internalNote: data.evaluation?.internalNote ?? '',
      trialTimeSeconds:
        data.evaluation?.trialTimeSeconds?.toString() ?? data.summary?.suggestedTrialSeconds?.toFixed(2) ?? '',
      trialNotCompleted: data.evaluation?.trialNotCompleted ?? false,
      videoSrc: data.evaluation?.videoSrc,
    }));
  }, [data]);

  if (loading) return <Skeleton rows={6} />;
  if (error || !data) return <NotFound />;

  const plannedVolume = data.distanceM * data.repetitions;
  const isTrial = data.workoutType === 'TIME_TRIAL';
  const editable = data.status === 'AWAITING_REVIEW' || data.status === 'COMPLETED';

  const submit = async () => {
    const done = await action.run(() =>
      saveEvaluation(id, {
        performanceScore: Number(form.performanceScore),
        completionLevel: form.completionLevel,
        ownerComment: form.ownerComment,
        internalNote: form.internalNote,
        trialTimeSeconds: form.trialTimeSeconds ? Number(form.trialTimeSeconds) : undefined,
        trialNotCompleted: form.trialNotCompleted,
        videoSrc: form.videoSrc,
        videoThumbnail: form.videoSrc ? data.horseAvatar : undefined,
      }),
    );
    if (done !== undefined) {
      reload();
      navigate('/training/review');
    }
  };

  const fieldError = (field: string) => (action.field === field ? action.error : undefined);

  return (
    <div className="space-y-6 pb-8">
      <button
        onClick={() => navigate('/training/review')}
        className="flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-gray-600"
      >
        <ArrowLeft size={16} /> Danh sách chờ đánh giá
      </button>

      <PageHeader
        title={`Đánh giá buổi tập — ${data.horseName}`}
        description={`${formatDate(data.sessionDate)} · ${data.slotLabel} · ${workoutLabel[data.workoutType]}`}
      />

      <div className="flex flex-wrap gap-2">
        <SessionPill status={data.status} />
        {data.marks.map((mark) => (
          <Pill key={mark} tone="amber">
            {mark}
          </Pill>
        ))}
        {data.earlyEndReason && <Pill tone="amber">{earlyEndLabel[data.earlyEndReason]}</Pill>}
      </div>

      {/* Kế hoạch cạnh thực tế */}
      <Card>
        <SectionTitle>Kế hoạch đặt cạnh thực tế</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2 text-xs font-semibold text-gray-400">Chỉ tiêu</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-400">Kế hoạch</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-400">Thực tế</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2.5 text-gray-600">Khối lượng</td>
                <td className="px-3 py-2.5 font-medium text-gray-800 tabular-nums">
                  {plannedVolume.toLocaleString('vi-VN')} m
                </td>
                <td className="px-3 py-2.5 font-medium text-gray-800 tabular-nums">
                  {data.summary?.fastDistanceM.toLocaleString('vi-VN') ?? '—'} m —{' '}
                  <span className={(data.summary?.volumeRatio ?? 0) >= 0.9 ? 'text-emerald-600' : 'text-amber-600'}>
                    {formatPercent(data.summary?.volumeRatio ?? 0)}
                  </span>
                </td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2.5 text-gray-600">Bài tập</td>
                <td className="px-3 py-2.5 text-gray-800">
                  {workoutLabel[data.workoutType]} {data.distanceM} m × {data.repetitions}
                </td>
                <td className="px-3 py-2.5 text-gray-800">
                  {intensityLabel[data.intensity]} · {surfaceLabel[data.surface]}
                </td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2.5 text-gray-600">Nhịp tim (trung bình / cao nhất)</td>
                <td className="px-3 py-2.5 text-gray-400">ngưỡng {data.maxHeartRateUsed}</td>
                <td className="px-3 py-2.5 font-medium text-gray-800 tabular-nums">
                  {data.summary?.avgHeartRate ?? '—'} / {data.summary?.maxHeartRate ?? '—'}
                </td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2.5 text-gray-600">Tốc độ (trung bình / cao nhất)</td>
                <td className="px-3 py-2.5 text-gray-400">—</td>
                <td className="px-3 py-2.5 font-medium text-gray-800 tabular-nums">
                  {data.summary?.avgSpeedMps ?? '—'} / {data.summary?.maxSpeedMps ?? '—'} m/s
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 text-gray-600">Thời lượng</td>
                <td className="px-3 py-2.5 text-gray-400">—</td>
                <td className="px-3 py-2.5 font-medium text-gray-800 tabular-nums">
                  {data.summary ? formatDuration(data.summary.durationSec) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {data.alerts.length > 0 && (
          <div className="mt-4 space-y-1.5 rounded-xl bg-red-50 p-4">
            <p className="text-xs font-semibold text-red-600">Cảnh báo trong buổi</p>
            {data.alerts.map((alert) => (
              <p key={alert.id} className="text-sm text-red-700">
                {alertRuleLabel[alert.rule]} tại giây {alert.atSecond} ·{' '}
                {alert.acknowledgedByName
                  ? `${alert.acknowledgedByName} ${alert.ackAction === 'STOPPED' ? 'đã dừng ngựa' : 'tiếp tục theo dõi'}`
                  : 'chưa xác nhận'}
              </p>
            ))}
          </div>
        )}

        {data.earlyEndNote && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <span className="font-semibold">Lý do kết thúc sớm: </span>
            {data.earlyEndReason ? earlyEndLabel[data.earlyEndReason] : ''} — {data.earlyEndNote}
          </p>
        )}
      </Card>

      {/* Biểu mẫu đánh giá */}
      {editable && (
        <Card>
          <SectionTitle>Nội dung đánh giá</SectionTitle>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Điểm phong độ"
                required
                hint="Thang 1–10"
                error={fieldError('performanceScore')}
              >
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.performanceScore}
                  onChange={(event) => setForm({ ...form, performanceScore: Number(event.target.value) })}
                />
              </Field>
              <Field
                label="Mức hoàn thành"
                required
                hint="Điền sẵn theo tỉ lệ khối lượng, bạn sửa được"
                error={fieldError('completionLevel')}
              >
                <Select
                  value={form.completionLevel}
                  onChange={(event) => setForm({ ...form, completionLevel: event.target.value as CompletionLevel })}
                >
                  {Object.entries(completionLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {isTrial && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Thời gian chạy thử (giây)"
                  required={!form.trialNotCompleted}
                  hint="Điền sẵn từ gợi ý của hệ thống"
                  error={fieldError('trialTimeSeconds')}
                >
                  <Input
                    value={form.trialTimeSeconds}
                    disabled={form.trialNotCompleted}
                    onChange={(event) => setForm({ ...form, trialTimeSeconds: event.target.value })}
                  />
                </Field>
                <Field label="Ghi nhận khác">
                  <label className="flex h-11 cursor-pointer items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={form.trialNotCompleted}
                      onChange={(event) => setForm({ ...form, trialNotCompleted: event.target.checked })}
                      className="h-4 w-4 rounded accent-emerald-600"
                    />
                    Không hoàn thành cự ly
                  </label>
                </Field>
              </div>
            )}

            <Field
              label="Nhận xét chuyên môn"
              required
              hint="Tối thiểu 20 ký tự. Chủ ngựa đọc được nội dung này."
              error={fieldError('ownerComment')}
            >
              <Textarea
                value={form.ownerComment}
                onChange={(event) => setForm({ ...form, ownerComment: event.target.value })}
              />
            </Field>

            <Field label="Ghi chú nội bộ" hint="Chủ ngựa không thấy nội dung này">
              <Textarea
                value={form.internalNote}
                onChange={(event) => setForm({ ...form, internalNote: event.target.value })}
              />
            </Field>

            <div>
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
              <Button variant="secondary" size="sm" onClick={() => videoRef.current?.click()}>
                <Film size={14} /> {form.videoSrc ? 'Đổi video chạy thử' : 'Tải video chạy thử'}
              </Button>
              <p className="mt-1.5 text-xs font-light text-gray-400">
                MP4, MOV hoặc WebM, tối đa 40 MB. Video chỉ tồn tại trong phiên làm việc cho tới khi hệ thống lưu trữ
                được bật.
              </p>
              {videoError && <p className="mt-1 text-xs font-medium text-red-600">{videoError}</p>}
              {form.videoSrc && (
                <video src={form.videoSrc} controls className="mt-3 w-full max-w-md rounded-xl" />
              )}
            </div>

            {action.error && !action.field && <ErrorBox message={action.error} />}

            <div className="flex flex-wrap gap-3">
              <Button onClick={submit} disabled={action.pending}>
                <Save size={16} /> {action.pending ? 'Đang lưu…' : 'Lưu đánh giá'}
              </Button>
              {data.status === 'COMPLETED' && (
                <span className="self-center text-xs text-gray-400">
                  Chỉ sửa được trong 24 giờ kể từ lúc đánh giá lần đầu.
                </span>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
