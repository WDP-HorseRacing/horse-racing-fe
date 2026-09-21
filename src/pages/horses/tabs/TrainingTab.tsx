import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ClipboardList, Heart, Timer } from "lucide-react";
import { useAction, useService } from "../../../hooks/useService";
import {
  clearMaxHeartRate,
  getHorseProgress,
  getMaxHeartRate,
  listPlans,
  listSessions,
  listTimeTrials,
  setMaxHeartRate,
} from "../../../services/training.service";
import { useStore } from "../../../store/store";
import { can } from "../../../auth/permissions";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  Pill,
  SectionTitle,
  Skeleton,
  Tabs,
  Textarea,
} from "../../../components/ui";
import { PlanPill, SessionPill } from "../../../components/ui/status";
import { LineChart, chartColors } from "../../../components/charts/LineChart";
import {
  earlyEndLabel,
  intensityLabel,
  surfaceLabel,
  workoutLabel,
} from "../../../lib/labels";
import {
  addDays,
  formatDate,
  formatDateShort,
  formatPercent,
  toDateKey,
} from "../../../lib/format";

import { now } from "../../../lib/clock";

export default function TrainingTab({ horseId }: { horseId: string }) {
  const currentUser = useStore((state) => state.currentUser);
  const [sub, setSub] = useState("overview");
  const plans = useService(() => listPlans({ horseId }), [horseId]);
  const progress = useService(() => getHorseProgress(horseId), [horseId]);
  const trials = useService(() => listTimeTrials(horseId), [horseId]);
  const sessions = useService(
    () =>
      listSessions({
        from: toDateKey(addDays(now(), -60)),
        to: toDateKey(addDays(now(), 60)),
        horseId,
      }),
    [horseId],
  );

  if (plans.loading) return <Skeleton rows={4} />;

  const isOwner = currentUser?.role === "HORSE_OWNER";

  return (
    <div className="space-y-5">
      <Tabs
        tabs={[
          { key: "overview", label: "Tiến độ" },
          { key: "plans", label: "Giáo án" },
          { key: "sessions", label: "Buổi tập" },
          { key: "trials", label: "Lịch sử chạy thử" },
          ...(isOwner ? [] : [{ key: "maxhr", label: "Nhịp tim tối đa" }]),
        ]}
        active={sub}
        onChange={setSub}
      />

      {sub === "overview" && (
        <ProgressPanel
          horseId={horseId}
          data={progress.data}
          loading={progress.loading}
        />
      )}

      {sub === "plans" && (
        <div className="space-y-3">
          {(plans.data?.length ?? 0) === 0 && (
            <EmptyState title="Ngựa chưa có giáo án nào" />
          )}
          {plans.data?.map((plan) => (
            <Link key={plan.id} to={`/training/plans/${plan.id}`}>
              <Card className="transition hover:border-emerald-100 hover:shadow-[0_8px_24px_rgba(5,96,69,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                      {plan.name}
                      <PlanPill status={plan.status} />
                      {plan.needsReview && (
                        <Pill tone="amber">Cần xem lại</Pill>
                      )}
                    </p>
                    <p className="mt-1 text-sm font-light text-gray-500">
                      {plan.goal}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-gray-700">
                      {formatDate(plan.startDate)} → {formatDate(plan.endDate)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {plan.currentPhaseNo
                        ? `Giai đoạn ${plan.currentPhaseNo}/${plan.phaseCount}`
                        : `${plan.phaseCount} giai đoạn`}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {sub === "sessions" && (
        <Card>
          <SectionTitle
            icon={<ClipboardList size={16} className="text-emerald-600" />}
          >
            Buổi tập 60 ngày gần đây và sắp tới
          </SectionTitle>
          {(sessions.data?.length ?? 0) === 0 ? (
            <EmptyState title="Chưa có buổi tập nào" />
          ) : (
            <div className="max-h-[480px] space-y-1 overflow-y-auto custom-scrollbar">
              {sessions.data?.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-wrap items-center gap-3 border-b border-gray-50 py-3 last:border-0"
                >
                  <span className="w-24 shrink-0 text-xs text-gray-400 tabular-nums">
                    {formatDate(session.sessionDate)}
                  </span>
                  <span className="w-24 shrink-0 font-mono text-xs text-gray-400">
                    {session.slotLabel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {workoutLabel[session.workoutType]} {session.distanceM} m
                      × {session.repetitions}
                    </p>
                    <p className="text-xs text-gray-400">
                      {intensityLabel[session.intensity]} ·{" "}
                      {surfaceLabel[session.surface]}
                      {session.cancelReason ? ` · ${session.cancelReason}` : ""}
                    </p>
                  </div>
                  {session.volumeRatio !== undefined && (
                    <span className="text-xs font-semibold text-gray-500 tabular-nums">
                      {formatPercent(session.volumeRatio)}
                    </span>
                  )}
                  {session.marks.map((mark) => (
                    <Pill key={mark} tone="amber">
                      {mark}
                    </Pill>
                  ))}
                  {session.derivedLabel && (
                    <Pill tone="gray">{session.derivedLabel}</Pill>
                  )}
                  <SessionPill status={session.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {sub === "trials" && (
        <Card>
          <SectionTitle icon={<Timer size={16} className="text-emerald-600" />}>
            Lịch sử chạy thử
          </SectionTitle>
          {(trials.data?.length ?? 0) === 0 ? (
            <EmptyState title="Chưa có buổi chạy thử nào hoàn thành" />
          ) : (
            <div className="space-y-2">
              {trials.data?.map((trial, index, all) => {
                const previous = all
                  .slice(index + 1)
                  .find(
                    (item) =>
                      item.distanceM === trial.distanceM &&
                      item.surface === trial.surface,
                  );
                const delta =
                  previous?.timeSeconds && trial.timeSeconds
                    ? trial.timeSeconds - previous.timeSeconds
                    : undefined;
                return (
                  <div
                    key={trial.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl bg-gray-50 p-4"
                  >
                    {trial.videoThumbnail && (
                      <img
                        src={trial.videoThumbnail}
                        alt="Ảnh bìa video"
                        className="h-14 w-20 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {trial.distanceM} m · {surfaceLabel[trial.surface]}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(trial.sessionDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 tabular-nums">
                        {trial.notCompleted
                          ? "Không hoàn thành"
                          : `${trial.timeSeconds?.toFixed(2)} s`}
                      </p>
                      {delta !== undefined && (
                        <p
                          className={`text-xs font-semibold ${delta < 0 ? "text-emerald-600" : "text-red-500"}`}
                        >
                          {delta < 0 ? "▼" : "▲"} {Math.abs(delta).toFixed(2)} s
                          so với lần trước
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {sub === "maxhr" && (
        <MaxHeartRatePanel
          horseId={horseId}
          canEdit={can(currentUser, "maxhr.edit")}
        />
      )}
    </div>
  );
}

function ProgressPanel({
  data,
  loading,
}: {
  horseId: string;
  data: Awaited<ReturnType<typeof getHorseProgress>> | undefined;
  loading: boolean;
}) {
  const [workoutFilter, setWorkoutFilter] = useState("CANTER");
  if (loading) return <Skeleton rows={4} />;
  if (!data) return <EmptyState title="Chưa có dữ liệu tiến độ" />;

  const trialDistances = [
    ...new Set(data.trialSeries.map((point) => point.distanceM)),
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-gray-400">Giáo án đang áp dụng</p>
          <p className="mt-1 truncate text-lg font-bold text-gray-900">
            {data.planName ?? "Chưa có"}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Tiến độ giáo án</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
            {formatPercent(data.progress)}
          </p>
          <p className="text-[11px] text-gray-400">
            {data.completed}/{data.denominator} buổi
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Buổi đủ khối lượng</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
            {formatPercent(data.fullVolumeRatio)}
          </p>
          <p className="text-[11px] text-gray-400">từ 90% khối lượng trở lên</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Buổi kết thúc sớm</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
            {data.earlyEnded.length}
          </p>
        </Card>
      </div>

      <Card>
        <SectionTitle
          icon={<Activity size={16} className="text-emerald-600" />}
        >
          Điểm phong độ theo ngày
        </SectionTitle>
        <LineChart
          series={[
            {
              key: "score",
              label: "Điểm phong độ",
              color: chartColors.emerald,
              points: data.scoreSeries.map((point) => ({
                x: new Date(point.date).getTime(),
                y: point.value,
              })),
            },
          ]}
          formatX={(value) => formatDateShort(new Date(value))}
          yLabel="Thang điểm 1–10"
        />
      </Card>

      <Card>
        <SectionTitle icon={<Timer size={16} className="text-emerald-600" />}>
          Thời gian chạy thử theo ngày
        </SectionTitle>
        <LineChart
          series={trialDistances.map((distance, index) => ({
            key: String(distance),
            label: `${distance} m`,
            color: [chartColors.emerald, chartColors.amber, chartColors.sky][
              index % 3
            ],
            points: data.trialSeries
              .filter((point) => point.distanceM === distance)
              .map((point) => ({
                x: new Date(point.date).getTime(),
                y: point.value,
              })),
          }))}
          formatX={(value) => formatDateShort(new Date(value))}
          formatY={(value) => `${value.toFixed(1)}s`}
          yLabel="Đơn vị: giây"
        />
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={<Heart size={16} className="text-emerald-600" />}>
            Chỉ số hiệu suất tim
          </SectionTitle>
          <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 text-xs font-semibold">
            {["CANTER", "BREEZE", "TIME_TRIAL", "TROT"].map((type) => (
              <button
                key={type}
                onClick={() => setWorkoutFilter(type)}
                className={`rounded-lg px-2.5 py-1.5 transition ${
                  workoutFilter === type
                    ? "bg-emerald-600 text-white"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {workoutLabel[type as never]}
              </button>
            ))}
          </div>
        </div>
        <LineChart
          series={[
            {
              key: "cardiac",
              label: "Tốc độ trung bình ÷ nhịp tim × 100",
              color: chartColors.sky,
              points: data.cardiacSeries
                .filter((point) => point.workoutType === workoutFilter)
                .map((point) => ({
                  x: new Date(point.date).getTime(),
                  y: point.value,
                })),
            },
          ]}
          formatX={(value) => formatDateShort(new Date(value))}
          yLabel="Chỉ so sánh giữa các buổi cùng loại bài tập"
        />
      </Card>

      {data.earlyEnded.length > 0 && (
        <Card>
          <SectionTitle>Các buổi kết thúc sớm</SectionTitle>
          <div className="space-y-1">
            {data.earlyEnded.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {earlyEndLabel[item.reason]}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(item.date)}
                    {item.note ? ` · ${item.note}` : ""}
                  </p>
                </div>
                <Pill tone="amber">{formatPercent(item.volumeRatio)}</Pill>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function MaxHeartRatePanel({
  horseId,
  canEdit,
}: {
  horseId: string;
  canEdit: boolean;
}) {
  const { data, loading, reload } = useService(
    () => getMaxHeartRate(horseId),
    [horseId],
  );
  const action = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ value: "", reason: "" });

  if (loading) return <Skeleton rows={3} />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400">
              Nhịp tim tối đa đang áp dụng
            </p>
            <p className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">
              {data.current}
              <span className="ml-1 text-sm font-medium text-gray-400">
                nhịp/phút
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {data.isCustom
                ? "Giá trị riêng do bác sĩ đặt cho con ngựa này"
                : `Đang dùng giá trị mặc định của câu lạc bộ (${data.clubDefault})`}
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setOpen(true)}>
                Đặt giá trị riêng
              </Button>
              {data.isCustom && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const done = await action.run(() =>
                      clearMaxHeartRate(horseId),
                    );
                    if (done !== undefined) reload();
                  }}
                >
                  Gỡ giá trị riêng
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>Lịch sử thay đổi</SectionTitle>
        {data.history.length === 0 ? (
          <EmptyState
            title="Chưa từng đặt giá trị riêng"
            hint="Ngựa đang dùng ngưỡng mặc định của câu lạc bộ."
          />
        ) : (
          <div className="space-y-1">
            {data.history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {item.value} nhịp/phút{" "}
                    {item.active && <Pill tone="green">Đang áp dụng</Pill>}
                  </p>
                  <p className="text-xs text-gray-400">{item.reason}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {formatDate(item.createdAt)} · {item.createdByName}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {action.error && <ErrorBox message={action.error} />}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Đặt nhịp tim tối đa"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() =>
                  setMaxHeartRate(horseId, Number(form.value), form.reason),
                );
                if (done !== undefined) {
                  setOpen(false);
                  setForm({ value: "", reason: "" });
                  reload();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Giá trị (nhịp/phút)"
            required
            hint="Khoảng hợp lệ 180–260. Nhịp tim tối đa giảm dần theo tuổi."
            error={action.field === "value" ? action.error : undefined}
          >
            <Input
              type="number"
              value={form.value}
              onChange={(event) =>
                setForm({ ...form, value: event.target.value })
              }
            />
          </Field>
          <Field
            label="Lý do"
            required
            error={action.field === "reason" ? action.error : undefined}
          >
            <Textarea
              value={form.reason}
              onChange={(event) =>
                setForm({ ...form, reason: event.target.value })
              }
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
