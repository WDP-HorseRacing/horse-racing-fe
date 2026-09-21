import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowLeft, HeartPulse, Radio, Square, WifiOff } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { acknowledgeAlert, getLiveSession, listLiveSessions, stopSession } from '../../services/training.service';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Modal,
  PageHeader,
  Pill,
  SectionTitle,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { SessionPill } from '../../components/ui/status';
import { LineChart, chartColors } from '../../components/charts/LineChart';
import { phaseLabel } from '../../lib/simulator';
import { alertRuleLabel, intensityLabel, scenarioLabel, surfaceLabel, workoutLabel } from '../../lib/labels';
import { formatDuration, formatPercent } from '../../lib/format';

export function LiveList() {
  const { data, loading } = useService(() => listLiveSessions(), []);
  const navigate = useNavigate();

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Theo dõi trực tiếp"
        description="Mỗi buổi tập có đúng một luồng dữ liệu; ai mở lúc nào cũng thấy cùng số liệu và đủ phần lịch sử đã qua."
      />
      {loading && <Skeleton rows={2} />}
      {!loading && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="Hiện không có buổi tập nào đang diễn ra"
          hint="Khi một buổi tập được bấm Bắt đầu, buổi đó sẽ xuất hiện ở đây."
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {data?.map((session) => (
          <button key={session.id} onClick={() => navigate(`/training/live/${session.id}`)} className="text-left">
            <Card tone="success" className="transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(5,96,69,0.12)]">
              <div className="flex items-center gap-4">
                <Avatar src={session.horseAvatar} name={session.horseName} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold text-gray-900">{session.horseName}</p>
                  <p className="text-sm text-gray-500">
                    {workoutLabel[session.workoutType]} {session.distanceM} m × {session.repetitions}
                  </p>
                </div>
                <SessionPill status={session.status} />
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LiveSession() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const action = useAction();
  const [tick, setTick] = useState(0);
  const [stopOpen, setStopOpen] = useState(false);
  const [stopReason, setStopReason] = useState('');

  const { data, loading, error } = useService(() => getLiveSession(id), [id, tick]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading && !data) return <Skeleton rows={6} />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu buổi tập'} />;

  const unacknowledged = data.alerts.filter((alert) => alert.level === 'RED' && !alert.acknowledgedByName);
  const heartSeries = data.samples.map((sample) => ({ x: sample.t, y: sample.heartRate }));
  const speedSeries = data.samples.map((sample) => ({ x: sample.t, y: sample.speedMps }));

  return (
    <div className="space-y-6 pb-8">
      <button
        onClick={() => navigate('/training/live')}
        className="flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-gray-600"
      >
        <ArrowLeft size={16} /> Danh sách buổi đang diễn ra
      </button>

      <PageHeader
        title={data.horseName}
        description={`${workoutLabel[data.session.workoutType]} ${data.session.distanceM} m × ${data.session.repetitions} · ${intensityLabel[data.session.intensity]} · mặt sân ${surfaceLabel[data.session.surface].toLowerCase()}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="blue" pulse>
              Thiết bị mô phỏng{data.scenario ? ` · ${scenarioLabel[data.scenario]}` : ''}
            </Pill>
            {data.canStop && data.session.status === 'IN_PROGRESS' && (
              <Button variant="danger" onClick={() => setStopOpen(true)}>
                <Square size={15} /> Dừng buổi tập
              </Button>
            )}
          </div>
        }
      />

      {data.session.status !== 'IN_PROGRESS' && (
        <Card tone="warning">
          <p className="text-sm text-gray-700">
            Buổi tập đã kết thúc. Bạn đang xem lại số liệu đã chốt.{' '}
            <Link to={`/training/review/${id}`} className="font-semibold text-emerald-700 hover:underline">
              Mở màn hình đánh giá
            </Link>
          </p>
        </Card>
      )}

      {unacknowledged.length > 0 && (
        <Card tone="danger">
          <div className="space-y-3">
            {unacknowledged.map((alert) => (
              <div key={alert.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
                  <div>
                    <p className="font-semibold text-red-700">{alertRuleLabel[alert.rule]}</p>
                    <p className="text-sm text-gray-600">
                      Tại giây {alert.atSecond} · giá trị {alert.value.toFixed(1)}
                      {alert.rule === 'R1' ? ` nhịp/phút (ngưỡng ${data.maxHeartRate})` : ''}
                    </p>
                  </div>
                </div>
                {data.canAck && (
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={async () => {
                        await action.run(() => acknowledgeAlert(alert.id, 'STOPPED'));
                        await action.run(() => stopSession(id, alertRuleLabel[alert.rule]));
                        setTick((value) => value + 1);
                      }}
                    >
                      Đã dừng ngựa
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        await action.run(() => acknowledgeAlert(alert.id, 'CONTINUE'));
                        setTick((value) => value + 1);
                      }}
                    >
                      Tiếp tục theo dõi
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {action.error && <ErrorBox message={action.error} />}

      {/* Số lớn */}
      <div className="grid gap-5 sm:grid-cols-3">
        <Card tone={data.current && data.current.heartRate > data.maxHeartRate ? 'danger' : 'default'}>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <HeartPulse size={14} /> Nhịp tim
          </div>
          <p
            className={`mt-2 text-5xl font-bold tabular-nums ${
              data.current && data.current.heartRate > data.maxHeartRate ? 'text-red-600' : 'text-gray-900'
            }`}
          >
            {data.signalLost ? '—' : (data.current?.heartRate ?? 0)}
          </p>
          <p className="mt-1 text-xs text-gray-400">nhịp/phút · ngưỡng tối đa {data.maxHeartRate}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Activity size={14} /> Tốc độ
          </div>
          <p className="mt-2 text-5xl font-bold text-gray-900 tabular-nums">
            {data.signalLost ? '—' : (data.current?.speedMps ?? 0).toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-gray-400">m/s · ngưỡng chạy nhanh {data.fastThresholdMps} m/s</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Radio size={14} /> Pha hiện tại
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {data.signalLost ? 'Mất tín hiệu' : data.current ? phaseLabel[data.current.phase] : '—'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {data.current?.phase === 'RUN' ? `Lần chạy ${data.current.runIndex}/${data.session.repetitions} · ` : ''}
            đã chạy {formatDuration(data.second)}
          </p>
          {data.signalLost && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
              <WifiOff size={13} /> Thiết bị chưa gửi dữ liệu
            </p>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle icon={<HeartPulse size={16} className="text-red-500" />}>Nhịp tim theo giây</SectionTitle>
        <LineChart
          series={[{ key: 'hr', label: 'Nhịp tim', color: chartColors.red, points: heartSeries }]}
          threshold={{ value: data.maxHeartRate, label: `Nhịp tim tối đa ${data.maxHeartRate}` }}
          formatX={(value) => formatDuration(value)}
          yLabel="Đơn vị: nhịp/phút"
        />
      </Card>

      <Card>
        <SectionTitle icon={<Activity size={16} className="text-emerald-600" />}>Tốc độ theo giây</SectionTitle>
        <LineChart
          series={[{ key: 'speed', label: 'Tốc độ', color: chartColors.emerald, points: speedSeries }]}
          threshold={{ value: data.fastThresholdMps, label: `Ngưỡng chạy nhanh ${data.fastThresholdMps} m/s` }}
          formatX={(value) => formatDuration(value)}
          yLabel="Đơn vị: m/s"
        />
      </Card>

      <div className="grid gap-5 md:grid-cols-5">
        <Card className="md:col-span-3">
          <SectionTitle>Chỉ số tổng hợp</SectionTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { label: 'Nhịp tim trung bình', value: data.metrics.avgHeartRate },
              { label: 'Nhịp tim cao nhất', value: data.metrics.maxHeartRate },
              { label: 'Tốc độ trung bình', value: `${data.metrics.avgSpeedMps} m/s` },
              { label: 'Tốc độ cao nhất', value: `${data.metrics.maxSpeedMps} m/s` },
              { label: 'Quãng đường', value: `${data.metrics.distanceM.toLocaleString('vi-VN')} m` },
              { label: 'Quãng đường chạy nhanh', value: `${data.metrics.fastDistanceM.toLocaleString('vi-VN')} m` },
              { label: 'Tỉ lệ khối lượng', value: formatPercent(data.metrics.volumeRatio) },
              { label: 'Thời lượng', value: formatDuration(data.metrics.durationSec) },
              { label: 'Số cảnh báo đỏ', value: data.alerts.filter((alert) => alert.level === 'RED').length },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-400">{item.label}</p>
                <p className="mt-0.5 text-lg font-bold text-gray-900 tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="md:col-span-2">
          <SectionTitle>Cảnh báo trong buổi</SectionTitle>
          {data.alerts.length === 0 ? (
            <p className="py-6 text-center text-sm font-light text-gray-400">Chưa có cảnh báo nào.</p>
          ) : (
            <div className="space-y-2">
              {data.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-xl p-3 ${alert.level === 'RED' ? 'bg-red-50' : 'bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${alert.level === 'RED' ? 'text-red-700' : 'text-gray-600'}`}>
                      {alertRuleLabel[alert.rule]}
                    </p>
                    <Pill tone={alert.level === 'RED' ? 'red' : 'gray'}>{alert.rule}</Pill>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Giây {alert.atSecond} · {alert.value.toFixed(1)}
                  </p>
                  {alert.acknowledgedByName && (
                    <p className="mt-1 text-xs text-gray-400">
                      {alert.acknowledgedByName} ·{' '}
                      {alert.ackAction === 'STOPPED' ? 'đã dừng ngựa' : 'tiếp tục theo dõi'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={stopOpen}
        onClose={() => setStopOpen(false)}
        title="Dừng khẩn buổi tập"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStopOpen(false)}>
              Quay lại
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const done = await action.run(() => stopSession(id, stopReason));
                if (done !== undefined) {
                  setStopOpen(false);
                  setTick((value) => value + 1);
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang dừng…' : 'Dừng buổi tập'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Dữ liệu dừng ngay, chỉ số được chốt và buổi chuyển sang Chờ đánh giá với nhãn &ldquo;Dừng khẩn&rdquo;.
            Thao tác không hoàn tác được.
          </p>
          <Textarea
            value={stopReason}
            onChange={(event) => setStopReason(event.target.value)}
            placeholder="Lý do dừng buổi tập"
          />
        </div>
      </Modal>
    </div>
  );
}
