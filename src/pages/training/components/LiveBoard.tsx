// Bảng theo dõi trực tiếp một buổi: lưới ô ngựa, biểu đồ của ngựa đang chọn, cảnh báo đỏ chờ xác nhận.
// Dữ liệu tính lại bằng bộ mô phỏng mỗi giây (thuần) — mở ở đâu, lúc nào cũng cùng số liệu.
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  HeartPulse,
  Octagon,
  Timer,
  UserX,
  WifiOff,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  ErrorBox,
  Pill,
  SectionTitle,
  Skeleton,
  cn,
  useToast,
} from '../../../components/ui';
import { LineChart, chartColors } from '../../../components/charts/LineChart';
import { useAction, useService } from '../../../hooks/useService';
import {
  acknowledgeAlert,
  getLiveSession,
  stopHorse,
  type AlertView,
  type LiveHorse,
} from '../../../services/session.service';
import { formatDistance, formatPercent, formatTime } from '../../../lib/format';
import ReasonModal from './ReasonModal';
import { secondText, speedText } from './session-helpers';

export default function LiveBoard({ sessionId, onEnded }: { sessionId: string; onEnded: () => void }) {
  const { data, error, reload } = useService(() => getLiveSession(sessionId), [sessionId]);
  const [selected, setSelected] = useState<string>();
  const [stopFor, setStopFor] = useState<LiveHorse | null>(null);
  const ack = useAction();
  const toast = useToast();

  useEffect(() => {
    const timer = window.setInterval(reload, 1000);
    return () => window.clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    if (data && data.status !== 'IN_PROGRESS') onEnded();
  }, [data, onEnded]);

  const horses = useMemo(() => data?.horses ?? [], [data]);
  const current = horses.find((horse) => horse.horseId === selected) ?? horses.find((horse) => horse.unackedRed > 0) ?? horses[0];

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Skeleton rows={5} />;

  const acknowledge = async (alert: AlertView, action: 'STOP_HORSE' | 'CONTINUE') => {
    const done = await ack.run(() => acknowledgeAlert(alert.id, action));
    if (done === undefined) return;
    toast.push(
      action === 'STOP_HORSE' ? `Đã ghi nhận dừng ${alert.horseName}` : `Tiếp tục theo dõi ${alert.horseName}`,
      'success',
    );
    reload();
  };

  return (
    <div className="space-y-5">
      {/* Cảnh báo đỏ chờ xác nhận */}
      {data.unackedRed.length > 0 && (
        <div className="space-y-2.5">
          {data.unackedRed.map((alert) => (
            <div
              key={alert.id}
              className="anim-pop flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-600 px-5 py-4 text-white shadow-red"
            >
              <div className="flex items-start gap-3">
                <AlertOctagon size={22} className="mt-0.5 shrink-0 animate-pulse" />
                <div>
                  <p className="font-bold">
                    {alert.ruleLabel}: {alert.horseName}
                  </p>
                  <p className="text-sm text-red-100">
                    {alert.text} · giây {secondText(alert.atSecond)} · {formatTime(alert.at)}
                    {alert.examRequestId ? ' · đã tạo yêu cầu khám khẩn' : ''}
                  </p>
                </div>
              </div>
              {data.flags.canAck ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-white text-red-700 shadow-none hover:bg-red-50"
                    disabled={ack.pending}
                    onClick={() => acknowledge(alert, 'STOP_HORSE')}
                  >
                    <Octagon size={13} /> Đã dừng ngựa
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white ring-1 ring-white/40 hover:bg-white/10 hover:text-white"
                    disabled={ack.pending}
                    onClick={() => acknowledge(alert, 'CONTINUE')}
                  >
                    Tiếp tục theo dõi
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-red-100">HT của khu hoặc bác sĩ xác nhận</span>
              )}
            </div>
          ))}
          {ack.error && <ErrorBox message={ack.error} />}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {/* Lưới ô ngựa */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
            {horses.map((horse) => (
              <HorseTile
                key={horse.horseId}
                horse={horse}
                active={current?.horseId === horse.horseId}
                onSelect={() => setSelected(horse.horseId)}
              />
            ))}
          </div>

          {current && (
            <Card className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar src={current.avatar} name={current.horseName} size={44} />
                  <div>
                    <p className="text-lg font-bold text-gray-900">{current.horseName}</p>
                    <p className="text-sm text-gray-500">
                      {current.stopped
                        ? `Đã dừng ở giây ${secondText(current.stopped.atSecond)} · ${current.stopped.byName}`
                        : current.finished
                          ? 'Đã xong bài, đang đi bộ chờ'
                          : current.current
                            ? `${current.current.phaseLabel}${current.current.phase === 'RUN' ? ` · lần ${current.current.runIndex}/${data.header.repetitions}` : ''}`
                            : 'Đang chờ dữ liệu'}
                      {current.groomName ? ` · Groom ${current.groomName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="slate">Kịch bản: {current.scenarioLabel}</Pill>
                  {data.flags.canAck && !current.stopped && (
                    <Button size="sm" variant="danger" onClick={() => setStopFor(current)}>
                      <Octagon size={13} /> Dừng ngựa này
                    </Button>
                  )}
                </div>
              </div>

              {!current.r1Enabled && (
                <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                  R1 tắt — chưa đặt ngưỡng nhịp tim tối đa cho {current.horseName}. Bác sĩ đặt ở màn hình Nhịp tim tối
                  đa; buổi đang chạy vẫn dùng giá trị đã chốt lúc bắt đầu.
                </p>
              )}
              {current.stopped?.reason && (
                <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">Lý do dừng: {current.stopped.reason}</p>
              )}

              <div className="grid gap-5 xl:grid-cols-2">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                    <HeartPulse size={15} className="text-red-500" /> Nhịp tim
                  </p>
                  <LineChart
                    height={200}
                    series={[
                      {
                        key: 'hr',
                        label: 'Nhịp tim',
                        color: chartColors.red,
                        points: current.samples.map((sample) => ({ x: sample.t, y: sample.heartRate })),
                      },
                    ]}
                    threshold={
                      current.maxHeartRate ? { value: current.maxHeartRate, label: `Ngưỡng ${current.maxHeartRate}` } : undefined
                    }
                    formatX={(value) => secondText(value)}
                    formatY={(value) => `${Math.round(value)}`}
                    yLabel="nhịp/phút"
                  />
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                    <Activity size={15} className="text-emerald-600" /> Tốc độ
                  </p>
                  <LineChart
                    height={200}
                    series={[
                      {
                        key: 'speed',
                        label: 'Tốc độ',
                        color: chartColors.emerald,
                        points: current.samples.map((sample) => ({ x: sample.t, y: sample.speedMps })),
                      },
                    ]}
                    threshold={{ value: current.fastThreshold, label: `Chạy nhanh ≥ ${current.fastThreshold} m/s` }}
                    formatX={(value) => secondText(value)}
                    formatY={(value) => value.toFixed(1)}
                    yLabel="m/s"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-emerald-50/40 p-4 sm:grid-cols-4">
                <Metric label="Nhịp tim TB / cao nhất" value={`${current.metrics.avgHeartRate} / ${current.metrics.maxHeartRate}`} />
                <Metric label="Tốc độ phần chính" value={speedText(current.metrics.mainAvgSpeedMps)} />
                <Metric label="Quãng đường" value={formatDistance(current.metrics.distanceM)} />
                <Metric
                  label="Khối lượng chạy nhanh"
                  value={`${formatDistance(current.metrics.fastDistanceM)} · ${formatPercent(current.metrics.volumeRatio)}`}
                />
              </div>
            </Card>
          )}

          {horses.length === 0 && (
            <Card variant="outline" tone="muted">
              <p className="text-sm text-gray-500">Không còn ngựa nào có mặt trong buổi.</p>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
          <Card tone="success">
            <p className="flex items-center gap-1.5 text-sm text-gray-500">
              <Timer size={15} className="text-emerald-600" /> Đã chạy
            </p>
            <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight text-gray-900">{secondText(data.second)}</p>
            <p className="mt-2 text-xs font-light text-gray-400">
              Bắt đầu {formatTime(data.header.startedAt)} bởi {data.header.startedByName ?? '—'} · mô phỏng ×{data.simSpeed}
              {data.header.simScenarioLabel ? ` · kịch bản ${data.header.simScenarioLabel.toLowerCase()}` : ''}
            </p>
            <p className="mt-3 text-xs text-gray-500">
              Buổi tự kết thúc khi mọi ngựa xong bài, hoặc sau 30 phút quá giờ slot.
            </p>
          </Card>

          {data.absent.length > 0 && (
            <Card variant="flat" tone="warning">
              <SectionTitle icon={<UserX size={16} />} className="mb-3">
                Vắng buổi này
              </SectionTitle>
              <ul className="space-y-2.5 text-sm">
                {data.absent.map((item) => (
                  <li key={item.horseId}>
                    <span className="font-semibold text-gray-800">{item.horseName}</span>
                    <span className="text-orange-800"> — {item.reasonLabel}</span>
                    {item.note && <p className="text-xs text-gray-500">{item.note}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card variant="outline">
            <SectionTitle icon={<AlertOctagon size={16} />} className="mb-3">
              Cảnh báo trong buổi
            </SectionTitle>
            {data.alerts.length === 0 ? (
              <p className="py-4 text-sm font-light text-gray-400">Chưa có cảnh báo nào.</p>
            ) : (
              <ul className="space-y-2">
                {data.alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className={cn('rounded-xl px-3 py-2.5', alert.level === 'RED' ? 'bg-red-50' : 'bg-gray-50')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm font-semibold', alert.level === 'RED' ? 'text-red-700' : 'text-gray-600')}>
                        {alert.horseName} · {alert.ruleLabel}
                      </p>
                      <span className="text-xs tabular-nums text-gray-400">{secondText(alert.atSecond)}</span>
                    </div>
                    <p className="text-xs text-gray-500">{alert.text}</p>
                    {alert.acknowledgedByName ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle2 size={12} /> {alert.acknowledgedByName} ·{' '}
                        {alert.ackAction === 'STOP_HORSE' ? 'đã dừng ngựa' : 'tiếp tục theo dõi'}
                      </p>
                    ) : alert.level === 'RED' ? (
                      <p className="mt-1 text-xs font-semibold text-red-600">Chờ xác nhận</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      <ReasonModal
        open={!!stopFor}
        onClose={() => setStopFor(null)}
        title={`Dừng ${stopFor?.horseName ?? 'ngựa'}`}
        description="Chỉ dừng riêng con ngựa này, buổi vẫn tiếp tục với các ngựa khác."
        message="Chỉ số của ngựa được chốt tại giây dừng. Groom chuyển sang chăm sóc sau tập."
        confirmLabel="Dừng ngựa"
        placeholder="Ví dụ: ngựa thở gấp, bước chân không đều ở vòng cua"
        onSubmit={async (reason) => {
          if (!stopFor) return undefined;
          const done = await stopHorse(sessionId, stopFor.horseId, reason);
          toast.push(`Đã dừng ${stopFor.horseName}`, 'success');
          reload();
          return done;
        }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-light text-gray-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

function HorseTile({ horse, active, onSelect }: { horse: LiveHorse; active: boolean; onSelect: () => void }) {
  const alarm = horse.unackedRed > 0;
  const lost = horse.signalLost;
  const stopped = !!horse.stopped;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col rounded-2xl p-4 text-left transition-all duration-200',
        alarm
          ? 'bg-red-50 ring-2 ring-red-500 shadow-red'
          : lost
            ? 'bg-gray-100 ring-2 ring-gray-300'
            : stopped
              ? 'bg-white ring-1 ring-gray-200 opacity-75'
              : 'bg-white ring-1 ring-emerald-950/[0.06] hover:-translate-y-0.5 hover:shadow-grass-lift',
        active && !alarm && !lost && 'ring-2 ring-emerald-500 shadow-grass',
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar src={horse.avatar} name={horse.horseName} size={32} className={cn(lost && 'grayscale')} />
        <p className="min-w-0 flex-1 truncate font-semibold text-gray-900">{horse.horseName}</p>
        {alarm && <AlertOctagon size={18} className="animate-pulse text-red-600" />}
        {lost && <WifiOff size={17} className="text-gray-500" />}
      </div>

      <div className="mt-3 flex items-end gap-4">
        <div>
          <p
            className={cn(
              'text-4xl font-bold leading-none tabular-nums tracking-tight',
              lost ? 'text-gray-400' : horse.overMax ? 'text-red-600' : 'text-gray-900',
            )}
          >
            {lost || !horse.current ? '—' : horse.current.heartRate}
          </p>
          <p className="mt-1 text-[11px] font-light text-gray-400">
            nhịp/phút{horse.maxHeartRate ? ` · ngưỡng ${horse.maxHeartRate}` : ''}
          </p>
        </div>
        <div className="pb-0.5">
          <p className="text-xl font-semibold leading-none tabular-nums text-gray-700">
            {lost || !horse.current ? '—' : horse.current.speedMps.toFixed(1)}
          </p>
          <p className="mt-1 text-[11px] font-light text-gray-400">m/s</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {stopped ? (
          <Pill tone="red">Đã dừng</Pill>
        ) : lost ? (
          <Pill tone="gray">Mất tín hiệu</Pill>
        ) : horse.finished ? (
          <Pill tone="green">Xong bài</Pill>
        ) : (
          <Pill tone={horse.current?.phase === 'RUN' ? 'blue' : 'slate'}>{horse.current?.phaseLabel ?? 'Chờ dữ liệu'}</Pill>
        )}
        {!horse.r1Enabled && (
          <Pill tone="amber" title="Chưa đặt ngưỡng nhịp tim tối đa">
            R1 tắt — chưa đặt ngưỡng
          </Pill>
        )}
      </div>
    </button>
  );
}
