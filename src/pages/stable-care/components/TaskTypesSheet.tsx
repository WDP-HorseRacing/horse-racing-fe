// F4.3 — Quản lý CLB quản lý loại việc chăm sóc: thêm, đổi tên, bật tắt "Cho mọi ngựa", ngưng hoặc dùng lại.
// Không xóa được loại việc. Mọi thay đổi chỉ áp cho checklist sinh sau, checklist đã sinh giữ nguyên.
import { useState } from 'react';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { createTaskType, listTaskTypes, updateTaskType } from '../../../api/stable-care';
import type { ChecklistTaskType } from '../../../api/types';
import { Button, ErrorBox, Field, Input, Pill, Sheet, Skeleton, ToggleChip, cn, invalidClass, useToast } from '../../../components/ui';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { useAction, useService } from '../../../hooks/useService';
import { textError } from '../../../lib/stable-labels';

const MAX_NAME = 80;

export function TaskTypesSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const types = useService(() => listTaskTypes(), []);
  const action = useAction();
  const [name, setName] = useState('');
  const [all, setAll] = useState(true);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  // Lỗi tên khi đổi tên một dòng, hiện ngay dưới ô đổi tên.
  const [renameError, setRenameError] = useState<string>();
  // Loại việc vừa đổi: lỗi của BE (vd 409 còn ngựa được gắn thêm hoặc miễn) hiện ngay dòng đó.
  const [changedId, setChangedId] = useState<string | null>(null);
  const errors: Partial<Record<'name', string>> = { name: textError(name, { label: 'Tên loại việc', max: MAX_NAME }) };
  // Lỗi BE chỉ gắn vào ô Thêm khi lỗi đến từ thao tác Thêm, không phải từ đổi một dòng.
  const f = useFormErrors(errors, changedId ? undefined : { fieldErrors: action.fieldErrors, field: action.field, error: action.error });

  const add = () => {
    setChangedId(null);
    if (!f.attempt()) return;
    void action.run(
      () => createTaskType({ name: name.trim(), appliesToAll: all }),
      (created) => {
        toast.push(`Đã thêm loại việc ${created.name}`, 'success');
        setName('');
        f.reset();
        types.reload();
      },
    );
  };

  const change = (type: ChecklistTaskType, input: { name?: string; appliesToAll?: boolean; active?: boolean }, done: string) => {
    setChangedId(type.id);
    void action.run(
      () => updateTaskType(type.id, input),
      () => {
        toast.push(done, 'success');
        setEditing(null);
        types.reload();
      },
    );
  };

  const rename = (type: ChecklistTaskType) => {
    if (!editing) return;
    const error = textError(editing.name, { label: 'Tên loại việc', max: MAX_NAME });
    setRenameError(error);
    if (error) return;
    if (editing.name.trim() === type.name) {
      setEditing(null);
      return;
    }
    change(type, { name: editing.name.trim() }, `Đã đổi tên thành ${editing.name.trim()}`);
  };

  return (
    <Sheet open onClose={onClose} title="Loại việc chăm sóc" description="Thay đổi áp dụng từ ngày mai. Không dùng nữa thì bấm Ngưng dùng." dirty={name.trim() !== '' || !!editing} busy={action.pending} onSave={editing ? undefined : add} saveLabel="Thêm">
      <section className="rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-100">
        <p className="mb-2 text-sm font-semibold text-gray-900">Thêm loại việc</p>
        <div className="flex flex-wrap items-start gap-2">
          <Field name="name" error={f.show('name')} onBlur={f.blur('name')} className="min-w-0 flex-1">
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (action.error && !changedId) action.clearError();
              }}
              maxLength={MAX_NAME}
              aria-label="Tên loại việc"
              placeholder="Ví dụ: Chải lông, Kiểm tra móng hằng ngày"
              onKeyDown={(event) => event.key === 'Enter' && add()}
              className={cn(f.show('name') && invalidClass)}
            />
          </Field>
          <ToggleChip checked={all} onChange={setAll}>
            Cho mọi ngựa
          </ToggleChip>
          <Button onClick={add} disabled={action.pending}>
            <Plus size={15} /> Thêm
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">{all ? 'Ngựa nào cũng có việc này mỗi ngày. HLV khu miễn được cho từng ngựa (vd ngựa sốt không tắm).' : 'HLV khu tự thêm cho từng ngựa.'}</p>
      </section>

      {action.error && !changedId && !Object.keys(action.fieldErrors).length && (
        <div className="mt-3">
          <ErrorBox message={action.error} />
        </div>
      )}

      {types.loading && !types.data ? (
        <Skeleton rows={4} className="mt-4" />
      ) : types.error ? (
        <div className="mt-4">
          <ErrorBox message={types.error} />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {types.data?.map((type) => (
            <li key={type.id} className={cn('rounded-xl px-3 py-2.5 ring-1', type.active ? 'bg-white ring-gray-200/80' : 'bg-gray-50 ring-gray-100')}>
              <div className="flex flex-wrap items-center gap-2">
                {editing?.id === type.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editing.name}
                      maxLength={MAX_NAME}
                      aria-label="Tên mới"
                      onChange={(event) => {
                        setEditing({ id: type.id, name: event.target.value });
                        setRenameError(undefined);
                        if (action.error && changedId === type.id) action.clearError();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') rename(type);
                        if (event.key === 'Escape') setEditing(null);
                      }}
                      className={cn('h-9 min-w-0 flex-1', renameError && invalidClass)}
                    />
                    <Button variant="ghost" size="icon" title="Lưu" onClick={() => rename(type)} disabled={action.pending}>
                      <Check size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Hủy" onClick={() => {
                        setEditing(null);
                        setRenameError(undefined);
                      }}>
                      <X size={15} />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={cn('min-w-0 flex-1 truncate font-medium', type.active ? 'text-gray-900' : 'text-gray-400 line-through')}>{type.name}</span>
                    {!type.active && <Pill tone="gray">Ngưng dùng</Pill>}
                    <Button variant="ghost" size="icon" title="Đổi tên" onClick={() => {
                        setEditing({ id: type.id, name: type.name });
                        setRenameError(undefined);
                      }}>
                      <Pencil size={14} />
                    </Button>
                  </>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ToggleChip
                  checked={type.appliesToAll}
                  onChange={(next) => change(type, { appliesToAll: next }, `Đã lưu ${type.name}`)}
                >
                  Cho mọi ngựa
                </ToggleChip>
                <Button
                  variant={type.active ? 'inlineDanger' : 'inline'}
                  size="sm"
                  disabled={action.pending}
                  onClick={() => change(type, { active: !type.active }, type.active ? `Đã ngưng dùng ${type.name}` : `Đã dùng lại ${type.name}`)}
                >
                  {type.active ? 'Ngưng dùng' : 'Dùng lại'}
                </Button>
              </div>
              {editing?.id === type.id && renameError && (
                <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                  {renameError}
                </p>
              )}
              {action.error && changedId === type.id && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{action.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
