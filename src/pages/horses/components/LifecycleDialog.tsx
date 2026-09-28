// F1.8 — đổi vòng đời, xóa và khôi phục hồ sơ: bắt buộc lý do, hiện bảng hệ quả trước khi xác nhận.
import { useEffect, useState } from 'react';
import { Ban, CircleCheck, ListChecks } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import {
  changeLifecycle,
  previewLifecycleChange,
  restoreHorse,
  softDeleteHorse,
  type LifecycleAction,
} from '../../../services/horse.service';
import { Button, ErrorBox, Field, Modal, Notice, Skeleton, Textarea, useToast } from '../../../components/ui';
import { lifecycleActionHint, lifecycleActionLabel } from './lifecycle';

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
  const preview = useService(
    () => (action ? previewLifecycleChange(horse.id, action) : Promise.resolve(undefined)),
    [horse.id, action],
  );

  useEffect(() => {
    setReason('');
    run.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const data = preview.data;
  const destructive = action === 'DELETE' || action === 'TRANSFERRED';

  const submit = async () => {
    if (!action) return;
    const done = await run.run(() => {
      if (action === 'DELETE') return softDeleteHorse(horse.id, reason);
      if (action === 'RESTORE') return restoreHorse(horse.id, reason);
      return changeLifecycle(horse.id, action, reason);
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
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={submit}
            disabled={!data?.allowed || !reason.trim() || run.pending}
          >
            {run.pending ? 'Đang xử lý…' : action ? `Xác nhận ${lifecycleActionLabel[action].toLowerCase()}` : 'Xác nhận'}
          </Button>
        </>
      }
    >
      {preview.loading || !data ? (
        <Skeleton rows={3} />
      ) : (
        <div className="space-y-5">
          {!data.allowed && data.reason && (
            <Notice tone="danger" icon={<Ban size={16} />}>
              <p className="font-semibold">{data.reason}</p>
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

          {data.allowed && data.consequences.length > 0 && (
            <div className="overflow-hidden rounded-xl ring-1 ring-amber-200/70">
              <div className="flex items-center gap-2 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900">
                <ListChecks size={15} /> Hệ quả sẽ được thực hiện trong một lần
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {data.consequences.map((item) => (
                    <tr key={item} className="border-t border-amber-100/80 bg-white">
                      <td className="w-8 py-2.5 pl-4 align-top">
                        <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-amber-400" />
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700">{item}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.allowed && (
            <Field label="Lý do" required hint="Lý do được ghi vào nhật ký vòng đời và nhật ký thao tác.">
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} autoFocus />
            </Field>
          )}
          {run.error && <ErrorBox message={run.error} />}
        </div>
      )}
    </Modal>
  );
}
