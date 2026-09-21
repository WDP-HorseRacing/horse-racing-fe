import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import {
  activateReferenceHorse,
  createReferenceHorse,
  getPedigree,
  listHorseOptions,
  setParent,
  type PedigreeNode,
} from '../../../services/horse.service';
import { useStore } from '../../../store/store';
import { can } from '../../../auth/permissions';
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  Pill,
  Select,
  Skeleton,
} from '../../../components/ui';
import { sexLabel } from '../../../lib/labels';
import type { HorseSex } from '../../../types/domain';

function Node({ node, role, depth }: { node?: PedigreeNode; role: string; depth: number }) {
  if (!node) {
    return (
      <div className="flex min-h-[72px] flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3 text-center text-xs font-light text-gray-400">
        Chưa khai báo {role.toLowerCase()}
      </div>
    );
  }
  return (
    <Link
      to={`/horses/${node.id}`}
      className={`flex min-h-[72px] flex-1 flex-col justify-center rounded-xl border px-3 py-2 transition hover:border-emerald-200 hover:bg-emerald-50/40 ${
        depth === 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-100 bg-white'
      }`}
    >
      <span className="text-[11px] font-semibold tracking-wide text-gray-300">{role}</span>
      <span className="truncate text-sm font-semibold text-gray-900">{node.name}</span>
      <span className="text-xs text-gray-400">
        {sexLabel[node.sex]}
        {node.birthYear ? ` · ${node.birthYear}` : ''}
      </span>
      {node.isReference && (
        <span className="mt-1">
          <Pill tone="gray">Tham chiếu</Pill>
        </span>
      )}
    </Link>
  );
}

export default function PedigreeTab({ horseId, onChanged }: { horseId: string; onChanged: () => void }) {
  const currentUser = useStore((state) => state.currentUser);
  const editable = can(currentUser, 'pedigree.edit');
  const { data, loading, reload } = useService(() => getPedigree(horseId), [horseId]);
  const options = useService(() => listHorseOptions(), []);
  const action = useAction();

  const [assignOpen, setAssignOpen] = useState<'sire' | 'dam' | null>(null);
  const [selected, setSelected] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newHorse, setNewHorse] = useState({ name: '', sex: 'MALE' as HorseSex, birthDate: '' });

  if (loading) return <Skeleton rows={4} />;
  if (!data) return <EmptyState title="Chưa có dữ liệu phả hệ" />;

  const refresh = () => {
    reload();
    options.reload();
    onChanged();
  };

  const submitParent = async () => {
    const done = await action.run(() => setParent(horseId, assignOpen!, selected || undefined));
    if (done !== undefined) {
      setAssignOpen(null);
      setSelected('');
      refresh();
    }
  };

  const submitReference = async () => {
    const created = await action.run(() => createReferenceHorse(newHorse));
    if (created) {
      setCreateOpen(false);
      setNewHorse({ name: '', sex: 'MALE', birthDate: '' });
      refresh();
    }
  };

  const candidates = (role: 'sire' | 'dam') =>
    (options.data ?? []).filter((horse) =>
      role === 'sire' ? horse.sex !== 'FEMALE' : horse.sex === 'FEMALE',
    ).filter((horse) => horse.id !== horseId);

  return (
    <div className="space-y-5">
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAssignOpen('sire')}>
            <Plus size={14} /> Đặt ngựa bố
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAssignOpen('dam')}>
            <Plus size={14} /> Đặt ngựa mẹ
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>
            Tạo ngựa tham chiếu
          </Button>
        </div>
      )}

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex">
            <Node node={data} role="Ngựa" depth={0} />
          </div>

          <div className="flex flex-col gap-3">
            <Node node={data.sire} role="Bố" depth={1} />
            <Node node={data.dam} role="Mẹ" depth={1} />
          </div>

          <div className="flex flex-col gap-3">
            <Node node={data.sire?.sire} role="Ông nội" depth={2} />
            <Node node={data.sire?.dam} role="Bà nội" depth={2} />
            <Node node={data.dam?.sire} role="Ông ngoại" depth={2} />
            <Node node={data.dam?.dam} role="Bà ngoại" depth={2} />
          </div>
        </div>
      </Card>

      {editable && data.isReference && (
        <Card tone="success">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">Kích hoạt thành ngựa của câu lạc bộ</p>
              <p className="mt-0.5 text-sm text-gray-600">
                Dùng khi câu lạc bộ mua lại con ngựa này. Sau khi kích hoạt, hãy xếp chuồng và gán chủ sở hữu.
              </p>
            </div>
            <Button
              onClick={async () => {
                const done = await action.run(() => activateReferenceHorse(horseId));
                if (done !== undefined) refresh();
              }}
            >
              <Sparkles size={15} /> Kích hoạt
            </Button>
          </div>
        </Card>
      )}

      {action.error && <ErrorBox message={action.error} />}

      <Modal
        open={assignOpen !== null}
        onClose={() => setAssignOpen(null)}
        title={assignOpen === 'sire' ? 'Đặt ngựa bố' : 'Đặt ngựa mẹ'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignOpen(null)}>
              Quay lại
            </Button>
            <Button onClick={submitParent} disabled={action.pending}>
              {action.pending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </>
        }
      >
        <Field
          label={assignOpen === 'sire' ? 'Chọn ngựa bố' : 'Chọn ngựa mẹ'}
          hint={
            assignOpen === 'sire'
              ? 'Chỉ ngựa đực hoặc đực đã thiến, phải sinh trước con.'
              : 'Chỉ ngựa cái, phải sinh trước con.'
          }
          error={action.error}
        >
          <Select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">— Gỡ liên kết —</option>
            {assignOpen &&
              candidates(assignOpen).map((horse) => (
                <option key={horse.id} value={horse.id}>
                  {horse.name} {horse.isReference ? '(tham chiếu)' : ''}
                </option>
              ))}
          </Select>
        </Field>
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo ngựa tham chiếu"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Quay lại
            </Button>
            <Button onClick={submitReference} disabled={action.pending}>
              {action.pending ? 'Đang lưu…' : 'Tạo'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Ngựa tham chiếu chỉ là nút trên cây phả hệ: không có chuồng, chủ sở hữu, giáo án hay dữ liệu y tế.
          </p>
          <Field label="Tên ngựa" required error={action.field === 'name' ? action.error : undefined}>
            <Input value={newHorse.name} onChange={(event) => setNewHorse({ ...newHorse, name: event.target.value })} />
          </Field>
          <Field label="Giới tính" required>
            <Select
              value={newHorse.sex}
              onChange={(event) => setNewHorse({ ...newHorse, sex: event.target.value as HorseSex })}
            >
              {Object.entries(sexLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ngày sinh">
            <Input
              type="date"
              value={newHorse.birthDate}
              onChange={(event) => setNewHorse({ ...newHorse, birthDate: event.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
