// Khối giai đoạn trong trang giáo án: tab Tuần mẫu và từng Tuần 1…N.
//
// - Tuần mẫu: sửa trực tiếp trên lưới; lưu xong chỉ áp dụng cho các buổi sinh sau đó.
// - Tuần cụ thể: hiện buổi tập thật đã sinh trong tuần, sửa, hủy hoặc thêm buổi lẻ ngay tại chỗ.
import { useState } from 'react';
import { CalendarPlus, Pencil, Plus, Save, X } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  cancelSession,
  generateSessions,
  getPhaseWeeks,
  listSlots,
  updatePhase,
  type PhaseDetail,
  type SessionRow,
  type WorkoutTemplateInput,
} from '../../services/training.service';
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
  Textarea,
} from '../../components/ui';
import { SessionPill } from '../../components/ui/status';
import { WeekGrid } from '../../components/WeekGrid';
import { SessionEditorModal } from '../../components/SessionEditorModal';
import { dayOfWeekLabel, intensityLabel, surfaceLabel, workoutLabel } from '../../lib/labels';
import { formatDate, isoDayOfWeek } from '../../lib/format';

const intensityTone = {
  LIGHT: 'border-emerald-100 bg-emerald-50/70',
  MODERATE: 'border-sky-100 bg-sky-50/70',
  HEAVY: 'border-amber-100 bg-amber-50/70',
  MAXIMUM: 'border-red-100 bg-red-50/70',
} as const;

export function PhasePanel({
  phase,
  planId,
  horseId,
  canEdit,
  onChanged,
}: {
  phase: PhaseDetail;
  planId: string;
  horseId: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const slots = useService(() => listSlots(), []);
  const weeks = useService(() => getPhaseWeeks(phase.id), [phase.id, phase.weeks, phase.generatedSessions]);
  const action = useAction();

  const [tab, setTab] = useState('template');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ name: string; goal: string; weeks: number; template: WorkoutTemplateInput[] }>({
    name: phase.name,
    goal: phase.goal,
    weeks: phase.weeks,
    template: phase.workouts,
  });
  const [generateResult, setGenerateResult] = useState<{ created: number; skipped: { date: string; reason: string }[] } | null>(null);
  const [sessionEditor, setSessionEditor] = useState<{ session?: SessionRow; date?: string } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SessionRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const locked = phase.state === 'PAST' || phase.state === 'NOT_RUN';
  const weekLocked = phase.state === 'CURRENT';

  const startEdit = () => {
    setDraft({ name: phase.name, goal: phase.goal, weeks: phase.weeks, template: phase.workouts });
    setEditing(true);
  };

  const save = async () => {
    const done = await action.run(() => updatePhase(phase.id, draft));
    if (done !== undefined) {
      setEditing(false);
      onChanged();
    }
  };

  const refresh = () => {
    weeks.reload();
    onChanged();
  };

  const activeWeek = weeks.data?.find((week) => String(week.weekNo) === tab);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionTitle>
            Giai đoạn {phase.orderNo} — {phase.name}
          </SectionTitle>
          <p className="-mt-3 text-sm font-light text-gray-500">
            {phase.goal || 'Chưa ghi mục tiêu giai đoạn'} · {phase.weeks} tuần ·{' '}
            {formatDate(phase.startDate)} → {formatDate(phase.endDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-gray-400">
            {phase.generatedSessions > 0 ? `${phase.generatedSessions} buổi đã sinh` : 'Chưa sinh buổi tập nào'}
          </span>
          {canEdit && !locked && !editing && (
            <Button size="sm" variant="secondary" onClick={startEdit}>
              <Pencil size={14} /> Sửa giai đoạn
            </Button>
          )}
          {canEdit && !locked && (
            <Button
              size="sm"
              onClick={async () => {
                const result = await action.run(() => generateSessions(phase.id));
                if (result) {
                  setGenerateResult(result);
                  refresh();
                }
              }}
              disabled={action.pending}
            >
              <CalendarPlus size={14} /> Áp dụng cho các tuần còn lại
            </Button>
          )}
        </div>
      </div>

      {action.error && <ErrorBox message={action.error} />}

      {/* Tab tuần mẫu và từng tuần */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          onClick={() => setTab('template')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            tab === 'template' ? 'bg-emerald-600 text-white' : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          Tuần mẫu
        </button>
        {weeks.data?.map((week) => (
          <button
            key={week.weekNo}
            onClick={() => setTab(String(week.weekNo))}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === String(week.weekNo)
                ? 'bg-emerald-600 text-white'
                : week.isCurrent
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Tuần {week.weekNo}
            {week.isCurrent && tab !== String(week.weekNo) && ' · đang diễn ra'}
          </button>
        ))}
      </div>

      {/* Tuần mẫu */}
      {tab === 'template' && (
        <div className="space-y-4">
          {editing && (
            <div className="grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
              <Field label="Tên giai đoạn" required>
                <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </Field>
              <Field
                label="Số tuần"
                required
                hint={weekLocked ? 'Giai đoạn đang diễn ra không đổi được số tuần' : '1–12 tuần'}
                error={action.field === 'weeks' ? action.error : undefined}
              >
                <Input
                  type="number"
                  min={1}
                  max={12}
                  disabled={weekLocked}
                  value={draft.weeks}
                  onChange={(event) => setDraft({ ...draft, weeks: Number(event.target.value) })}
                />
              </Field>
              <Field label="Mục tiêu giai đoạn">
                <Input value={draft.goal} onChange={(event) => setDraft({ ...draft, goal: event.target.value })} />
              </Field>
            </div>
          )}

          <WeekGrid
            value={editing ? draft.template : phase.workouts}
            slots={slots.data ?? []}
            readOnly={!editing}
            onChange={(template) => setDraft({ ...draft, template })}
          />

          {editing ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={action.pending}>
                <Save size={15} /> {action.pending ? 'Đang lưu…' : 'Lưu tuần mẫu'}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Hủy
              </Button>
              <span className="text-xs font-light text-gray-400">
                Tuần mẫu mới chỉ áp dụng cho các buổi sinh sau đó. Buổi đã sinh sửa ở tab từng tuần.
              </span>
            </div>
          ) : (
            locked && (
              <p className="text-xs font-light text-gray-400">
                {phase.state === 'PAST'
                  ? 'Giai đoạn đã qua nên tuần mẫu không sửa được nữa.'
                  : 'Giai đoạn này không được thực hiện do giáo án kết thúc sớm.'}
              </p>
            )
          )}
        </div>
      )}

      {/* Một tuần cụ thể */}
      {activeWeek && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              {formatDate(activeWeek.startDate)} → {formatDate(activeWeek.endDate)} ·{' '}
              <span className="tabular-nums">{activeWeek.volumeM.toLocaleString('vi-VN')} m</span> khối lượng
            </p>
            {canEdit && !activeWeek.isPast && (
              <Button size="sm" variant="secondary" onClick={() => setSessionEditor({ date: activeWeek.startDate })}>
                <Plus size={14} /> Thêm buổi vào tuần này
              </Button>
            )}
          </div>

          {activeWeek.sessions.length === 0 ? (
            <EmptyState
              title="Tuần này chưa có buổi tập nào"
              hint="Bấm “Áp dụng cho các tuần còn lại” để sinh buổi từ tuần mẫu, hoặc thêm buổi lẻ."
            />
          ) : (
            <div className="space-y-2">
              {activeWeek.sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                    session.status === 'CANCELLED' ? 'border-gray-100 bg-gray-50 opacity-70' : intensityTone[session.intensity]
                  }`}
                >
                  <div className="w-28 shrink-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {dayOfWeekLabel[isoDayOfWeek(new Date(session.sessionDate))]}
                    </p>
                    <p className="font-mono text-[11px] text-gray-400">{formatDate(session.sessionDate)}</p>
                  </div>
                  <span className="w-24 shrink-0 font-mono text-xs text-gray-400">{session.slotLabel}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {workoutLabel[session.workoutType]} {session.distanceM} m × {session.repetitions}
                    </p>
                    <p className="text-xs text-gray-500">
                      {intensityLabel[session.intensity]} · {surfaceLabel[session.surface]}
                      {session.groomName ? ` · ${session.groomName}` : ''}
                    </p>
                    {session.cancelReason && <p className="mt-0.5 text-xs text-red-500">{session.cancelReason}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SessionPill status={session.status} />
                    {session.derivedLabel && <Pill tone="gray">{session.derivedLabel}</Pill>}
                    {session.marks.map((mark) => (
                      <Pill key={mark} tone="amber">
                        {mark}
                      </Pill>
                    ))}
                    {canEdit && session.status === 'SCHEDULED' && (
                      <>
                        <button
                          onClick={() => setSessionEditor({ session })}
                          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white hover:text-emerald-600"
                          title="Sửa buổi tập"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setCancelTarget(session);
                            setCancelReason('');
                          }}
                          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white hover:text-red-500"
                          title="Hủy buổi tập"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {weeks.loading && <Skeleton rows={2} />}

      {/* Kết quả sinh lịch */}
      <Modal
        open={generateResult !== null}
        onClose={() => setGenerateResult(null)}
        title="Kết quả sinh lịch tập"
        footer={<Button onClick={() => setGenerateResult(null)}>Đóng</Button>}
      >
        <div className="space-y-4">
          <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            Đã tạo <strong>{generateResult?.created ?? 0}</strong> buổi tập.
          </p>
          {(generateResult?.skipped.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-600">Bỏ qua {generateResult?.skipped.length} buổi:</p>
              <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl bg-gray-50 p-3 custom-scrollbar">
                {generateResult?.skipped.map((item, index) => (
                  <p key={index} className="text-sm text-gray-600">
                    <span className="font-mono text-xs text-gray-400">{item.date}</span> — {item.reason}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <SessionEditorModal
        open={sessionEditor !== null}
        session={sessionEditor?.session}
        draft={{
          horseId,
          planId,
          phaseId: phase.id,
          sessionDate: sessionEditor?.date,
        }}
        lockHorse
        onClose={() => setSessionEditor(null)}
        onSaved={() => {
          setSessionEditor(null);
          refresh();
        }}
      />

      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Hủy buổi tập"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Quay lại
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const done = await action.run(() => cancelSession(cancelTarget!.id, cancelReason));
                if (done !== undefined) {
                  setCancelTarget(null);
                  refresh();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang xử lý…' : 'Hủy buổi tập'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Buổi {cancelTarget ? formatDate(cancelTarget.sessionDate) : ''} sẽ chuyển sang Đã hủy với nhóm lý do
            &ldquo;Huấn luyện viên thay đổi kế hoạch&rdquo;. Nhân viên chăm sóc được báo ngay.
          </p>
          <Field label="Lý do hủy" required error={action.field === 'reason' ? action.error : undefined}>
            <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
