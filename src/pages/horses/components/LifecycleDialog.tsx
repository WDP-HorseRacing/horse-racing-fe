// F1.8 — đổi vòng đời, xóa và khôi phục hồ sơ: bắt buộc lý do, hiện bảng hệ quả (do backend tính) trước khi xác nhận.
// Ghi nhận ngựa mất lấy hôm nay làm ngày mất, và bị chặn khi ngựa còn bệnh án đang mở (bác sĩ đóng trước).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Ban, CircleCheck, ListChecks } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { changeLifecycle, deleteHorse, previewDeletion, previewLifecycle, previewRestore, restoreHorse } from '../../../api/horses';
import { Button, CancelButton, CharCount, ErrorBox, Field, Modal, Notice, Skeleton, Textarea, cn, invalidClass, useToast } from '../../../components/ui';
import { links } from '../../../lib/links';
import { formatMoney } from '../../../lib/format';
import { OwnerSelect } from './OwnerSelect';
import {
  destructiveActions,
  lifecycleActionConfirm,
  lifecycleActionDone,
  lifecycleActionHint,
  lifecycleActionLabel,
  lifecycleConsequences,
  type LifecycleAction,
} from './lifecycle';

interface PreviewView {
  allowed: boolean;
  blockedReason?: string;
  blockers: string[];
  summary?: string;
  consequences: string[];
  /** Kích hoạt lại ngựa đã chuyển nhượng: phải chọn chủ mới. */
  ownerRequired?: boolean;
}

async function loadPreview(horseId: string, action: LifecycleAction): Promise<PreviewView> {
  if (action === 'DELETE') {
    const data = await previewDeletion(horseId);
    const blockers = [
      ...(data.transferred ? ['Ngựa đã chuyển nhượng, hãy đổi vòng đời thay vì xóa'] : []),
      ...(data.deceased ? ['Ngựa đã mất, hồ sơ cần được giữ lại'] : []),
      ...(data.businessData.length ? [`Đã có dữ liệu: ${data.businessData.join(', ')}`] : []),
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
    if (data.rebilledDays > 0) {
      const fees = [`${formatMoney(data.rebilledDailyFee)} phí ngày`, ...(data.rebilledSurcharge ? [`${formatMoney(data.rebilledSurcharge)} phụ phí`] : [])].join(', ');
      lines.push(`Tính lại phí ${data.rebilledDays} ngày hồ sơ bị xóa: ${fees} cho ${data.rebilledOwnerName ?? 'mục Chưa có chủ'}`);
    }
    return { allowed: true, blockers: [], summary: data.summary, consequences: lines };
  }
  const data = await previewLifecycle(horseId, action);
  return {
    allowed: data.allowed,
    blockedReason: data.blockedReason ?? undefined,
    blockers: [],
    summary: data.summary ?? undefined,
    consequences: data.allowed ? lifecycleConsequences(data) : [],
    ownerRequired: data.ownerRequired,
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
  const [ownerId, setOwnerId] = useState('');
  const preview = useService(() => (action ? loadPreview(horse.id, action) : Promise.resolve(undefined)), [horse.id, action]);

  const data = preview.data;
  const deceased = action === 'DECEASED';
  const ownerRequired = !!data?.ownerRequired;
  const errors = useMemo(
    () => ({
      reason: !reason.trim() ? (deceased ? 'Nhập nguyên nhân' : 'Nhập lý do') : undefined,
      ownerId: ownerRequired && !ownerId ? 'Chọn chủ sở hữu mới' : undefined,
    }),
    [reason, deceased, ownerRequired, ownerId],
  );
  const f = useFormErrors(errors, { fieldErrors: run.fieldErrors, field: run.field, error: run.error });
  const { reset } = f;

  useEffect(() => {
    setReason('');
    setOwnerId('');
    run.clearError();
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const reasonError = f.show('reason');
  const ownerError = f.show('ownerId');
  const serverOnField = !!run.fieldErrors.reason || !!run.fieldErrors.ownerId || run.field === 'reason' || run.field === 'ownerId';
  const formError = run.error && !serverOnField ? run.error : undefined;
  // Bị chặn vì còn bệnh án: dẫn sang hồ sơ y tế để báo bác sĩ đóng bệnh án.
  const blockedByCase = !!data && !data.allowed && (action === 'TRANSFERRED' || deceased) && /bệnh án/i.test(data.blockedReason ?? '');

  const canSubmit = !!data?.allowed && !run.pending;

  const submit = async () => {
    if (!action || !canSubmit || !f.attempt()) return;
    const why = reason.trim();
    const done = await run.run(async () => {
      if (action === 'DELETE') await deleteHorse(horse.id, why);
      else if (action === 'RESTORE') await restoreHorse(horse.id, why);
      else await changeLifecycle(horse.id, { lifecycleStatus: action, reason: why, ownerId: ownerRequired ? ownerId : undefined });
      return true;
    });
    if (done) {
      toast.push(lifecycleActionDone[action](horse.name), 'success');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open={!!action}
      onClose={onClose}
      width="max-w-2xl"
      title={action ? `${lifecycleActionLabel[action]}: ${horse.name}` : ''}
      description={action ? lifecycleActionHint[action] : undefined}
      dirty={reason.trim() !== '' || ownerId !== ''}
      busy={run.pending}
      onSave={() => void submit()}
      saveLabel={action ? lifecycleActionConfirm[action] : 'Lưu'}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button variant={action && destructiveActions.has(action) ? 'danger' : 'primary'} onClick={submit} disabled={!canSubmit}>
            {run.pending ? 'Đang xử lý…' : action ? lifecycleActionConfirm[action] : 'Xác nhận'}
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
              {blockedByCase && (
                <Link to={links.horseMedical(horse.id)} className="mt-2 inline-flex items-center gap-1 font-semibold text-red-800 hover:underline">
                  Mở hồ sơ y tế <ArrowRight size={14} />
                </Link>
              )}
            </Notice>
          )}

          {data.allowed && action === 'DELETE' && (
            <Notice tone="success" icon={<CircleCheck size={16} />}>
              Hồ sơ chưa có dữ liệu nên xóa được.
            </Notice>
          )}

          {data.allowed && data.summary && <p className="text-sm text-gray-700">{data.summary}</p>}

          {data.allowed && data.consequences.length > 0 && (
            <div className="overflow-hidden rounded-xl bg-white shadow-[inset_3px_0_0_0_#f59e0b] ring-1 ring-gray-200">
              <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-900">
                <ListChecks size={15} className="text-gray-400" /> Những gì sẽ thay đổi
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

          {data.allowed && ownerRequired && (
            <Field label="Chủ sở hữu mới" name="ownerId" required error={ownerError} onBlur={f.blur('ownerId')} hint="Ngựa đã bán ra ngoài nên không còn chủ.">
              <OwnerSelect
                value={ownerId}
                invalid={!!ownerError}
                onChange={(id) => {
                  setOwnerId(id);
                  f.touch('ownerId');
                  if (run.fieldErrors.ownerId || run.field === 'ownerId') run.clearError();
                }}
              />
            </Field>
          )}

          {data.allowed && (
            <Field
              label={deceased ? 'Nguyên nhân' : 'Lý do'}
              name="reason"
              required
              error={reasonError}
              onBlur={f.blur('reason')}
              counter={<CharCount value={reason} max={500} />}
              hint={deceased ? 'Ví dụ: đau bụng cấp không qua khỏi.' : undefined}
            >
              <Textarea
                value={reason}
                maxLength={500}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (run.fieldErrors.reason || run.field === 'reason') run.clearError();
                }}
                className={cn(reasonError && invalidClass)}
                autoFocus
              />
            </Field>
          )}
          {formError && <ErrorBox message={formError} />}
        </div>
      )}
    </Modal>
  );
}
