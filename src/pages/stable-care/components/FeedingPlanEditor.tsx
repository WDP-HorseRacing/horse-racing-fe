// F4.2 — HLV khu lập hoặc sửa bản nháp khẩu phần cho một ngựa: 4 làn bữa, mỗi dòng một món (thức ăn hoặc thực phẩm bổ sung) và lượng.
// "Chép từ ngựa khác" điền sẵn các dòng từ khẩu phần đang áp dụng của ngựa cùng khu để sửa tiếp.
// Lưu nháp, hoặc lưu rồi áp dụng luôn (bản đang áp dụng cũ chuyển vào lịch sử). Kiểm hết ở đây trước khi gửi, lỗi hiện khi rời ô.
// Bản mới: tạo nháp xong mà áp dụng lỗi thì giữ bản vừa tạo, bấm lại sẽ thay và áp dụng chính bản đó (không tạo trùng).
import { useMemo, useRef, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { listAllHorses } from '../../../api/horses';
import { MEAL_ORDER, applyFeedingPlan, createFeedingPlan, listFeedingPlans, planLines, replaceFeedingPlan } from '../../../api/stable-care';
import { listSupplyItems } from '../../../api/supplies';
import type { FeedingMeal, FeedingPlan, FeedingPlanItemInput, SupplyItem } from '../../../api/types';
import { Button, CancelButton, ErrorBox, Field, Input, Modal, Select, Sheet, Skeleton, Textarea, cn, invalidClass, useToast } from '../../../components/ui';
import { QuantityInput } from './QuantityInput';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { useAction, useService } from '../../../hooks/useService';
import { errorMessage } from '../../../lib/errors';
import { FEEDING_CATEGORIES, mealText, parseQuantity, quantityError, quantityText, supplyCategoryText, textError } from '../../../lib/stable-labels';

const MAX_LINES = 50;
const MAX_QUANTITY = 1_000_000;

interface Line {
  key: number;
  meal: FeedingMeal;
  supplyItemId: string;
  quantity: string;
  note: string;
}

let nextKey = 1;
const toLine = (input: FeedingPlanItemInput): Line => ({ key: nextKey++, meal: input.meal, supplyItemId: input.supplyItemId, quantity: quantityText(input.quantity), note: input.note ?? '' });
/** So nội dung đang nhập với lúc mở để biết có thay đổi chưa lưu. */
const contentKey = (lines: Line[], note: string) => JSON.stringify([lines.map(({ meal, supplyItemId, quantity, note: lineNote }) => [meal, supplyItemId, quantity, lineNote]), note]);

export function FeedingPlanEditor({
  horse,
  draft,
  onClose,
  onSaved,
}: {
  horse: { id: string; name: string; barnId?: string | null };
  /** Sửa bản nháp này. Không có thì lập bản mới. */
  draft?: FeedingPlan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const supplies = useService(async () => (await listSupplyItems()).filter((item) => FEEDING_CATEGORIES.includes(item.category)), []);
  const [lines, setLines] = useState<Line[]>(() => (draft ? planLines(draft).map(toLine) : []));
  const [note, setNote] = useState(draft?.note ?? '');
  // Bản nháp đã tạo ở lần bấm trước (áp dụng bị lỗi): lần sau thay bản này thay vì tạo mới.
  const [created, setCreated] = useState<FeedingPlan>();
  const [copying, setCopying] = useState(false);
  const [mode, setMode] = useState<'draft' | 'apply'>('draft');
  const list = useRef<HTMLDivElement>(null);
  const [openedKey] = useState(() => contentKey(lines, note));
  const dirty = contentKey(lines, note) !== openedKey;

  const byId = useMemo(() => new Map((supplies.data ?? []).map((item) => [item.id, item])), [supplies.data]);
  // Dòng của bản nháp còn trỏ tới vật tư đã xóa: giữ tên để HLV thấy và đổi.
  const draftNames = useMemo(() => new Map(draft?.meals.flatMap((meal) => meal.items.map((item) => [item.supplyItemId, `${item.name} (${item.unit})`] as const)) ?? []), [draft]);

  const lineErrors = (line: Line) => {
    const supply = line.supplyItemId ? byId.get(line.supplyItemId) : undefined;
    const duplicate = line.supplyItemId && lines.some((other) => other.key !== line.key && other.meal === line.meal && other.supplyItemId === line.supplyItemId);
    return {
      supply: !line.supplyItemId ? 'Chọn món' : supplies.data && !supply ? 'Vật tư đã ngừng dùng, chọn món khác' : duplicate ? `Bữa ${mealText[line.meal].toLowerCase()} đã có món này` : undefined,
      quantity: quantityError(line.quantity, { label: 'Lượng', max: MAX_QUANTITY }),
      note: textError(line.note, { label: 'Ghi chú', max: 200, required: false }),
    };
  };
  // Khóa mỗi ô của dòng theo key dòng, ví dụ quantity-3. Ghi chú khẩu phần dùng khóa note trùng tên ô của BE.
  const errors: Record<string, string | undefined> = {
    count: lines.length === 0 ? 'Thêm ít nhất một món' : lines.length > MAX_LINES ? `Tối đa ${MAX_LINES} món` : undefined,
    note: textError(note, { label: 'Ghi chú', max: 500, required: false }),
  };
  for (const line of lines) {
    const lineError = lineErrors(line);
    errors[`supply-${line.key}`] = lineError.supply;
    errors[`quantity-${line.key}`] = lineError.quantity;
    errors[`note-${line.key}`] = lineError.note;
  }
  const f = useFormErrors(errors, { fieldErrors: action.fieldErrors, field: action.field, error: action.error });

  const addLine = (meal: FeedingMeal) => {
    const used = new Set(lines.filter((line) => line.meal === meal).map((line) => line.supplyItemId));
    const first = (supplies.data ?? []).find((item) => !used.has(item.id));
    setLines((current) => [...current, { key: nextKey++, meal, supplyItemId: first?.id ?? '', quantity: '', note: '' }]);
  };
  const update = (key: number, patch: Partial<Line>) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const removeLine = (key: number) => setLines((current) => current.filter((line) => line.key !== key));

  const submit = (next: 'draft' | 'apply') => {
    setMode(next);
    if (!f.attempt(list.current ?? undefined)) return;
    const items: FeedingPlanItemInput[] = MEAL_ORDER.flatMap((meal) =>
      lines
        .filter((line) => line.meal === meal)
        .map((line) => ({ meal, supplyItemId: line.supplyItemId, quantity: parseQuantity(line.quantity), ...(line.note.trim() ? { note: line.note.trim() } : {}) })),
    );
    void action.run(
      async () => {
        const target = draft ?? created;
        let saved: FeedingPlan;
        if (target) saved = await replaceFeedingPlan(target.id, items, note.trim() || null);
        else {
          saved = await createFeedingPlan(horse.id, items, note.trim() || undefined);
          // Giữ ngay bản vừa tạo: áp dụng lỗi thì lần bấm sau không tạo thêm bản nháp trùng.
          setCreated(saved);
          onSaved();
        }
        if (next === 'apply') await applyFeedingPlan(saved.id);
        return saved;
      },
      () => {
        toast.push(next === 'apply' ? `Đã áp dụng khẩu phần mới cho ${horse.name}` : 'Đã lưu nháp', 'success');
        onSaved();
        onClose();
      },
    );
  };

  const copyFrom = (source: FeedingPlan) => {
    setLines(planLines(source).map(toLine));
    setCopying(false);
    toast.push(`Đã chép ${planLines(source).length} món từ ${source.horseName}`, 'info');
  };

  const options = supplies.data ?? [];

  return (
    <Sheet
      open
      onClose={onClose}
      width="max-w-3xl"
      title={draft ? `Sửa khẩu phần: ${horse.name}` : `Lập khẩu phần: ${horse.name}`}
      description="Không cần đủ cả 4 bữa."
      dirty={dirty}
      busy={action.pending}
      onSave={() => submit('draft')}
      saveLabel="Lưu nháp"
      footer={
        <>
          <CancelButton />
          <Button variant="secondary" onClick={() => submit('draft')} disabled={action.pending}>
            {action.pending && mode === 'draft' ? 'Đang lưu…' : 'Lưu nháp'}
          </Button>
          <Button onClick={() => submit('apply')} disabled={action.pending}>
            {action.pending && mode === 'apply' ? 'Đang áp dụng…' : 'Áp dụng'}
          </Button>
        </>
      }
    >
      {supplies.loading && !supplies.data ? (
        <Skeleton rows={5} />
      ) : supplies.error ? (
        <ErrorBox message={supplies.error} />
      ) : (
        <div ref={list} className="space-y-4">
          {options.length === 0 && <ErrorBox message="Kho chưa có thức ăn. Nhờ Quản lý CLB thêm vào kho." />}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-600">
              {lines.length} món{f.show('count') ? (
                <span role="alert" data-invalid="true" className="ml-2 font-medium text-red-600">
                  {f.show('count')}
                </span>
              ) : null}
            </p>
            <Button variant="inline" size="sm" onClick={() => setCopying(true)}>
              <Copy size={13} /> Chép từ ngựa khác
            </Button>
          </div>

          {MEAL_ORDER.map((meal) => {
            const mealLines = lines.filter((line) => line.meal === meal);
            return (
              <section key={meal} className={cn('rounded-2xl p-3 ring-1', mealLines.length ? 'bg-white ring-gray-200/80' : 'bg-gray-50/60 ring-gray-100')}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">{mealText[meal]}</h3>
                  <Button variant="ghost" size="sm" onClick={() => addLine(meal)} disabled={options.length === 0 || lines.length >= MAX_LINES}>
                    <Plus size={14} /> Thêm món
                  </Button>
                </div>
                {mealLines.length === 0 ? (
                  <p className="text-xs text-gray-400">Bữa này không cho ăn</p>
                ) : (
                  <div className="space-y-2">
                    {mealLines.map((line) => {
                      const supply = byId.get(line.supplyItemId);
                      const supplyKey = `supply-${line.key}`;
                      const quantityKey = `quantity-${line.key}`;
                      const noteKey = `note-${line.key}`;
                      return (
                        <div key={line.key} className="grid gap-2 sm:grid-cols-12">
                          <Field name={supplyKey} error={f.show(supplyKey)} onBlur={f.blur(supplyKey)} className="sm:col-span-5">
                            <Select
                              value={line.supplyItemId}
                              onChange={(event) => update(line.key, { supplyItemId: event.target.value })}
                              onBlur={f.blur(supplyKey)}
                              aria-label="Món"
                              className={cn(f.show(supplyKey) && invalidClass)}
                            >
                              <option value="">Chọn món…</option>
                              {line.supplyItemId && !supply && <option value={line.supplyItemId}>{draftNames.get(line.supplyItemId) ?? 'Vật tư đã xóa'} · đã ngừng dùng</option>}
                              {options.map((item: SupplyItem) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.unit}) · {supplyCategoryText[item.category]}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field name={quantityKey} error={f.show(quantityKey)} onBlur={f.blur(quantityKey)} className="sm:col-span-3">
                            <div className="relative">
                              <QuantityInput
                                value={line.quantity}
                                onChange={(quantity) => update(line.key, { quantity })}
                                placeholder="Lượng"
                                aria-label="Lượng"
                                className={cn('pr-12', f.show(quantityKey) && invalidClass)}
                              />
                              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">{supply?.unit}</span>
                            </div>
                          </Field>
                          <Field name={noteKey} error={f.show(noteKey)} onBlur={f.blur(noteKey)} className="sm:col-span-3">
                            <Input
                              value={line.note}
                              onChange={(event) => update(line.key, { note: event.target.value })}
                              placeholder="Ghi chú"
                              aria-label="Ghi chú món"
                              maxLength={200}
                              className={cn(f.show(noteKey) && invalidClass)}
                            />
                          </Field>
                          <div className="flex justify-end sm:col-span-1">
                            <Button variant="ghost" size="icon" title="Bỏ món" onClick={() => removeLine(line.key)}>
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          <Field label="Ghi chú" name="note" error={f.show('note')} onBlur={f.blur('note')}>
            <Textarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                if (action.error) action.clearError();
              }}
              placeholder="Ví dụ: Giảm tinh bột tuần thi đấu, uống đủ nước sau buổi tập"
              className={cn(f.show('note') && invalidClass)}
            />
          </Field>
          {mode === 'apply' && <p className="text-xs text-gray-500">Khẩu phần cũ sẽ chuyển vào lịch sử.</p>}
          {created && !draft && action.error && <p className="text-xs text-gray-500">Bản nháp đã lưu. Bấm Áp dụng lần nữa để thử lại.</p>}
          {action.error && !action.fieldErrors.note && <ErrorBox message={action.error} />}
        </div>
      )}
      {copying && <CopyFromHorse horse={horse} onClose={() => setCopying(false)} onPick={copyFrom} hasLines={lines.length > 0} />}
    </Sheet>
  );
}

/** Chọn ngựa cùng khu đang có khẩu phần áp dụng để chép các dòng. */
function CopyFromHorse({ horse, hasLines, onClose, onPick }: { horse: { id: string; barnId?: string | null }; hasLines: boolean; onClose: () => void; onPick: (plan: FeedingPlan) => void }) {
  const horses = useService(async () => (await listAllHorses({ myBarns: true })).filter((item) => item.id !== horse.id && (!horse.barnId || item.location.barn?.id === horse.barnId)), [horse.id, horse.barnId]);
  const [picking, setPicking] = useState<string>();
  const [error, setError] = useState<string>();

  const pick = async (horseId: string) => {
    setPicking(horseId);
    setError(undefined);
    try {
      const [active] = await listFeedingPlans(horseId, 'ACTIVE');
      if (!active) setError('Ngựa này chưa có khẩu phần đang áp dụng');
      else onPick(active);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPicking(undefined);
    }
  };

  return (
    <Modal open onClose={onClose} title="Chép từ ngựa khác" description={hasLines ? 'Các món đang nhập sẽ bị thay.' : 'Chọn một ngựa cùng khu.'}>
      {horses.loading && !horses.data ? (
        <Skeleton rows={3} />
      ) : horses.error ? (
        <ErrorBox message={horses.error} />
      ) : horses.data?.length === 0 ? (
        <p className="text-sm text-gray-500">Khu này chưa có ngựa nào khác.</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {horses.data?.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={!!picking}
                onClick={() => void pick(item.id)}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-emerald-50 disabled:opacity-60"
              >
                <span className="font-medium text-gray-900">{item.name}</span>
                <span className="text-xs text-gray-500">{picking === item.id ? 'Đang tải…' : item.location.stall?.code ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-sm text-amber-800">{error}</p>}
    </Modal>
  );
}
