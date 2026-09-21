import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { cancelSession, listSessions, listSlots, type SessionRow } from '../../services/training.service';
import { listZones } from '../../services/horse.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { Button, Card, Field, Modal, PageHeader, Pill, Select, Skeleton, Textarea } from '../../components/ui';
import { SessionEditorModal } from '../../components/SessionEditorModal';
import { SessionPill } from '../../components/ui/status';
import { dayOfWeekLabel, intensityLabel, surfaceLabel, workoutLabel } from '../../lib/labels';
import { addDays, formatDate, isoDayOfWeek, startOfWeek, toDateKey } from '../../lib/format';
import { now } from '../../lib/clock';
import type { TrainingIntensity } from '../../types/domain';

const intensityTone: Record<TrainingIntensity, string> = {
  LIGHT: 'border-emerald-100 bg-emerald-50/70',
  MODERATE: 'border-sky-100 bg-sky-50/70',
  HEAVY: 'border-amber-100 bg-amber-50/70',
  MAXIMUM: 'border-red-100 bg-red-50/70',
};

export default function SchedulePage() {
  const currentUser = useStore((state) => state.currentUser);
  const editable = can(currentUser, 'session.edit');
  const [weekOffset, setWeekOffset] = useState(0);
  const [zoneId, setZoneId] = useState('');

  const weekStart = useMemo(() => addDays(startOfWeek(now()), weekOffset * 7), [weekOffset]);
  const from = toDateKey(weekStart);
  const to = toDateKey(addDays(weekStart, 6));

  const slots = useService(() => listSlots(), []);
  const zones = useService(() => listZones(), []);
  const { data, loading, reload } = useService(() => listSessions({ from, to, zoneId }), [from, to, zoneId]);
  const action = useAction();

  const [editor, setEditor] = useState<{ session?: SessionRow; date: string; slotId: string } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SessionRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  if (loading || slots.loading) return <Skeleton rows={6} />;

  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const sessionsAt = (dateKey: string, slotId: string) =>
    (data ?? []).filter((session) => session.sessionDate === dateKey && session.slotId === slotId);

  const openCreate = (dateKey: string, slotId: string) => setEditor({ date: dateKey, slotId });
  const openEdit = (session: SessionRow) =>
    setEditor({ session, date: session.sessionDate, slotId: session.slotId });

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Lịch tập"
        description="Hàng là khung giờ, cột là ngày trong tuần. Bấm vào ô trống để thêm buổi lẻ."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 transition hover:bg-gray-50"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[180px] text-center text-sm font-medium text-gray-700">
              {formatDate(weekStart)} → {formatDate(addDays(weekStart, 6))}
            </span>
            <button
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 transition hover:bg-gray-50"
            >
              <ChevronRight size={16} />
            </button>
            {weekOffset !== 0 && (
              <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>
                Tuần này
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <Select value={zoneId} onChange={(event) => setZoneId(event.target.value)} className="sm:w-64">
          <option value="">Mọi khu chuồng</option>
          {zones.data?.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </Select>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-[0_2px_8px_rgba(5,96,69,0.05)]">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-28 border-b border-gray-100 px-3 py-2.5 text-left text-xs font-semibold text-gray-400">
                Khung giờ
              </th>
              {days.map((day) => {
                const isToday = toDateKey(day) === toDateKey(now());
                return (
                  <th
                    key={day.toISOString()}
                    className={`border-b border-l border-gray-100 px-2 py-2.5 text-center text-xs font-semibold ${
                      isToday ? 'bg-emerald-50/60 text-emerald-700' : 'text-gray-400'
                    }`}
                  >
                    {dayOfWeekLabel[isoDayOfWeek(day)]}
                    <span className="ml-1 font-normal text-gray-300">{day.getDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slots.data?.map((slot) => (
              <tr key={slot.id}>
                <td className="border-b border-gray-50 px-3 py-2 font-mono text-xs text-gray-400">
                  {slot.startTime}–{slot.endTime}
                </td>
                {days.map((day) => {
                  const dateKey = toDateKey(day);
                  const cellSessions = sessionsAt(dateKey, slot.id);
                  return (
                    <td key={dateKey} className="border-b border-l border-gray-50 p-1 align-top">
                      <div className="space-y-1">
                        {cellSessions.map((session) => (
                          <button
                            key={session.id}
                            onClick={() => (session.canEdit && session.status === 'SCHEDULED' ? openEdit(session) : undefined)}
                            className={`w-full rounded-lg border p-2 text-left transition ${
                              session.status === 'CANCELLED'
                                ? 'border-gray-100 bg-gray-50 opacity-60'
                                : intensityTone[session.intensity]
                            } ${session.canEdit && session.status === 'SCHEDULED' ? 'hover:brightness-95' : 'cursor-default'}`}
                          >
                            <p className="truncate text-xs font-semibold text-gray-800">{session.horseName}</p>
                            <p className="truncate text-[11px] text-gray-600">
                              {workoutLabel[session.workoutType]} {session.distanceM}m×{session.repetitions}
                            </p>
                            <p className="truncate text-[11px] text-gray-400">
                              {intensityLabel[session.intensity]} · {surfaceLabel[session.surface]}
                            </p>
                            {session.groomName && (
                              <p className="truncate text-[11px] text-gray-400">{session.groomName}</p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-1">
                              <SessionPill status={session.status} />
                              {session.derivedLabel && <Pill tone="gray">{session.derivedLabel}</Pill>}
                            </div>
                            {session.cancelReason && (
                              <p className="mt-1 truncate text-[11px] text-red-500">{session.cancelReason}</p>
                            )}
                            {session.canEdit && session.status === 'SCHEDULED' && (
                              <span
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setCancelTarget(session);
                                  setCancelReason('');
                                }}
                                className="mt-1 inline-block cursor-pointer text-[11px] font-medium text-red-500 hover:underline"
                              >
                                Hủy buổi
                              </span>
                            )}
                          </button>
                        ))}
                        {editable && (
                          <button
                            onClick={() => openCreate(dateKey, slot.id)}
                            className="flex h-8 w-full items-center justify-center rounded-lg text-gray-200 transition hover:bg-emerald-50 hover:text-emerald-500"
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SessionEditorModal
        open={editor !== null}
        session={editor?.session}
        draft={{ sessionDate: editor?.date, slotId: editor?.slotId }}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null);
          reload();
        }}
      />

      {/* Hủy buổi tập */}
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
                  reload();
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
            Buổi tập của <strong>{cancelTarget?.horseName}</strong> ngày {formatDate(cancelTarget?.sessionDate)} sẽ chuyển
            sang Đã hủy với nhóm lý do &ldquo;Huấn luyện viên thay đổi kế hoạch&rdquo;. Nhân viên chăm sóc được báo ngay.
          </p>
          <Field label="Lý do hủy" required error={action.field === 'reason' ? action.error : undefined}>
            <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
