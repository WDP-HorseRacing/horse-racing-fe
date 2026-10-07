// F1.5 — chỉ số cơ thể: 4 biểu đồ cùng một màu, dải bình thường xám, chỉ bản ghi bất thường mới có màu.
// Người được ghi (HLV trưởng của khu, bác sĩ, Groom được giao) nhập số đo mới ngay dưới con số của từng thẻ,
// rồi bấm Lưu một lần cho cả lần đo (backend hỏi xác nhận khi ngoài khoảng bình thường, mã 422).
// Số đo cũ không sửa được: ghi sai thì bác sĩ xóa kèm lý do. Bản ghi từ buổi khám chỉ xử lý được ở hồ sơ y tế.
import { useState } from 'react';
import { Minus, Stethoscope, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { useLeaveConfirm } from '../../../hooks/useLeaveConfirm';
import { addMeasurements, deleteMeasurement, listMeasurements } from '../../../api/horses';
import type { CreatedMeasurement, Measurement, MeasurementType } from '../../../api/types';
import { AppError } from '../../../lib/errors';
import { Button, Card, ConfirmDialog, DataTable, Dot, ErrorBox, Input, Segmented, Skeleton, cn, invalidClass, useToast, type Column } from '../../../components/ui';
import { LineChart, chartColors } from '../../../components/charts/LineChart';
import { measurementSpec } from '../../../lib/api-labels';
import { TEMP_ALERT_C } from '../../../lib/rules';
import { addDays, formatDateShort, formatDateTime, formatTime } from '../../../lib/format';
import { now } from '../../../lib/clock';
import { ReasonDialog } from '../../stable/components/PlacementDialogs';
import { DateTimePicker } from '../../../components/ui/DatePicker';
import { measurementDelta } from './body-delta';

const TYPES: MeasurementType[] = ['WEIGHT', 'TEMPERATURE', 'HEIGHT', 'BODY_CONDITION'];
// Bốn biểu đồ dùng chung một màu: màu chỉ để nói "bất thường", không để phân biệt loại chỉ số.
const LINE_COLOR = chartColors.emerald;
const EMPTY_VALUES: Record<MeasurementType, string> = { WEIGHT: '', TEMPERATURE: '', HEIGHT: '', BODY_CONDITION: '' };

interface Row extends Omit<Measurement, 'value'> {
  value: number;
}

/** Vượt ngưỡng cảnh báo (báo khẩn) → đỏ. Chỉ ngoài khoảng bình thường → hổ phách. */
function severityOf(row: { type: MeasurementType; value: number; isAbnormal: boolean }): 'danger' | 'warn' | null {
  if (row.type === 'TEMPERATURE' && row.value > TEMP_ALERT_C) return 'danger';
  return row.isAbnormal ? 'warn' : null;
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
  return type === 'TEMPERATURE' ? value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : value.toLocaleString('vi-VN');
}

const unitText = (type: MeasurementType) => (measurementSpec[type].unit === '/9' ? '/9' : measurementSpec[type].unit);
/** "07/10 12:40": ngày và giờ đo, khớp với biểu đồ. */
const dayTime = (value: string | number) => `${formatDateShort(new Date(value))} ${formatTime(new Date(value))}`;

function alertToast(created: CreatedMeasurement[]) {
  const alerts = created.flatMap((item) => item.alerts);
  if (alerts.some((item) => item.alert === 'FEVER')) return 'Đã lưu. Thân nhiệt vượt ngưỡng sốt, đã báo khẩn bác sĩ, HLV trưởng của khu và tạo yêu cầu khám khẩn';
  if (alerts.some((item) => item.alert === 'WEIGHT_DROP')) return 'Đã lưu. Cân nặng giảm hơn 5% trong 14 ngày, đã báo bác sĩ, HLV trưởng và tạo yêu cầu khám';
  return undefined;
}

/** Trạng thái của ô nhập: lỗi (không lưu được), cảnh báo (vẫn lưu, đánh dấu bất thường) hoặc gợi ý khoảng bình thường. */
function draftNote(type: MeasurementType, raw: string): { tone: 'error' | 'warn' | 'danger' | 'hint'; text: string } {
  const spec = measurementSpec[type];
  const normal = `Bình thường ${spec.min}–${spec.max} ${unitText(type)}`;
  if (!raw.trim()) return { tone: 'hint', text: normal };
  const value = Number(raw.replace(',', '.'));
  if (Number.isNaN(value)) return { tone: 'error', text: 'Nhập một con số' };
  if (value < spec.hardMin || value > spec.hardMax) return { tone: 'error', text: `Chỉ nhận ${spec.hardMin}–${spec.hardMax} ${unitText(type)}` };
  if (type === 'TEMPERATURE' && value > TEMP_ALERT_C) return { tone: 'danger', text: `Trên ngưỡng sốt ${TEMP_ALERT_C} °C, sẽ báo khẩn bác sĩ` };
  if (value < spec.min || value > spec.max) return { tone: 'warn', text: 'Ngoài khoảng bình thường, sẽ đánh dấu bất thường' };
  return { tone: 'hint', text: normal };
}

export default function BodyTab({ horseId, canRecord, canDelete }: { horseId: string; canRecord: boolean; canDelete: boolean }) {
  const toast = useToast();
  const [filter, setFilter] = useState<MeasurementType | 'ALL'>('ALL');
  const list = useService(async () => {
    const page = await listMeasurements(horseId, { limit: 500 });
    return page.items.map((item) => ({ ...item, value: Number(item.value) }));
  }, [horseId]);

  // Số đo mới đang nhập trên các thẻ, lưu một lần cho cả lần đo.
  const [values, setValues] = useState<Record<MeasurementType, string>>(EMPTY_VALUES);
  const [measuredAt, setMeasuredAt] = useState(() => toLocalInput(now()));
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [confirmMessage, setConfirmMessage] = useState<string>();
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deleteError, setDeleteError] = useState<string>();

  const rows: Row[] = list.data ?? [];

  const entered = TYPES.filter((type) => values[type].trim() !== '').map((type) => ({ type, value: Number(values[type].replace(',', '.')) }));
  const invalid = entered.some((item) => draftNote(item.type, values[item.type]).tone === 'error');
  const dirty = entered.length > 0;
  // Đổi tab trong hồ sơ (?tab=) cũng làm mất số đang nhập: chặn cả khi đổi query.
  const leaveConfirm = useLeaveConfirm(dirty, 'Chỉ số vừa nhập chưa được lưu. Rời đi sẽ mất các số này.', { includeSearch: true });

  const dateValue = measuredAt ? new Date(measuredAt).getTime() : 0;
  const dateError =
    dateValue && (dateValue > now().getTime() + 60_000 || dateValue < addDays(now(), -7).getTime())
      ? 'Không ghi thời điểm ở tương lai, nhập lùi tối đa 7 ngày'
      : undefined;
  const canSave = dirty && !invalid && !dateError && !!measuredAt && !pending;

  const resetDraft = () => {
    setValues(EMPTY_VALUES);
    setMeasuredAt(toLocalInput(now()));
    setFormError(undefined);
  };

  const save = async (confirmAbnormal: boolean) => {
    setPending(true);
    setFormError(undefined);
    try {
      const created = await addMeasurements(horseId, {
        values: entered,
        measuredAt: new Date(measuredAt).toISOString(),
        confirmAbnormal,
      });
      setConfirmMessage(undefined);
      resetDraft();
      const alert = alertToast(created);
      if (alert) toast.push(alert, 'error');
      else toast.push(created.some((item) => item.isAbnormal) ? 'Đã lưu và đánh dấu bất thường' : 'Đã ghi chỉ số', 'success');
      list.reload();
    } catch (caught) {
      if (caught instanceof AppError && caught.field === 'confirmAbnormal') {
        setConfirmMessage(caught.message);
      } else {
        setConfirmMessage(undefined);
        setFormError(caught instanceof Error ? caught.message : 'Đã xảy ra lỗi');
      }
    } finally {
      setPending(false);
    }
  };

  // Các lần đo của một chỉ số, mới nhất lên trên: lần đầu là số hiện tại, lần thứ hai là "lần đo trước".
  const byType = (type: MeasurementType) => rows.filter((row) => row.type === type).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));

  const columns: Column<Row>[] = [
    {
      key: 'at',
      header: 'Thời điểm đo',
      render: (row) => <span className="text-sm tabular-nums text-gray-700">{formatDateTime(row.measuredAt)}</span>,
    },
    { key: 'type', header: 'Chỉ số', render: (row) => <span className="text-sm text-gray-700">{measurementSpec[row.type].name}</span> },
    {
      key: 'value',
      header: 'Giá trị',
      render: (row) => {
        const severity = severityOf(row);
        return (
          <div className="flex items-center gap-2">
            <span className={cn('font-semibold tabular-nums', severity === 'danger' ? 'text-red-700' : severity === 'warn' ? 'text-amber-700' : 'text-gray-900')}>
              {formatValue(row.type, row.value)} <span className="text-xs font-normal text-gray-500">{unitText(row.type)}</span>
            </span>
            {severity && (
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', severity === 'danger' ? 'text-red-700' : 'text-amber-800')}>
                <Dot tone={severity} />
                {severity === 'danger' ? 'Vượt ngưỡng sốt' : 'Bất thường'}
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
        row.source === 'MEDICAL_EXAM' ? (
          <span className="inline-flex items-center gap-1 text-xs text-gray-700">
            <Stethoscope size={12} className="text-gray-400" /> Từ buổi khám
          </span>
        ) : (
          <span className="text-xs text-gray-500">Nhập tay</span>
        ),
    },
    { key: 'by', header: 'Người ghi', render: (row) => <span className="text-sm text-gray-600">{row.measuredByName}</span> },
    ...(canDelete
      ? [
          {
            key: 'actions',
            header: '',
            className: 'w-12 text-right',
            render: (row: Row) =>
              row.source === 'MANUAL' ? (
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

  const minInput = toLocalInput(addDays(now(), -7));
  const filtered = filter === 'ALL' ? rows : rows.filter((row) => row.type === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-gray-500">
          Dải xám trên biểu đồ là khoảng bình thường. Giá trị ngoài khoảng được đánh dấu bất thường.
          {canRecord && <span className="block">Nhập số đo mới ngay trên từng thẻ rồi bấm Lưu. Số đo cũ không sửa, ghi sai thì bác sĩ xóa.</span>}
        </p>
        {canRecord && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Thời điểm đo</span>
              <DateTimePicker value={measuredAt} min={minInput} max={toLocalInput(now())} onChange={setMeasuredAt} />
            </label>
            {dirty && (
              <Button variant="secondary" onClick={resetDraft} disabled={pending}>
                Bỏ nhập
              </Button>
            )}
            <Button onClick={() => save(false)} disabled={!canSave}>
              {pending ? 'Đang lưu…' : dirty ? `Lưu ${entered.length} chỉ số` : 'Lưu chỉ số'}
            </Button>
          </div>
        )}
      </div>
      {canRecord && (dateError || formError) && <ErrorBox message={dateError ?? formError ?? ''} />}

      <div className="grid gap-4 lg:grid-cols-12">
        {TYPES.map((type) => {
          const info = measurementSpec[type];
          const history = byType(type);
          const record = history[0];
          const previous = history[1];
          const delta = record ? measurementDelta(type, record.value, previous?.value) : undefined;
          const severity = record ? severityOf(record) : null;
          const points = rows
            .filter((row) => row.type === type)
            .map((row) => ({ x: new Date(row.measuredAt).getTime(), y: row.value }))
            .sort((a, b) => a.x - b.x);
          const note = draftNote(type, values[type]);
          const DeltaIcon = delta?.direction === 'up' ? TrendingUp : delta?.direction === 'down' ? TrendingDown : Minus;
          return (
            <Card key={type} className={cn('p-5', SPAN[type])} tone={severity === 'danger' ? 'danger' : severity === 'warn' ? 'warning' : 'default'}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-gray-500">{info.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <p
                      className={cn(
                        'flex items-baseline gap-1 text-2xl font-bold tabular-nums',
                        severity === 'danger' ? 'text-red-700' : severity === 'warn' ? 'text-amber-700' : 'text-gray-900',
                      )}
                    >
                      {record ? formatValue(type, record.value) : '—'}
                      <span className="text-sm font-medium text-gray-500">{unitText(type)}</span>
                    </p>
                    {delta && (
                      // Không tô xanh đỏ: tăng hay giảm chưa chắc là tốt hay xấu.
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-gray-700">
                        <DeltaIcon size={12} className="text-gray-500" aria-hidden />
                        {delta.amount}
                        {delta.percent && <span className="font-medium text-gray-500">· {delta.percent}</span>}
                      </span>
                    )}
                    {severity && (
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', severity === 'danger' ? 'text-red-700' : 'text-amber-800')}>
                        <Dot tone={severity} />
                        {severity === 'danger' ? 'Vượt ngưỡng sốt' : 'Ngoài khoảng bình thường'}
                      </span>
                    )}
                  </div>
                  {previous && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      Lần trước <span className="font-medium tabular-nums text-gray-700">{formatValue(type, previous.value)} {unitText(type)}</span> · {dayTime(previous.measuredAt)}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-right text-xs leading-5 text-gray-500">
                  Bình thường {info.min}–{info.max} {unitText(type)}
                  {record && <span className="block">Đo lúc {dayTime(record.measuredAt)}</span>}
                </p>
              </div>

              {canRecord && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <div className="relative w-44">
                    <Input
                      inputMode="decimal"
                      aria-label={`${info.name} mới`}
                      value={values[type]}
                      placeholder="Nhập số đo mới"
                      onChange={(event) => setValues((current) => ({ ...current, [type]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && canSave) void save(false);
                      }}
                      className={cn('pr-12 tabular-nums', note.tone === 'error' && invalidClass)}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">{unitText(type)}</span>
                  </div>
                  <span
                    className={cn(
                      'text-xs',
                      note.tone === 'error' || note.tone === 'danger' ? 'font-medium text-red-600' : note.tone === 'warn' ? 'font-medium text-amber-700' : 'text-gray-400',
                    )}
                  >
                    {note.text}
                  </span>
                </div>
              )}

              <div className="mt-4">
                <LineChart
                  height={type === 'WEIGHT' || type === 'BODY_CONDITION' ? 200 : 180}
                  xAxis="sequence"
                  area
                  series={[
                    {
                      key: type,
                      label: info.name,
                      color: LINE_COLOR,
                      points,
                      hint: (point, before) => (before ? measurementDelta(type, point.y, before.y)?.text : undefined),
                    },
                  ]}
                  band={{ from: info.min, to: info.max }}
                  threshold={type === 'TEMPERATURE' ? { value: TEMP_ALERT_C, label: `Ngưỡng sốt ${TEMP_ALERT_C} °C` } : undefined}
                  formatX={(value) => formatDateShort(new Date(value))}
                  formatTooltipX={(value) => dayTime(value)}
                  formatY={(value) => (type === 'TEMPERATURE' || type === 'BODY_CONDITION' ? value.toFixed(1) : String(Math.round(value)))}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="space-y-3">
        <Segmented
          value={filter}
          onChange={(val) => setFilter(val as MeasurementType | 'ALL')}
          options={[{ value: 'ALL', label: 'Tất cả' }, ...TYPES.map((type) => ({ value: type, label: measurementSpec[type].name }))]}
        />
        <DataTable rows={filtered} columns={columns} rowKey={(row) => row.id} pageSize={10} emptyTitle="Chưa có bản ghi chỉ số" />
      </div>

      <ConfirmDialog
        open={!!confirmMessage}
        title="Giá trị ngoài khoảng bình thường"
        message={confirmMessage?.replace('Gửi lại với confirmAbnormal = true để xác nhận lưu', 'Kiểm tra lại, nếu đúng thì xác nhận lưu và đánh dấu bất thường.')}
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
              Xóa bản ghi {measurementSpec[deleting.type].name.toLowerCase()} {formatValue(deleting.type, deleting.value)} {unitText(deleting.type)} lúc{' '}
              {formatDateTime(deleting.measuredAt)}. Bản ghi bị ẩn khỏi lịch sử và mốc cảnh báo sụt cân. Lý do được lưu vào nhật ký.
            </p>
          )
        }
        confirmLabel="Xóa bản ghi"
        error={deleteError}
        onClose={() => setDeleting(null)}
        onSubmit={async (reason) => {
          if (!deleting) return false;
          try {
            await deleteMeasurement(horseId, deleting.id, reason);
            toast.push('Đã xóa bản ghi', 'success');
            list.reload();
            return true;
          } catch (caught) {
            setDeleteError(caught instanceof Error ? caught.message : 'Đã xảy ra lỗi');
            return false;
          }
        }}
      />
      {leaveConfirm}
    </div>
  );
}
