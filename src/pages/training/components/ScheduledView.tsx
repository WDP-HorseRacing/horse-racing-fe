// Buổi chưa bắt đầu (hoặc đã hủy): danh sách ngựa với mức sẵn sàng hiện tại, Groom dắt, vắng, việc Groom.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Play, RotateCcw, UserCog, X } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  InfoRow,
  Notice,
  SectionTitle,
  Select,
  cn,
  useToast,
} from '../../../components/ui';
import { AttendancePill, EligibilityBadge, HealthPill } from '../../../components/ui/status';
import { useAction } from '../../../hooks/useService';
import {
  clearAbsence,
  setSessionGroom,
  type SessionDetail,
  type SessionHorseRow,
} from '../../../services/session.service';
import { links } from '../../../lib/links';
import { formatDateTime } from '../../../lib/format';
import GroomTaskChecklist from './GroomTaskChecklist';
import MarkAbsentModal from './MarkAbsentModal';

export default function ScheduledView({
  detail,
  onChanged,
  onStart,
}: {
  detail: SessionDetail;
  onChanged: () => void;
  onStart: () => void;
}) {
  const [absentFor, setAbsentFor] = useState<SessionHorseRow | null>(null);
  const { header, flags, horses } = detail;
  const cancelled = header.status === 'CANCELLED';
  const isGroom = detail.viewerRole === 'GROOM';
  const active = horses.filter((row) => row.status !== 'ABSENT');
  const ready = active.filter((row) => row.readiness.allowed);
  const blocked = active.filter((row) => !row.readiness.allowed);
  const noThreshold = ready.filter((row) => row.r1Disabled);
  const noGroom = active.filter((row) => !row.groomId);

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        <SectionTitle
          icon={<UserCog size={16} />}
          action={
            <span className="text-xs text-gray-500">
              {detail.totalHorses} ngựa trong lớp{detail.hiddenCount > 0 ? ` · bạn xem ${horses.length}` : ''}
            </span>
          }
        >
          Ngựa của buổi
        </SectionTitle>
        {horses.length === 0 ? (
          <Card variant="outline" tone="muted">
            <p className="text-sm text-gray-500">Lớp chưa có ngựa nào đăng ký tính tới ngày của buổi này.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {horses.map((row) => (
              <HorseRow
                key={row.horseId}
                row={row}
                detail={detail}
                isGroom={isGroom}
                onAbsent={() => setAbsentFor(row)}
                onChanged={onChanged}
              />
            ))}
          </div>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
        {!cancelled && (
          <Card>
            <p className="text-sm text-gray-500">Sẵn sàng lúc này</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-gray-900">
              {ready.length}
              <span className="text-lg font-medium text-gray-400">/{horses.length}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Tính lại mỗi lần xem. Lúc bấm Bắt đầu hệ thống kiểm tra lại từng ngựa.
            </p>
            {blocked.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-sm">
                {blocked.map((row) => (
                  <li key={row.horseId} className="flex gap-2 text-red-700">
                    <X size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">{row.horseName}</span> sẽ vắng lúc bắt đầu
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {flags.canStart && (
              <Button className="mt-5 w-full" onClick={onStart}>
                <Play size={15} /> Bắt đầu buổi
              </Button>
            )}
            {flags.startBlockedReason && <p className="mt-4 text-sm text-gray-500">{flags.startBlockedReason}</p>}
            {flags.startWarning && flags.canStart && <p className="mt-3 text-xs text-amber-700">{flags.startWarning}</p>}
          </Card>
        )}

        {!cancelled && !isGroom && (noThreshold.length > 0 || noGroom.length > 0) && (
          <Notice tone="warning">
            {noThreshold.length > 0 && (
              <div className="flex gap-2">
                <HeartPulse size={16} className="mt-0.5 shrink-0" />
                <p>
                  <span className="font-semibold">{noThreshold.map((row) => row.horseName).join(', ')}</span> chưa được
                  bác sĩ đặt nhịp tim tối đa, quy tắc R1 sẽ không chạy trong buổi.{' '}
                  <Link to={links.heartRate} className="font-semibold underline-offset-2 hover:underline">
                    Bảng nhịp tim
                  </Link>
                </p>
              </div>
            )}
            {noGroom.length > 0 && (
              <p className={cn(noThreshold.length > 0 && 'mt-3')}>
                <span className="font-semibold">{noGroom.map((row) => row.horseName).join(', ')}</span> chưa có Groom
                dắt. {flags.canManage ? 'Chọn Groom cho riêng buổi này ở danh sách bên trái.' : 'HT của khu cần chọn Groom cho buổi.'}
              </p>
            )}
          </Notice>
        )}

        <Card variant="outline">
          <SectionTitle>Thông tin buổi</SectionTitle>
          <InfoRow label="Giáo án" value={detail.header.programName ?? '—'} />
          <InfoRow
            label="Giai đoạn"
            value={header.phaseName ? `${header.phaseName}${header.weekNo ? ` · tuần ${header.weekNo}` : ''}` : '—'}
          />
          <InfoRow label="HT phụ trách" value={header.trainerName ?? 'Chưa có'} />
          <InfoRow label="Khối lượng kế hoạch" value={`${detail.plannedVolumeM.toLocaleString('vi-VN')} m`} />
          {header.note && <InfoRow label="Ghi chú" value={header.note} />}
        </Card>
      </aside>

      <MarkAbsentModal
        open={!!absentFor}
        onClose={() => setAbsentFor(null)}
        sessionId={header.id}
        horse={absentFor ? { id: absentFor.horseId, name: absentFor.horseName } : undefined}
        byGroom={isGroom}
        onDone={onChanged}
      />
    </div>
  );
}

function HorseRow({
  row,
  detail,
  isGroom,
  onAbsent,
  onChanged,
}: {
  row: SessionHorseRow;
  detail: SessionDetail;
  isGroom: boolean;
  onAbsent: () => void;
  onChanged: () => void;
}) {
  const action = useAction();
  const toast = useToast();
  const absent = row.status === 'ABSENT';
  const sessionId = detail.header.id;

  const changeGroom = async (value: string) => {
    const done = await action.run(() => setSessionGroom(sessionId, row.horseId, value || null));
    if (done === undefined) return;
    toast.push(value ? `Đã đổi Groom dắt ${row.horseName} cho buổi này` : `${row.horseName} trở về Groom phụ trách`, 'success');
    onChanged();
  };

  const undoAbsent = async () => {
    const done = await action.run(() => clearAbsence(sessionId, row.horseId));
    if (done === undefined) return;
    toast.push(`${row.horseName} tham gia lại buổi này`, 'success');
    onChanged();
  };

  return (
    <div
      className={cn(
        'rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 transition sm:p-5',
        !absent && !row.readiness.allowed && 'shadow-[inset_3px_0_0_0_#ef4444]',
      )}
    >
      <div className="grid gap-4 md:grid-cols-12 md:items-start">
        <div className="flex items-center gap-3 md:col-span-4">
          <Avatar src={row.avatar} name={row.horseName} size={46} className={cn(absent && 'grayscale')} />
          <div className="min-w-0">
            <Link to={links.horse(row.horseId)} className="block truncate font-semibold text-gray-900 hover:text-emerald-700">
              {row.horseName}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {row.healthStatus !== 'ELIGIBLE' && <HealthPill status={row.healthStatus} />}
              {!isGroom && row.r1Disabled && !absent && (
                <span className="text-xs text-amber-700" title="Bác sĩ chưa đặt nhịp tim tối đa, quy tắc R1 không chạy">
                  R1 tắt, chưa đặt ngưỡng
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="md:col-span-4">
          {absent ? (
            <div className="space-y-1">
              <AttendancePill status="ABSENT" reason={row.absenceReason} />
              {row.absenceNote && <p className="text-sm text-gray-700">{row.absenceNote}</p>}
              <p className="text-xs text-gray-500 tabular-nums">
                {row.markedByName} · {formatDateTime(row.markedAt)}
              </p>
            </div>
          ) : (
            !row.readiness.allowed && (
              <EligibilityBadge allowed={false} reason={row.readiness.reason} label="Không được tập ở cường độ này" />
            )
          )}
        </div>

        <div className="md:col-span-4">
          <p className="mb-1 text-xs text-gray-500">Groom dắt buổi này</p>
          {row.canChangeGroom ? (
            <Select
              value={row.groomOverridden ? (row.groomId ?? '') : ''}
              disabled={action.pending}
              onChange={(event) => changeGroom(event.target.value)}
              className="py-2"
            >
              <option value="">
                {row.defaultGroomName ? `Mặc định: ${row.defaultGroomName}` : 'Chưa có Groom phụ trách'}
              </option>
              {detail.groomOptions
                .filter((option) => option.id !== row.defaultGroomId)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
            </Select>
          ) : (
            <p className={cn('text-sm font-medium', row.groomName ? 'text-gray-800' : 'text-amber-700')}>
              {row.groomName ?? 'Chưa có Groom dắt'}
              {row.groomOverridden && <span className="ml-1 text-xs font-normal text-gray-500">riêng buổi này</span>}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
        {absent ? (
          <span className="text-xs text-gray-500">Ngựa vắng không có việc chuẩn bị.</span>
        ) : (
          <GroomTaskChecklist
            sessionId={sessionId}
            horseId={row.horseId}
            tasks={row.tasks}
            readOnly={!row.canDoTasks}
            onChanged={onChanged}
          />
        )}
        <div className="flex gap-2">
          {row.canClearAbsence && (
            <Button size="sm" variant="secondary" onClick={undoAbsent} disabled={action.pending}>
              <RotateCcw size={13} /> Bỏ vắng
            </Button>
          )}
          {row.canMarkAbsent && (
            <Button size="sm" variant="inline" onClick={onAbsent}>
              {isGroom ? 'Báo không thực hiện được' : 'Đánh dấu vắng'}
            </Button>
          )}
        </div>
      </div>
      {action.error && (
        <Notice tone="danger" className="mt-3">
          {action.error}
        </Notice>
      )}
    </div>
  );
}
