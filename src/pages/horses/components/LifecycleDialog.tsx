// F1.8 — đổi vòng đời, xóa và khôi phục hồ sơ: bắt buộc lý do, hiện bảng hệ quả (do backend tính) trước khi xác nhận.
import { useEffect, useState } from 'react';
import { Ban, CircleCheck, ListChecks } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import { changeLifecycle, deleteHorse, previewDeletion, previewLifecycle, previewRestore, restoreHorse } from '../../../api/horses';
import type { LifecyclePreview } from '../../../api/types';
import { Button, ErrorBox, Field, Modal, Notice, Skeleton, Textarea, useToast } from '../../../components/ui';
import { healthLabel } from '../../../lib/labels';
import { lifecycleActionHint, lifecycleActionLabel, type LifecycleAction } from './lifecycle';

interface PreviewView {
  allowed: boolean;
  blockedReason?: string;
  blockers: string[];
  summary?: string;
  consequences: string[];
}

function lifecycleConsequences(data: LifecyclePreview): string[] {
  const lines: string[] = [];
  if (data.classesWithdrawn) lines.push(`Rút khỏi ${data.classesWithdrawn} lớp đang học (buổi đã học giữ lịch sử)`);
  if (data.raceRegistrationsWithdrawn) lines.push(`Rút ${data.raceRegistrationsWithdrawn} đăng ký thi đấu chưa diễn ra`);
  if (data.stallReleased) lines.push(`Trả ô ${data.stallReleased} về trống`);
  if (data.barnCleared) lines.push(`Rời ${data.barnCleared}`);
  if (data.groomEnded) lines.push(`Kết thúc phân công Groom ${data.groomEnded} (Groom nhận thông báo)`);
  if (data.trainingLockReleased) lines.push('Tự gỡ lệnh khóa huấn luyện với ghi chú "Gỡ do chuyển nhượng"');
  if (data.examRequestsDismissed) lines.push(`Bỏ qua ${data.examRequestsDismissed} yêu cầu khám đang chờ (lý do "Do chuyển nhượng")`);
  if (data.careSchedulesCancelled) lines.push(`Hủy ${data.careSchedulesCancelled} lịch chăm sóc và lịch hẹn khám đã lên`);
  if (data.healthResetTo) lines.push(`Sức khỏe đặt về "${healthLabel[data.healthResetTo]}"`);
  if (data.pendingBarnAfter) lines.push('Ngựa vào danh sách Chờ xếp khu');
  if (data.ownerCleared) lines.push(`Bỏ trống chủ sở hữu ${data.ownerCleared} (tài khoản không còn là chủ ngựa đang hoạt động)`);
  if (data.to === 'TRANSFERRED') lines.push('Hồ sơ chuyển sang chỉ đọc, giữ tên chủ hiện tại');
  if (data.to === 'RETIRED' && lines.length === 0) lines.push('Giữ khu, ô, Groom và toàn bộ dữ liệu y tế');
  return lines;
}

async function loadPreview(horseId: string, action: LifecycleAction): Promise<PreviewView> {
  if (action === 'DELETE') {
    const data = await previewDeletion(horseId);
    const blockers = [
      ...(data.transferred ? ['Ngựa đã chuyển nhượng — đổi vòng đời thay vì xóa'] : []),
      ...(data.businessData.length ? [`Đã có dữ liệu nghiệp vụ: ${data.businessData.join(', ')}`] : []),
      ...(data.isParent ? ['Ngựa đang là cha hoặc mẹ trong phả hệ của ngựa khác'] : []),
    ];
    return {
      allowed: data.allowed,
      blockedReason: data.allowed ? undefined : 'Không xóa được hồ sơ này',
      blockers,
      consequences: data.allowed ? ['Hồ sơ ẩn khỏi mọi vai trò, trừ Quản lý câu lạc bộ', 'Số chip vẫn được giữ, không dùng lại được'] : [],
    };
  }
  if (action === 'RESTORE') {
    const data = await previewRestore(horseId);
    const lines = ['Hồ sơ trở lại danh sách, giữ vòng đời, sức khỏe và phả hệ'];
    if (data.barnCleared) lines.push(`Rời ${data.barnCleared}, vào danh sách Chờ xếp khu`);
    else lines.push('Ngựa vào danh sách Chờ xếp khu');
    if (data.ownerCleared) lines.push(`Bỏ trống chủ sở hữu ${data.ownerCleared} (tài khoản không còn là chủ ngựa đang hoạt động)`);
    return { allowed: true, blockers: [], summary: data.summary, consequences: lines };
  }
  const data = await previewLifecycle(horseId, action);
  return {
    allowed: data.allowed,
    blockedReason: data.blockedReason ?? undefined,
    blockers: [],
    summary: data.summary ?? undefined,
    consequences: data.allowed ? lifecycleConsequences(data) : [],
  };
}

export default function LifecycleDialog({
  horse,
  action,
  onClose,
  onDone,
}: {
  horse: { id: string; name: string };
  action: LifecycleAction | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const run = useAction();
  const [reason, setReason] = useState('');
  const preview = useService(() => (action ? loadPreview(horse.id, action) : Promise.resolve(undefined)), [horse.id, action]);

  useEffect(() => {
    setReason('');
    run.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const data = preview.data;
  const destructive = action === 'DELETE' || action === 'TRANSFERRED';

  const submit = async () => {
    if (!action) return;
    const why = reason.trim();
    const done = await run.run(async () => {
      if (action === 'DELETE') await deleteHorse(horse.id, why);
      else if (action === 'RESTORE') await restoreHorse(horse.id, why);
      else await changeLifecycle(horse.id, action, why);
      return true;
    });
    if (done) {
      toast.push(`${lifecycleActionLabel[action]}: ${horse.name} — đã thực hiện`, 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!action}
      onClose={onClose}
      width="max-w-2xl"
      title={action ? `${lifecycleActionLabel[action]} — ${horse.name}` : ''}
      description={action ? lifecycleActionHint[action] : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={submit} disabled={!data?.allowed || !reason.trim() || run.pending}>
            {run.pending ? 'Đang xử lý…' : action ? `Xác nhận ${lifecycleActionLabel[action].toLowerCase()}` : 'Xác nhận'}
          </Button>
        </>
      }
    >
      {preview.error ? (
        <ErrorBox message={preview.error} />
      ) : preview.loading || !data ? (
        <Skeleton rows={3} />
      ) : (
        <div className="space-y-5">
          {!data.allowed && (
            <Notice tone="danger" icon={<Ban size={16} />}>
              <p className="font-semibold">{data.blockedReason ?? 'Không thực hiện được thao tác này'}</p>
              {data.blockers.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {data.blockers.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-red-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </Notice>
          )}

          {data.allowed && action === 'DELETE' && (
            <Notice tone="success" icon={<CircleCheck size={16} />}>
              Hồ sơ chưa phát sinh dữ liệu nghiệp vụ nào, có thể xóa.
            </Notice>
          )}

          {data.allowed && data.summary && <p className="text-sm text-gray-700">{data.summary}</p>}

          {data.allowed && data.consequences.length > 0 && (
            <div className="overflow-hidden rounded-xl bg-white shadow-[inset_3px_0_0_0_#f59e0b] ring-1 ring-gray-200">
              <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-900">
                <ListChecks size={15} className="text-gray-400" /> Hệ quả sẽ được thực hiện trong một lần
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {data.consequences.map((item) => (
                    <tr key={item} className="border-t border-gray-100">
                      <td className="w-8 py-2.5 pl-4 align-top">
                        <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-gray-400" />
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700">{item}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.allowed && (
            <Field label="Lý do" required hint="Lý do được lưu trên hồ sơ và ghi vào nhật ký thao tác.">
              <Textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} autoFocus />
            </Field>
          )}
          {run.error && <ErrorBox message={run.error} />}
        </div>
      )}
    </Modal>
  );
}
