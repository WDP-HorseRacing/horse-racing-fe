// Khối dùng chung của trang ghi buổi khám (VisitNew) và trang sửa buổi khám (VisitEdit):
// ô số đo, đơn thuốc, chọn yêu cầu khám được xử lý, ghi chú chăm sóc cho Groom.
import { Check, ClipboardList, NotebookPen, Pill as PillIcon, Plus, Trash2 } from 'lucide-react';
import type { ExamRequest, MeasurementType } from '../../../api/types';
import { Button, CharCount, Field, Input, Textarea, cn, invalidClass } from '../../../components/ui';
import { UrgentPill } from '../../../components/ui/status';
import { DatePicker } from '../../../components/ui/DatePicker';
import { measurementSpec } from '../../../lib/api-labels';
import { FormSection } from './form-page';
import type { People } from './people';
import { RequestMeta, RequestText } from './parts';
import { todayKey } from './utils';
import { METRICS, METRIC_PATTERN, nextRowKey, rxKey, type MetricValues, type PrescriptionField, type PrescriptionRow } from './visit-form-utils';

/* ===== Số đo ===== */

export function MetricFields({
  types = METRICS,
  values,
  errors,
  onChange,
  onBlur,
}: {
  types?: MeasurementType[];
  values: MetricValues;
  /** Lỗi đang hiện của từng ô (đã lọc theo blur / bấm lưu). */
  errors: Partial<Record<MeasurementType, string | undefined>>;
  onChange: (type: MeasurementType, value: string) => void;
  /** Rời một ô số đo. */
  onBlur?: (type: MeasurementType) => void;
}) {
  return (
    <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
      {types.map((type) => {
        const spec = measurementSpec[type];
        return (
          <Field key={type} label={`${spec.name} (${spec.unit})`} name={`metric.${type}`} error={errors[type]} onBlur={onBlur ? () => onBlur(type) : undefined}>
            <Input
              inputMode="decimal"
              maxLength={10}
              value={values[type]}
              onChange={(event) => onChange(type, event.target.value)}
              onBlur={() => {
                // Chuẩn hóa số hợp lệ (37.50 → 37.5); số sai dạng để nguyên cho người dùng thấy lỗi.
                const text = values[type].trim();
                if (METRIC_PATTERN.test(text)) onChange(type, String(Number(text.replace(',', '.'))));
              }}
              placeholder={`${spec.min}–${spec.max}`}
              className={cn('tabular-nums', errors[type] && invalidClass)}
            />
          </Field>
        );
      })}
    </div>
  );
}

/* ===== Đơn thuốc ===== */

export function PrescriptionSection({
  rows,
  onChange,
  show,
  blur,
}: {
  rows: PrescriptionRow[];
  onChange: (rows: PrescriptionRow[]) => void;
  /** Lỗi đang hiện của một ô trong dòng thuốc (khóa rxKey). */
  show: (key: string) => string | undefined;
  /** Handler rời ô của useFormErrors. */
  blur: (key: string) => () => void;
}) {
  return (
    <FormSection
      icon={<PillIcon size={16} />}
      title="Đơn thuốc"
      aside={
        rows.length < 20 && (
          <Button size="sm" variant="inline" onClick={() => onChange([...rows, { key: nextRowKey(), medicine: '', dosage: '', frequency: '', startDate: todayKey(), endDate: '' }])}>
            <Plus size={14} /> Thêm thuốc
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa kê thuốc.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => {
            const update = (patch: Partial<PrescriptionRow>) => onChange(rows.map((item) => (item.key === row.key ? { ...item, ...patch } : item)));
            const err = (field: PrescriptionField) => show(rxKey(row.key, field));
            const rowInvalid = (['medicine', 'dosage', 'frequency', 'startDate', 'endDate'] as const).some((field) => err(field));
            const text = (field: 'medicine' | 'dosage' | 'frequency', label: string, placeholder: string, span: string) => (
              <Field label={label} required name={rxKey(row.key, field)} error={err(field)} onBlur={blur(rxKey(row.key, field))} className={span}>
                <Input placeholder={placeholder} maxLength={160} value={row[field]} onChange={(event) => update({ [field]: event.target.value })} className={cn(err(field) && invalidClass)} />
              </Field>
            );
            return (
              <div key={row.key} className={cn('rounded-xl bg-gray-50/80 p-4', rowInvalid && 'ring-1 ring-red-200')}>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-12">
                  {text('medicine', 'Tên thuốc', 'Ví dụ: Amoxicillin', 'sm:col-span-5')}
                  {text('dosage', 'Liều lượng', 'Ví dụ: 2 viên, 50ml', 'sm:col-span-4')}
                  {text('frequency', 'Tần suất', 'Ví dụ: 2 lần/ngày', 'sm:col-span-3')}
                  <div className="flex items-start gap-3 sm:col-span-12">
                    <div className="flex flex-1 flex-wrap items-start gap-x-3 gap-y-2">
                      <Field label="Ngày bắt đầu" required name={rxKey(row.key, 'startDate')} error={err('startDate')} onBlur={blur(rxKey(row.key, 'startDate'))}>
                        <DatePicker className="w-[150px]" value={row.startDate} onChange={(value) => update({ startDate: value })} invalid={!!err('startDate')} />
                      </Field>
                      <Field label="Ngày kết thúc" name={rxKey(row.key, 'endDate')} error={err('endDate')} onBlur={blur(rxKey(row.key, 'endDate'))}>
                        <DatePicker className="w-[150px]" min={row.startDate || undefined} value={row.endDate} onChange={(value) => update({ endDate: value })} invalid={!!err('endDate')} />
                      </Field>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="mt-7 shrink-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Bỏ thuốc này"
                      onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </FormSection>
  );
}

/* ===== Yêu cầu khám được xử lý ===== */

export function RequestChooser({
  rows,
  selected,
  onChange,
  people,
  error,
  emptyText = 'Ngựa không có yêu cầu khám đang chờ.',
  title = 'Yêu cầu khám được xử lý',
}: {
  rows: ExamRequest[];
  selected: string[];
  onChange: (ids: string[]) => void;
  people: People;
  error?: string;
  emptyText?: string;
  title?: string;
}) {
  return (
    <FormSection
      icon={<ClipboardList size={16} />}
      title={title}
      aside={rows.length > 0 ? <span className="text-xs text-gray-500">Đã chọn {selected.length}/{rows.length}</span> : undefined}
    >
      <div data-field="requests" data-invalid={error ? 'true' : undefined} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.length === 0 ? (
          <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500 lg:col-span-2">{emptyText}</p>
        ) : (
          rows.map((row) => {
            const checked = selected.includes(row.id);
            return (
              <label
                key={row.id}
                className={cn(
                  'group relative flex cursor-pointer items-start gap-4 rounded-2xl bg-white p-4 transition-all duration-300',
                  checked
                    ? 'bg-emerald-50/50 shadow-float ring-2 ring-emerald-500'
                    : 'ring-1 ring-gray-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/50',
                  row.urgent && !checked && 'shadow-[inset_4px_0_0_0_#ef4444]',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    {row.urgent && <UrgentPill urgent />}
                    <RequestMeta request={row} people={people} showUrgent={false} />
                  </span>
                  <span className="mt-2 block text-sm">
                    <RequestText text={row.description} />
                  </span>
                </span>
                <div
                  className={cn(
                    'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 bg-white group-hover:border-emerald-400',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))}
                    className="peer sr-only"
                  />
                  {checked && <Check size={14} strokeWidth={3} />}
                </div>
              </label>
            );
          })
        )}
        {error && <p className="text-xs font-medium text-red-600 lg:col-span-2">{error}</p>}
      </div>
    </FormSection>
  );
}

/* ===== Ghi chú chăm sóc ===== */

export function CareNotesSection({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <FormSection icon={<NotebookPen size={16} />} title="Ghi chú chăm sóc cho Groom">
      <Field counter={<CharCount value={value} max={2000} />}>
        <Textarea
          rows={3}
          maxLength={2000}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ví dụ: Chườm lạnh chân trước trái 2 lần/ngày, chỉ dắt bộ nhẹ 10 phút"
        />
      </Field>
    </FormSection>
  );
}
