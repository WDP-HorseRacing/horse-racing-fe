// Bàn giao công việc của một huấn luyện viên trưởng (Club Manager): mọi khu chuồng, mọi giáo án và mọi lớp đang chạy
// chuyển sang HLV nhận trong một lần. Lớp đã kết thúc giữ HLV cũ để tra lịch sử. Xem trước số lượng trước khi xác nhận.
import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { listBarns } from '../../api/stable';
import { handOverHeadTrainer, listClasses, listPlans } from '../../api/training';
import type { HandoverResult, UserAccount } from '../../api/types';
import { Button, CancelButton, ErrorBox, Field, Modal, Notice, Select, Skeleton, Stat, cn, invalidClass, useToast } from '../../components/ui';
import { useAction, useService } from '../../hooks/useService';

export default function HandoverDialog({ from, trainers, onClose, onDone }: { from: UserAccount; trainers: UserAccount[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const candidates = trainers.filter((user) => user.id !== from.id && user.role === 'HEAD_TRAINER' && user.status === 'ACTIVE');
  // Không chọn sẵn HLV nhận: người quản lý phải tự chọn.
  const [toId, setToId] = useState('');
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<HandoverResult | null>(null);
  const save = useAction();
  const preview = useService(async () => {
    const [barns, plans, classes] = await Promise.all([listBarns(), listPlans(), listClasses()]);
    return {
      barns: barns.filter((barn) => barn.headTrainerId === from.id),
      plans: plans.filter((plan) => plan.headTrainerId === from.id),
      classes: classes.filter((item) => item.headTrainerId === from.id && item.status === 'ACTIVE'),
    };
  }, [from.id]);
  const target = candidates.find((user) => user.id === toId);
  const nothing = preview.data && preview.data.barns.length + preview.data.plans.length + preview.data.classes.length === 0;
  const toError = touched && !toId ? 'Chọn huấn luyện viên trưởng nhận' : undefined;

  const submit = () => {
    setTouched(true);
    if (!toId || save.pending) return;
    void save.run(
      () => handOverHeadTrainer(from.id, toId),
      (done) => {
        toast.push(`Đã bàn giao công việc sang ${target?.fullName ?? 'HLV nhận'}`, 'success');
        setResult(done);
      },
    );
  };

  if (result) {
    return (
      <Modal
        open
        onClose={onDone}
        title="Đã bàn giao xong"
        footer={<Button onClick={onDone}>Đóng</Button>}
      >
        <p className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <Check size={16} className="text-emerald-700" /> {from.fullName} <ArrowRight size={14} /> {target?.fullName}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={result.barnsMoved} label="Khu chuồng" />
          <Stat value={result.plansMoved} label="Giáo án" />
          <Stat value={result.classesMoved} label="Lớp đang mở" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Bàn giao công việc của ${from.fullName}`}
      description="Chuyển một lần mọi khu chuồng, giáo án và lớp đang chạy sang huấn luyện viên trưởng khác."
      width="max-w-xl"
      dirty={toId !== ''}
      busy={save.pending}
      footer={
        <>
          <CancelButton />
          <Button disabled={save.pending || !!nothing || candidates.length === 0} onClick={submit}>
            {save.pending ? 'Đang bàn giao…' : 'Bàn giao'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <ErrorBox message={save.error} />}
        {candidates.length === 0 ? (
          <Notice tone="warning">Không có huấn luyện viên trưởng nào khác đang hoạt động để nhận bàn giao.</Notice>
        ) : (
          <Field label="Huấn luyện viên trưởng nhận" required name="toId" error={toError} onBlur={() => setTouched(true)}>
            <Select value={toId} onChange={(event) => setToId(event.target.value)} className={cn(toError && invalidClass)}>
              <option value="">Chọn HLV nhận…</option>
              {candidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {preview.loading && !preview.data ? (
          <Skeleton rows={2} />
        ) : preview.error ? (
          <ErrorBox message={preview.error} />
        ) : (
          preview.data && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Khu chuồng', items: preview.data.barns.map((barn) => barn.name) },
                  { label: 'Giáo án', items: preview.data.plans.map((plan) => plan.name) },
                  { label: 'Lớp đang chạy', items: preview.data.classes.map((item) => item.code) },
                ].map((group) => (
                  <div key={group.label} className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                    <p className="text-xs text-gray-500">{group.label}</p>
                    <p className="tabular-nums text-2xl font-bold">{group.items.length}</p>
                    {group.items.length > 0 && <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{group.items.join(', ')}</p>}
                  </div>
                ))}
              </div>
              {nothing ? (
                <Notice tone="info">{from.fullName} không còn khu, giáo án hay lớp mở nào. Có thể khóa tài khoản hoặc đổi vai trò ngay.</Notice>
              ) : (
                <Notice tone="warning">Lớp đã hoàn thành hoặc đã hủy vẫn giữ {from.fullName} để tra lịch sử.</Notice>
              )}
            </>
          )
        )}
      </div>
    </Modal>
  );
}
