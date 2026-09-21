import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Camera, Play, Square, XCircle } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  endSession,
  getLiveSession,
  listTodaySessions,
  reportNotPerformed,
  startSession,
  type SessionRow,
} from '../../services/training.service';
import { useStore } from '../../store/store';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Pill,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { SessionPill } from '../../components/ui/status';
import { earlyEndLabel, intensityLabel, scenarioLabel, surfaceLabel, workoutLabel } from '../../lib/labels';
import { formatPercent, formatTime } from '../../lib/format';
import { now } from '../../lib/clock';
import type { EarlyEndReason, SimScenario } from '../../types/domain';

/** Bây giờ có nằm ngoài khung giờ của buổi tập không. */
function outsideSlot(slotLabel: string): boolean {
  const [start, end] = slotLabel.split('–');
  if (!start || !end) return false;
  const current = formatTime(now());
  return current < start || current > end;
}

const NOT_PERFORMED_REASONS = [
  'Ngựa có dấu hiệu bất thường',
  'Thời tiết',
  'Sân không sử dụng được',
  'Nhân sự',
  'Khác',
];

export default function TodaySessions() {
  const navigate = useNavigate();
  const role = useStore((state) => state.currentUser?.role);
  const { data, loading, reload } = useService(() => listTodaySessions(), []);
  const action = useAction();

  const [startTarget, setStartTarget] = useState<SessionRow | null>(null);
  const [scenario, setScenario] = useState<SimScenario>('NORMAL');
  const [endTarget, setEndTarget] = useState<SessionRow | null>(null);
  const [reportTarget, setReportTarget] = useState<SessionRow | null>(null);
  const [reportForm, setReportForm] = useState({ reason: NOT_PERFORMED_REASONS[0], note: '' });

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Buổi tập hôm nay"
        description={
          role === 'GROOM'
            ? 'Các buổi tập được phân công cho bạn trong ngày, xếp theo khung giờ.'
            : 'Toàn bộ buổi tập trong ngày của khu bạn phụ trách.'
        }
      />

      {action.error && <ErrorBox message={action.error} />}
      {loading && <Skeleton rows={3} />}
      {!loading && (data?.length ?? 0) === 0 && (
        <EmptyState title="Hôm nay không có buổi tập nào" hint="Lịch tập của ngày khác xem ở mục Lịch tập." />
      )}

      <div className="space-y-4">
        {data?.map((session) => (
          <Card key={session.id} tone={session.status === 'IN_PROGRESS' ? 'success' : 'default'}>
            <div className="flex flex-wrap items-start gap-4">
              <Avatar src={session.horseAvatar} name={session.horseName} size={52} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-gray-400">{session.slotLabel}</span>
                  <span className="text-lg font-bold text-gray-900">{session.horseName}</span>
                  <SessionPill status={session.status} />
                  {session.derivedLabel && <Pill tone="gray">{session.derivedLabel}</Pill>}
                  {session.marks.map((mark) => (
                    <Pill key={mark} tone="amber">
                      {mark}
                    </Pill>
                  ))}
                </div>
                <p className="mt-1.5 text-sm text-gray-700">
                  {workoutLabel[session.workoutType]} · {session.distanceM} m × {session.repetitions} ·{' '}
                  {intensityLabel[session.intensity]} · mặt sân {surfaceLabel[session.surface].toLowerCase()}
                </p>
                {session.groomName && (
                  <p className="mt-0.5 text-xs text-gray-400">Nhân viên chăm sóc: {session.groomName}</p>
                )}
                {session.trainerNote && (
                  <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    <span className="font-semibold">Ghi chú của huấn luyện viên: </span>
                    {session.trainerNote}
                  </p>
                )}
                {session.cancelReason && (
                  <p className="mt-2 text-sm text-red-600">{session.cancelReason}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {session.status === 'SCHEDULED' && session.canOperate && (
                  <>
                    <Button
                      onClick={() => {
                        setStartTarget(session);
                        setScenario('NORMAL');
                      }}
                    >
                      <Play size={15} /> Bắt đầu
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setReportTarget(session);
                        setReportForm({ reason: NOT_PERFORMED_REASONS[0], note: '' });
                      }}
                    >
                      <XCircle size={15} /> Không thực hiện được
                    </Button>
                  </>
                )}
                {session.status === 'IN_PROGRESS' && (
                  <>
                    {session.canOperate && (
                      <Button variant="danger" onClick={() => setEndTarget(session)}>
                        <Square size={15} /> Kết thúc
                      </Button>
                    )}
                    {role !== 'GROOM' && (
                      <Button variant="secondary" onClick={() => navigate(`/training/live/${session.id}`)}>
                        Theo dõi trực tiếp
                      </Button>
                    )}
                  </>
                )}
                {session.status === 'AWAITING_REVIEW' && role !== 'GROOM' && (
                  <Button variant="secondary" onClick={() => navigate(`/training/review/${session.id}`)}>
                    Đánh giá
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Bắt đầu buổi tập */}
      <Modal
        open={startTarget !== null}
        onClose={() => setStartTarget(null)}
        title={`Bắt đầu buổi tập — ${startTarget?.horseName}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStartTarget(null)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() => startSession(startTarget!.id, scenario));
                if (done !== undefined) {
                  setStartTarget(null);
                  reload();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang bắt đầu…' : 'Bắt đầu'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Hệ thống kiểm tra lại điều kiện được tập ngay lúc bấm.
          </p>
          {startTarget && outsideSlot(startTarget.slotLabel) && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Bây giờ là {formatTime(now())}, ngoài khung giờ {startTarget.slotLabel} của buổi tập. Bạn vẫn bắt đầu
              được, hệ thống chỉ ghi nhận.
            </div>
          )}
          <Field
            label="Nguồn dữ liệu thiết bị đeo"
            hint="Thiết bị đeo thật chưa được gắn vào hệ thống. Trong lúc đó buổi tập nhận dữ liệu từ bộ mô phỏng."
          >
            <Select value={scenario} onChange={(event) => setScenario(event.target.value as SimScenario)}>
              {Object.entries(scenarioLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {action.error && <ErrorBox message={action.error} />}
        </div>
      </Modal>

      {/* Kết thúc buổi tập */}
      {endTarget && (
        <EndSessionDialog
          session={endTarget}
          onClose={() => setEndTarget(null)}
          onDone={() => {
            setEndTarget(null);
            reload();
          }}
        />
      )}

      {/* Báo không thực hiện được */}
      <Modal
        open={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        title="Báo buổi tập không thực hiện được"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportTarget(null)}>
              Quay lại
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const done = await action.run(() =>
                  reportNotPerformed(reportTarget!.id, reportForm.reason, reportForm.note),
                );
                if (done !== undefined) {
                  setReportTarget(null);
                  reload();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang gửi…' : 'Gửi báo cáo'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Buổi tập chuyển sang Đã hủy ngay, nhóm lý do &ldquo;Không thực hiện được&rdquo;, không cần huấn luyện viên
            duyệt.
          </p>
          <Field label="Lý do" required>
            <Select value={reportForm.reason} onChange={(event) => setReportForm({ ...reportForm, reason: event.target.value })}>
              {NOT_PERFORMED_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Mô tả thêm"
            required={reportForm.reason === 'Ngựa có dấu hiệu bất thường' || reportForm.reason === 'Khác'}
            error={action.field === 'note' ? action.error : undefined}
          >
            <Textarea value={reportForm.note} onChange={(event) => setReportForm({ ...reportForm, note: event.target.value })} />
          </Field>
          {reportForm.reason === 'Ngựa có dấu hiệu bất thường' && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Bác sĩ thú y sẽ nhận thông báo khẩn. Bạn cũng nên gửi kèm báo cáo sự cố có ảnh.
            </div>
          )}
          {action.error && !action.field && <ErrorBox message={action.error} />}
        </div>
      </Modal>
    </div>
  );
}

/**
 * Hộp xác nhận kết thúc. Dữ liệu vẫn chảy trong lúc hộp mở và con số cập nhật mỗi giây —
 * chỉ phần số được vẽ lại, không vẽ lại cả hộp, để không làm mất cú bấm của người dùng.
 */
function EndSessionDialog({
  session,
  onClose,
  onDone,
}: {
  session: SessionRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const action = useAction();
  const [ratio, setRatio] = useState(0);
  const [reason, setReason] = useState<EarlyEndReason | ''>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let active = true;
    const tick = () => {
      getLiveSession(session.id)
        .then((live) => {
          if (active) setRatio(live.metrics.volumeRatio);
        })
        .catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [session.id]);

  const needsReason = ratio < 0.9;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Kết thúc buổi tập — ${session.horseName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Tiếp tục tập
          </Button>
          <Button
            variant="danger"
            disabled={action.pending || (needsReason && !reason)}
            onClick={async () => {
              const done = await action.run(() =>
                endSession(session.id, reason || undefined, note || undefined),
              );
              if (done !== undefined) onDone();
            }}
          >
            {action.pending ? 'Đang chốt số liệu…' : 'Kết thúc buổi tập'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-5 text-center">
          <p className="text-xs text-gray-400">Tỉ lệ khối lượng đã hoàn thành</p>
          <p className={`mt-1 text-4xl font-bold tabular-nums ${needsReason ? 'text-amber-600' : 'text-emerald-600'}`}>
            {formatPercent(ratio)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Số liệu vẫn đang chạy — ngựa chỉ dừng khi bạn bấm &ldquo;Kết thúc buổi tập&rdquo;
          </p>
        </div>

        {needsReason && (
          <>
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Khối lượng dưới 90%. Buổi tập sẽ mang nhãn &ldquo;Kết thúc sớm&rdquo; và bạn phải chọn lý do.
            </div>
            <Field label="Lý do kết thúc sớm" required>
              <Select value={reason} onChange={(event) => setReason(event.target.value as EarlyEndReason)}>
                <option value="">Chọn lý do</option>
                {Object.entries(earlyEndLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ghi rõ thêm" required={reason === 'OTHER'}>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            {reason === 'HORSE_UNWELL' && (
              <button
                onClick={() => navigate(`/care/incidents/new?horseId=${session.horseId}`)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <Camera size={15} /> Tạo báo cáo sự cố cho {session.horseName}
              </button>
            )}
          </>
        )}

        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}
