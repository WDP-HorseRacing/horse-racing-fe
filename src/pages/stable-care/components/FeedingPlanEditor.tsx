// F4.2 — HLV khu lập hoặc sửa bản nháp khẩu phần cho một ngựa: 4 làn bữa, mỗi dòng một món (thức ăn hoặc thực phẩm bổ sung) và lượng.
// "Sao từ ngựa khác" điền sẵn các dòng từ khẩu phần đang áp dụng của ngựa cùng khu để sửa tiếp.
// Lưu nháp, hoặc lưu rồi áp dụng luôn (bản đang áp dụng cũ chuyển vào lịch sử). Kiểm hết ở đây vì câu lỗi validate của BE còn tiếng Anh.
import { useMemo, useRef, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { listAllHorses } from '../../../api/horses';
import { MEAL_ORDER, applyFeedingPlan, createFeedingPlan, listFeedingPlans, planLines, replaceFeedingPlan } from '../../../api/stable-care';
import { listSupplyItems } from '../../../api/supplies';
import type { FeedingMeal, FeedingPlan, FeedingPlanItemInput, SupplyItem } from '../../../api/types';
import { Button, ErrorBox, Field, Input, Modal, Select, Sheet, Skeleton, Textarea, cn, useToast } from '../../../components/ui';
import { useAction, useService } from '../../../hooks/useService';
import { errorMessage } from '../../../lib/errors';
import { FEEDING_CATEGORIES, mealText, parseQuantity, quantityError, supplyCategoryText, textError } from '../../../lib/stable-labels';

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
const toLine = (input: FeedingPlanItemInput): Line => ({ key: nextKey++, meal: input.meal, supplyItemId: input.supplyItemId, quantity: String(input.quantity), note: input.note ?? '' });

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
  const [touched, setTouched] = useState(false);
  const [copying, setCopying] = useState(false);
  const [mode, setMode] = useState<'draft' | 'apply'>('draft');
  const list = useRef<HTMLDivElement>(null);

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
  const errors = lines.map((line) => ({ key: line.key, ...lineErrors(line) }));
  const hasLineErrors = errors.some((entry) => entry.supply || entry.quantity || entry.note);
  const noteError = textError(note, { label: 'Ghi chú', max: 500, required: false });
  const countError = lines.length === 0 ? 'Thêm ít nhất một món' : lines.length > MAX_LINES ? `Tối đa ${MAX_LINES} món` : undefined;

  const addLine = (meal: FeedingMeal) => {
    const used = new Set(lines.filter((line) => line.meal === meal).map((line) => line.supplyItemId));
    const first = (supplies.data ?? []).find((item) => !used.has(item.id));
    setLines((current) => [...current, { key: nextKey++, meal, supplyItemId: first?.id ?? '', quantity: '', note: '' }]);
  };
  const update = (key: number, patch: Partial<Line>) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const removeLine = (key: number) => setLines((current) => current.filter((line) => line.key !== key));

  const submit = (next: 'draft' | 'apply') => {
    setTouched(true);
    setMode(next);
    if (countError || hasLineErrors || noteError) {
      list.current?.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const items: FeedingPlanItemInput[] = MEAL_ORDER.flatMap((meal) =>
      lines
        .filter((line) => line.meal === meal)
        .map((line) => ({ meal, supplyItemId: line.supplyItemId, quantity: parseQuantity(line.quantity), ...(line.note.trim() ? { note: line.note.trim() } : {}) })),
    );
    void action.run(
      async () => {
        const saved = draft ? await replaceFeedingPlan(draft.id, items, note.trim() || null) : await createFeedingPlan(horse.id, items, note.trim() || undefined);
        if (next === 'apply') await applyFeedingPlan(saved.id);
        return saved;
      },
      () => {
        toast.push(next === 'apply' ? `Đã áp dụng khẩu phần mới cho ${horse.name}` : 'Đã lưu bản nháp khẩu phần', 'success');
        onSaved();
        onClose();
      },
    );
  };

  const copyFrom = (source: FeedingPlan) => {
    setLines(planLines(source).map(toLine));
    setCopying(false);
    toast.push(`Đã điền ${planLines(source).length} món từ khẩu phần của ${source.horseName}`, 'info');
  };

  const options = supplies.data ?? [];

  return (
    <Sheet
      open
      onClose={onClose}
      width="max-w-3xl"
      title={draft ? `Sửa bản nháp: ${horse.name}` : `Lập khẩu phần: ${horse.name}`}
      description="Lượng tính theo đơn vị của vật tư. Không cần đủ cả 4 bữa."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="secondary" onClick={() => submit('draft')} disabled={action.pending}>
            {action.pending && mode === 'draft' ? 'Đang lưu…' : 'Lưu nháp'}
          </Button>
          <Button onClick={() => submit('apply')} disabled={action.pending}>
            {action.pending && mode === 'apply' ? 'Đang áp dụng…' : 'Lưu và áp dụng'}
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
          {options.length === 0 && <ErrorBox message="Quản lý CLB chưa thêm thức ăn hoặc thực phẩm bổ sung vào kho, nên chưa chọn được món." />}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-600">
              {lines.length} món{touched && countError ? <span className="ml-2 font-medium text-red-600">{countError}</span> : null}
            </p>
            <Button variant="inline" size="sm" onClick={() => setCopying(true)}>
              <Copy size={13} /> Sao từ ngựa khác
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
                      const lineError = touched ? errors.find((entry) => entry.key === line.key) : undefined;
                      const supply = byId.get(line.supplyItemId);
                      return (
                        <div key={line.key} className="grid gap-2 sm:grid-cols-12" data-invalid={lineError && (lineError.supply || lineError.quantity || lineError.note) ? 'true' : undefined}>
                          <Field error={lineError?.supply} className="sm:col-span-5">
                            <Select value={line.supplyItemId} onChange={(event) => update(line.key, { supplyItemId: event.target.value })}>
                              <option value="">Chọn món…</option>
                              {line.supplyItemId && !supply && <option value={line.supplyItemId}>{draftNames.get(line.supplyItemId) ?? 'Vật tư đã xóa'} · đã ngừng dùng</option>}
                              {options.map((item: SupplyItem) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.unit}) · {supplyCategoryText[item.category]}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field error={lineError?.quantity} className="sm:col-span-3">
                            <div className="relative">
                              <Input value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} inputMode="decimal" placeholder="Lượng" className="pr-12" />
                              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">{supply?.unit}</span>
                            </div>
                          </Field>
                          <Field error={lineError?.note} className="sm:col-span-3">
                            <Input value={line.note} onChange={(event) => update(line.key, { note: event.target.value })} placeholder="Ghi chú" maxLength={220} />
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

          <Field label="Ghi chú khẩu phần" error={touched ? noteError : undefined}>
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Giảm tinh bột tuần thi đấu, uống đủ nước sau buổi tập" />
          </Field>
          {mode === 'apply' && <p className="text-xs text-gray-500">Lưu và áp dụng: khẩu phần đang áp dụng (nếu có) chuyển vào lịch sử, Groom thấy bản mới ngay.</p>}
          {action.error && <ErrorBox message={action.error} />}
        </div>
      )}
      {copying && <CopyFromHorse horse={horse} onClose={() => setCopying(false)} onPick={copyFrom} hasLines={lines.length > 0} />}
    </Sheet>
  );
}

/** Chọn ngựa cùng khu đang có khẩu phần áp dụng để sao các dòng. */
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
    <Modal open onClose={onClose} title="Sao từ ngựa khác" description={hasLines ? 'Các món đang nhập sẽ được thay bằng khẩu phần đang áp dụng của ngựa được chọn.' : 'Điền sẵn khẩu phần đang áp dụng của một ngựa cùng khu, rồi sửa tiếp.'}>
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
