// F1.5 — chỉ số cơ thể: 4 biểu đồ cùng một màu, dải bình thường xám; chỉ bản ghi bất thường mới có màu.
// form ghi chỉ số (hỏi xác nhận khi ngoài khoảng), VET xóa bản ghi ghi sai kèm lý do.
import { useState } from 'react';
import { Plus, Stethoscope, Trash2 } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { addMeasurement, deleteMeasurement, listMeasurements, type MeasurementRow } from '../../../services/horse.service';
import { AppError } from '../../../services/api';
import { useStore } from '../../../store/store';
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Dot,
  ErrorBox,
  Field,
  Input,
  Modal,
  Segmented,
  Skeleton,
  Textarea,
  ToggleChip,
  cn,
  useToast,
  type Column,
} from '../../../components/ui';
import { LineChart, chartColors } from '../../../components/charts/LineChart';
import { measurementLabel } from '../../../lib/labels';
import { TEMP_ALERT_C } from '../../../lib/rules';
import { addDays, formatDateShort, formatDateTime } from '../../../lib/format';
import { now } from '../../../lib/clock';
import type { MeasurementType } from '../../../types/domain';
import { ReasonDialog } from '../../stable/components/PlacementDialogs';

const TYPES: MeasurementType[] = ['WEIGHT', 'TEMPERATURE', 'HEIGHT', 'BODY_CONDITION'];
// Bốn biểu đồ dùng chung một màu — màu chỉ để nói "bất thường", không để phân biệt loại chỉ số.
const LINE_COLOR = chartColors.emerald;

/** Vượt ngưỡng cảnh báo (báo khẩn) → đỏ; chỉ ngoài khoảng bình thường → hổ phách. */
function severityOf(row: { type: MeasurementType; value: number; abnormal: boolean }): 'danger' | 'warn' | null {
  if (row.type === 'TEMPERATURE' && row.value > TEMP_ALERT_C) return 'danger';
  return row.abnormal ? 'warn' : null;
}
const SPAN: Record<MeasurementType, string> = {
  WEIGHT: 'lg:col-span-7',
  TEMPERATURE: 'lg:col-span-5',
  HEIGHT: 'lg:col-span-5',
  BODY_CONDITION: 'lg:col-span-7',
};

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatValue(type: MeasurementType, value: number) {
  return type === 'TEMPERATURE' ? value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : value.toLocaleString('vi-VN');
}

export default function BodyTab({
  horseId,
  canRecord,
  canDelete,
}: {
  horseId: string;
  canRecord: boolean;
  canDelete: boolean;
}) {
  const toast = useToast();
  const role = useStore((state) => state.currentUser?.role);
  const canSeeDeleted = role === 'VETERINARIAN' || role === 'CLUB_MANAGER';
  const [showDeleted, setShowDeleted] = useState(false);
  const [filter, setFilter] = useState<MeasurementType | 'ALL'>('ALL');
  const list = useService(() => listMeasurements(horseId, { includeDeleted: showDeleted }), [horseId, showDeleted]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ type: 'WEIGHT' as MeasurementType, value: '', measuredAt: '', note: '' });
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<{ message: string; field?: string }>();
  const [confirmMessage, setConfirmMessage] = useState<string>();
  const [deleting, setDeleting] = useState<MeasurementRow | null>(null);
  const [deleteError, setDeleteError] = useState<string>();

  const rows = list.data ?? [];
  const live = rows.filter((row) => !row.deleted);

  const openForm = () => {
    setForm({ type: 'WEIGHT', value: '', measuredAt: toLocalInput(now()), note: '' });
    setFormError(undefined);
    setFormOpen(true);
  };

  const save = async (confirmAbnormal: boolean) => {
    setPending(true);
    setFormError(undefined);
    try {
      const result = await addMeasurement({
        horseId,
        type: form.type,
        value: Number(form.value.replace(',', '.')),
        measuredAt: new Date(form.measuredAt).toISOString(),
        note: form.note,
        confirmAbnormal,
      });
      setConfirmMessage(undefined);
      setFormOpen(false);
      if (result.alertLevel === 'URGENT') toast.push('Đã lưu. Thân nhiệt vượt ngưỡng — đã báo khẩn bác sĩ, HT và gửi yêu cầu khám khẩn', 'error');
      else if (result.alertLevel === 'HIGH') toast.push('Đã lưu. Cân nặng giảm hơn 5% trong 14 ngày — đã báo bác sĩ và HT', 'error');
      else toast.push(result.abnormal ? 'Đã lưu và đánh dấu bất thường' : 'Đã ghi chỉ số', 'success');
      list.reload();
    } catch (caught) {
      if (caught instanceof AppError && caught.field === 'confirmAbnormal') {
        setConfirmMessage(caught.message);
      } else {
        setConfirmMessage(undefined);
        setFormError({
          message: caught instanceof Error ? caught.message : 'Đã xảy ra lỗi',
          field: caught instanceof AppError ? caught.field : undefined,
        });
      }
    } finally {
      setPending(false);
    }
  };

  const latest = (type: MeasurementType) => live.find((row) => row.type === type);

  const columns: Column<MeasurementRow>[] = [
    {
      key: 'at',
      header: 'Thời điểm đo',
      render: (row) => <span className={cn('text-sm tabular-nums text-gray-700', row.deleted && 'line-through opacity-60')}>{formatDateTime(row.measuredAt)}</span>,
    },
    { key: 'type', header: 'Chỉ số', render: (row) => <span className="text-sm text-gray-700">{measurementLabel[row.type].name}</span> },
    {
      key: 'value',
      header: 'Giá trị',
      render: (row) => {
        const severity = row.deleted ? null : severityOf(row);
        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'font-semibold tabular-nums',
                severity === 'danger' ? 'text-red-700' : severity === 'warn' ? 'text-amber-700' : 'text-gray-900',
                row.deleted && 'line-through opacity-60',
              )}
            >
              {formatValue(row.type, row.value)} <span className="text-xs font-normal text-gray-500">{measurementLabel[row.type].unit}</span>
            </span>
            {severity && (
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', severity === 'danger' ? 'text-red-700' : 'text-amber-800')}>
                <Dot tone={severity} />
                {severity === 'danger' ? 'Vượt ngưỡng báo khẩn' : 'Bất thường'}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'source',
      header: 'Nguồn',
      render: (row) =>
        row.source === 'EXAM' ? (
          <span className="inline-flex items-center gap-1 text-xs text-gray-700">
            <Stethoscope size={12} className="text-gray-400" /> {row.sourceLabel}
          </span>
        ) : (
          <span className="text-xs text-gray-500">{row.sourceLabel}</span>
        ),
    },
    { key: 'by', header: 'Người ghi', render: (row) => <span className="text-sm text-gray-600">{row.recordedByName}</span> },
    {
      key: 'note',
      header: 'Ghi chú',
      render: (row) =>
        row.deleted ? (
          <span className="text-xs text-gray-500">
            Đã xóa bởi {row.deletedByName}: {row.deleteReason}
          </span>
        ) : (
          <span className="text-xs text-gray-500">{row.note ?? ''}</span>
        ),
    },
    ...(canDelete
      ? [
          {
            key: 'actions',
            header: '',
            className: 'w-12 text-right',
            render: (row: MeasurementRow) =>
              row.canDelete ? (
                <Button
                  size="icon"
                  variant="ghost"
                  title="Xóa bản ghi ghi sai"
                  onClick={() => {
                    setDeleteError(undefined);
                    setDeleting(row);
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  if (list.loading && !list.data) return <Skeleton rows={5} />;
  if (list.error) return <ErrorBox message={list.error} />;

  const meta = measurementLabel[form.type];
  const minInput = toLocalInput(addDays(now(), -7));
  const filtered = filter === 'ALL' ? rows : rows.filter((row) => row.type === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Dải xám trên biểu đồ là khoảng bình thường; giá trị ngoài khoảng được đánh dấu bất thường.</p>
        {canRecord && (
          <Button onClick={openForm}>
            <Plus size={16} /> Ghi chỉ số
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {TYPES.map((type) => {
          const info = measurementLabel[type];
          const record = latest(type);
          const severity = record ? severityOf(record) : null;
          const points = live
            .filter((row) => row.type === type)
            .map((row) => ({ x: new Date(row.measuredAt).getTime(), y: row.value }))
            .sort((a, b) => a.x - b.x);
          return (
            <Card key={type} className={cn('p-5', SPAN[type])} tone={severity === 'danger' ? 'danger' : severity === 'warn' ? 'warning' : 'default'}>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500">{info.name}</p>
                  <p
                    className={cn(
                      'flex items-baseline gap-1 text-2xl font-bold tabular-nums',
                      severity === 'danger' ? 'text-red-700' : severity === 'warn' ? 'text-amber-700' : 'text-gray-900',
                    )}
                  >
                    {record ? formatValue(type, record.value) : '—'}
                    <span className="text-sm font-medium text-gray-500">{info.unit}</span>
                    {severity && (
                      <span className={cn('ml-1 inline-flex items-center gap-1.5 self-center text-xs font-medium', severity === 'danger' ? 'text-red-700' : 'text-amber-800')}>
                        <Dot tone={severity} />
                        {severity === 'danger' ? 'Vượt ngưỡng báo khẩn' : 'Ngoài khoảng bình thường'}
                      </span>
                    )}
                  </p>
                </div>
                <p className="text-right text-xs text-gray-500">
                  Bình thường {info.min}–{info.max} {info.unit}
                  {record && <span className="block">Lần đo gần nhất {formatDateShort(record.measuredAt)}</span>}
                </p>
              </div>
              <LineChart
                height={type === 'WEIGHT' || type === 'BODY_CONDITION' ? 200 : 180}
                series={[{ key: type, label: info.name, color: LINE_COLOR, points }]}
                band={{ from: info.min, to: info.max }}
                threshold={type === 'TEMPERATURE' ? { value: TEMP_ALERT_C, label: `Ngưỡng báo khẩn ${TEMP_ALERT_C} °C` } : undefined}
                formatX={(value) => formatDateShort(new Date(value))}
                formatY={(value) => (type === 'TEMPERATURE' || type === 'BODY_CONDITION' ? value.toFixed(1) : String(Math.round(value)))}
              />
            </Card>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: 'Tất cả' },
              ...TYPES.map((type) => ({ value: type, label: measurementLabel[type].name })),
            ]}
          />
          {canSeeDeleted && (
            <ToggleChip checked={showDeleted} onChange={setShowDeleted}>
              Hiện bản ghi đã xóa
            </ToggleChip>
          )}
        </div>
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(row) => row.id}
          pageSize={10}
          emptyTitle="Chưa có bản ghi chỉ số"
          rowClassName={(row) => cn(row.deleted && 'opacity-70')}
        />
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Ghi chỉ số cơ thể"
        description="Không ghi thời điểm ở tương lai, nhập lùi tối đa 7 ngày. Bản ghi không sửa được — ghi sai thì bác sĩ xóa kèm lý do rồi đo lại."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Quay lại
            </Button>
            <Button onClick={() => save(false)} disabled={pending || !form.value || !form.measuredAt}>
              {pending ? 'Đang lưu…' : 'Lưu chỉ số'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Segmented
            value={form.type}
            onChange={(type) => setForm({ ...form, type })}
            options={TYPES.map((type) => ({ value: type, label: measurementLabel[type].name }))}
            className="flex w-full flex-wrap"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={`${meta.name} (${meta.unit})`}
              required
              hint={`Bình thường ${meta.min}–${meta.max} ${meta.unit}`}
              error={formError?.field === 'value' ? formError.message : undefined}
            >
              <Input
                inputMode="decimal"
                value={form.value}
                onChange={(event) => setForm({ ...form, value: event.target.value })}
                placeholder={String(meta.min)}
                autoFocus
              />
            </Field>
            <Field label="Thời điểm đo" required error={formError?.field === 'measuredAt' ? formError.message : undefined}>
              <Input
                type="datetime-local"
                value={form.measuredAt}
                min={minInput}
                max={toLocalInput(now())}
                onChange={(event) => setForm({ ...form, measuredAt: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Ghi chú">
            <Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="min-h-16" placeholder="Ví dụ: đo sau khi tập buổi sáng" />
          </Field>
          {form.type === 'TEMPERATURE' && (
            <p className="text-xs text-gray-500">Trên {TEMP_ALERT_C} °C: hệ thống báo khẩn bác sĩ, HT của khu và tự tạo yêu cầu khám khẩn.</p>
          )}
          {formError && formError.field !== 'value' && formError.field !== 'measuredAt' && <ErrorBox message={formError.message} />}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmMessage}
        title="Giá trị ngoài khoảng bình thường"
        message={confirmMessage}
        confirmLabel="Vẫn lưu và đánh dấu bất thường"
        danger={false}
        pending={pending}
        onConfirm={() => save(true)}
        onClose={() => setConfirmMessage(undefined)}
      />

      <ReasonDialog
        open={!!deleting}
        title="Xóa bản ghi chỉ số"
        message={
          deleting && (
            <p>
              Xóa bản ghi {measurementLabel[deleting.type].name.toLowerCase()} {formatValue(deleting.type, deleting.value)} {measurementLabel[deleting.type].unit} lúc{' '}
              {formatDateTime(deleting.measuredAt)}. Bản ghi được giữ lại dạng đã xóa để đối chiếu.
            </p>
          )
        }
        confirmLabel="Xóa bản ghi"
        error={deleteError}
        onClose={() => setDeleting(null)}
        onSubmit={async (reason) => {
          if (!deleting) return false;
          try {
            await deleteMeasurement(deleting.id, reason);
            toast.push('Đã xóa bản ghi', 'success');
            list.reload();
            return true;
          } catch (caught) {
            setDeleteError(caught instanceof Error ? caught.message : 'Đã xảy ra lỗi');
            return false;
          }
        }}
      />
    </div>
  );
}
