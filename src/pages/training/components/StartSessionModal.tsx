// Bắt đầu buổi: chọn kịch bản mô phỏng thiết bị đeo (thuộc tính của buổi) và ngựa mục tiêu.
// Hệ thống kiểm tra lại "được tập" cho từng ngựa ngay lúc bấm; con không đạt được đánh dấu vắng.
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, HeartPulse, Play, ShieldAlert } from 'lucide-react';
import type { SimScenario } from '../../../types/domain';
import { Avatar, Button, Field, Modal, Notice, Select, cn } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';
import {
  startSession,
  type SessionHeader,
  type SessionHorseRow,
  type StartSessionResult,
} from '../../../services/session.service';
import { getSimSpeed } from '../../../lib/clock';
import { SCENARIO_OPTIONS, workoutText } from './session-helpers';

export default function StartSessionModal({
  open,
  onClose,
  header,
  horses,
  totalHorses,
  startWarning,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  header: SessionHeader;
  horses: SessionHorseRow[];
  totalHorses: number;
  startWarning?: string;
  onStarted: (result: StartSessionResult) => void;
}) {
  const action = useAction();
  const [scenario, setScenario] = useState<SimScenario>('NORMAL');
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (!open) return;
    setScenario('NORMAL');
    setTarget('');
    action.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const willRun = useMemo(() => horses.filter((row) => row.status !== 'ABSENT' && row.readiness.allowed), [horses]);
  const willBlock = useMemo(() => horses.filter((row) => row.status !== 'ABSENT' && !row.readiness.allowed), [horses]);
  const alreadyAbsent = useMemo(() => horses.filter((row) => row.status === 'ABSENT'), [horses]);
  const noThreshold = willRun.filter((row) => row.maxHeartRate === undefined);
  const option = SCENARIO_OPTIONS.find((item) => item.value === scenario);
  const targetRow = willRun.find((row) => row.horseId === target);
  const speed = getSimSpeed();

  const submit = async () => {
    const result = await action.run(() =>
      startSession(header.id, { scenario, targetHorseId: option?.targeted && target ? target : undefined }),
    );
    if (result === undefined) return;
    onClose();
    onStarted(result);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={`Bắt đầu buổi ${header.className}`}
      description={`${header.slotLabel} · ${workoutText(header)} · ${totalHorses} ngựa trong danh sách lớp`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || willRun.length === 0}>
            <Play size={15} /> {action.pending ? 'Đang bắt đầu…' : `Bắt đầu với ${willRun.length} ngựa`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {startWarning && (
          <Notice tone="warning" icon={<AlertTriangle size={16} />}>
            {startWarning}
          </Notice>
        )}

        {/* Kiểm tra lại từng ngựa */}
        <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl bg-emerald-50/60 p-4">
            <p className="text-sm font-semibold text-emerald-900">Sẽ tập ({willRun.length})</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {willRun.map((row) => (
                <span key={row.horseId} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-emerald-100">
                  <Avatar src={row.avatar} name={row.horseName} size={18} className="rounded-md" />
                  {row.horseName}
                  {row.maxHeartRate === undefined && <span className="text-amber-600">· R1 tắt</span>}
                </span>
              ))}
              {willRun.length === 0 && <span className="text-sm text-gray-500">Không còn ngựa nào đủ điều kiện.</span>}
            </div>
          </div>
          <div className={cn('rounded-xl p-4', willBlock.length + alreadyAbsent.length > 0 ? 'bg-orange-50/70' : 'bg-gray-50')}>
            <p className="text-sm font-semibold text-gray-800">Vắng ({willBlock.length + alreadyAbsent.length})</p>
            <ul className="mt-2 space-y-1.5 text-xs">
              {willBlock.map((row) => (
                <li key={row.horseId} className="text-orange-800">
                  <span className="font-semibold">{row.horseName}</span> — chặn y tế: {row.readiness.reason}
                </li>
              ))}
              {alreadyAbsent.map((row) => (
                <li key={row.horseId} className="text-gray-600">
                  <span className="font-semibold">{row.horseName}</span> — {row.absenceLabel}
                  {row.absenceNote ? `: ${row.absenceNote}` : ''}
                </li>
              ))}
              {willBlock.length + alreadyAbsent.length === 0 && <li className="text-gray-400">Không có ngựa vắng.</li>}
            </ul>
          </div>
        </div>

        {willBlock.length > 0 && (
          <Notice tone="warning" icon={<ShieldAlert size={16} />}>
            Lúc bấm Bắt đầu, hệ thống kiểm tra lại được tập cho từng ngựa. Ngựa không đạt được đánh dấu vắng
            (chặn y tế) kèm lý do — buổi vẫn chạy với các ngựa còn lại.
          </Notice>
        )}

        {/* Kịch bản */}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-600">Kịch bản thiết bị đeo (mô phỏng)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCENARIO_OPTIONS.map((item, index) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setScenario(item.value)}
                className={cn(
                  'rounded-xl px-3.5 py-3 text-left ring-1 transition',
                  index === SCENARIO_OPTIONS.length - 1 && 'sm:col-span-2',
                  scenario === item.value
                    ? 'bg-emerald-50 ring-2 ring-emerald-500'
                    : 'bg-white ring-gray-200 hover:ring-emerald-200',
                )}
              >
                <span className="block text-sm font-semibold text-gray-900">{item.label}</span>
                <span className="mt-0.5 block text-xs font-light text-gray-500">{item.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {option?.targeted && (
          <Field
            label="Ngựa gặp sự cố"
            hint="Kịch bản chỉ áp vào một ngựa, các ngựa khác chạy bình thường."
            error={action.field === 'targetHorseId' ? action.error : undefined}
          >
            <Select value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">Để hệ thống tự chọn</option>
              {willRun.map((row) => (
                <option key={row.horseId} value={row.horseId}>
                  {row.horseName}
                  {row.maxHeartRate === undefined ? ' — chưa đặt nhịp tim tối đa' : ` — ngưỡng ${row.maxHeartRate}`}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {scenario === 'HEART_OVER' && targetRow && targetRow.maxHeartRate === undefined && (
          <Notice tone="warning" icon={<HeartPulse size={16} />}>
            {targetRow.horseName} chưa được bác sĩ đặt nhịp tim tối đa nên quy tắc R1 không chạy — sẽ không có cảnh báo
            dù nhịp tim tăng cao.
          </Notice>
        )}

        {noThreshold.length > 0 && (
          <p className="text-xs text-amber-700">
            Chưa đặt nhịp tim tối đa: {noThreshold.map((row) => row.horseName).join(', ')} — R1 tắt với các ngựa này.
          </p>
        )}

        <p className="text-xs font-light text-gray-400">
          Tốc độ mô phỏng hiện tại ×{speed}. Kịch bản và hạt giống được lưu cùng buổi — ai mở màn hình theo dõi cũng thấy
          cùng số liệu.
        </p>

        {action.error && action.field !== 'targetHorseId' && <Notice tone="danger">{action.error}</Notice>}
      </div>
    </Modal>
  );
}
