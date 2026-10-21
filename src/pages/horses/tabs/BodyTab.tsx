// F1.5 — chỉ số cơ thể: 4 biểu đồ cùng một màu, dải bình thường xám, chỉ bản ghi bất thường mới có màu.
// Người được ghi (HLV trưởng của khu, bác sĩ, Groom được giao) sửa thẳng con số hiện tại trên từng thẻ, rồi bấm Lưu
// một lần cho cả lần đo: mỗi số đã đổi thành một lần đo mới (backend hỏi xác nhận khi ngoài khoảng bình thường, mã 422).
// Thời điểm đo là lúc lưu (không nhập lùi). Lần đo cũ không bị sửa, vẫn nằm trong biểu đồ và lịch sử.
// Ghi sai thì bác sĩ xóa kèm lý do rồi nhập lại. Bản ghi từ buổi khám chỉ xử lý được ở hồ sơ y tế.
import { useState } from 'react';
import { Minus, RotateCcw, Stethoscope, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { useLeaveConfirm } from '../../../hooks/useLeaveConfirm';
import { addMeasurements, deleteMeasurement, listMeasurements } from '../../../api/horses';
import type { CreatedMeasurement, Measurement, MeasurementType } from '../../../api/types';
import { AppError } from '../../../lib/errors';
import { Button, Card, ConfirmDialog, DataTable, Dot, ErrorBox, Segmented, Skeleton, cn, useToast, type Column } from '../../../components/ui';
import { LineChart, chartColors } from '../../../components/charts/LineChart';
import { measurementSpec } from '../../../lib/api-labels';
import { TEMP_ALERT_C } from '../../../lib/horse-rules';
import { formatDateShort, formatDateTime, formatTime } from '../../../lib/format';
import { ReasonDialog } from '../../stable/components/PlacementDialogs';
import { measurementDelta } from './body-delta';

const TYPES: MeasurementType[] = ['WEIGHT', 'TEMPERATURE', 'HEIGHT', 'BODY_CONDITION'];
// Bốn biểu đồ dùng chung một màu: màu chỉ để nói "bất thường", không để phân biệt loại chỉ số.
const LINE_COLOR = chartColors.emerald;

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

function formatValue(type: MeasurementType, value: number) {
  return type === 'TEMPERATURE' ? value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : value.toLocaleString('vi-VN');
}

const unitText = (type: MeasurementType) => (measurementSpec[type].unit === '/9' ? '/9' : measurementSpec[type].unit);
/** "07/10 12:40": ngày và giờ đo, khớp với biểu đồ. */
const dayTime = (value: string | number) => `${formatDateShort(new Date(value))} ${formatTime(new Date(value))}`;

function alertToast(created: CreatedMeasurement[]) {
  const alerts = created.flatMap((item) => item.alerts);
  if (alerts.some((item) => item.alert === 'FEVER')) return 'Đã lưu. Thân nhiệt vượt ngưỡng sốt, đã báo khẩn bác sĩ, HLV trưởng của khu và chủ ngựa';
  if (alerts.some((item) => item.alert === 'WEIGHT_DROP')) return 'Đã lưu. Cân nặng giảm hơn 5% trong 14 ngày, đã báo bác sĩ, HLV trưởng và chủ ngựa';
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
  const list = useService(async () => (await listMeasurements(horseId, { limit: 500 })).items, [horseId]);

  // Số đã sửa trên các thẻ (chưa sửa thì ô hiện số mới nhất). Lưu một lần cho cả lần đo.
  const [edits, setEdits] = useState<Partial<Record<MeasurementType, string>>>({});
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [confirmMessage, setConfirmMessage] = useState<string>();
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deleteError, setDeleteError] = useState<string>();

  const rows: Row[] = list.data ?? [];

  // Các lần đo của một chỉ số, mới nhất lên trên: lần đầu là số hiện tại, lần thứ hai là "lần đo trước".
  const byType = (type: MeasurementType) => rows.filter((row) => row.type === type).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
  const latest = (type: MeasurementType) => byType(type)[0];
  const parse = (raw: string) => Number(raw.trim().replace(',', '.'));
  /** Ô đã đổi so với số mới nhất (ô trống, hoặc gõ lại đúng số cũ thì coi như chưa đổi). */
  const changed = (type: MeasurementType) => {
    const raw = edits[type];
    if (raw === undefined || raw.trim() === '') return false;
    const record = latest(type);
    return !record || parse(raw) !== record.value;
  };
  const entered = TYPES.filter(changed).map((type) => ({ type, value: parse(edits[type] ?? '') }));
  const invalid = entered.some((item) => draftNote(item.type, edits[item.type] ?? '').tone === 'error');
  const dirty = entered.length > 0;
  // Đổi tab trong hồ sơ (?tab=) cũng làm mất số đang nhập: chặn cả khi đổi query.
  const leaveConfirm = useLeaveConfirm(dirty, 'Chỉ số vừa nhập chưa được lưu. Rời đi sẽ mất các số này.', { includeSearch: true });

  const canSave = dirty && !invalid && !pending;

  const resetDraft = () => {
    setEdits({});
    setFormError(undefined);
  };

  const save = async (confirmAbnormal: boolean) => {
    setPending(true);
    setFormError(undefined);
    try {
      const created = await addMeasurements(horseId, {
        values: entered,
        confirmAbnormal,
      });
      setConfirmMessage(undefined);
      resetDraft();
      const alert = alertToast(created);
      if (alert) toast.push(alert, 'error');
      else toast.push(created.some((item) => item.isAbnormal) ? 'Đã lưu. Có chỉ số bất thường' : 'Đã lưu', 'success');
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
                  title="Xóa số đo sai"
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

  const filtered = filter === 'ALL' ? rows : rows.filter((row) => row.type === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-gray-500">
          Dải xám là khoảng bình thường.
          {canRecord && <span className="block">Nhập số mới trên thẻ rồi bấm Lưu, giờ đo là lúc lưu. Nhập sai thì bác sĩ xóa kèm lý do rồi nhập lại.</span>}
        </p>
        {canRecord && (
          <div className="flex flex-wrap items-end gap-2">
            {dirty && (
              <Button variant="secondary" onClick={resetDraft} disabled={pending}>
                Hủy
              </Button>
            )}
            <Button onClick={() => save(false)} disabled={!canSave}>
              {pending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        )}
      </div>
      {canRecord && formError && <ErrorBox message={formError} />}

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
          const edited = changed(type);
          const display = edits[type] ?? (record ? formatValue(type, record.value) : '');
          const note = draftNote(type, edited ? (edits[type] ?? '') : '');
          const tone = edited ? (note.tone === 'error' || note.tone === 'danger' ? 'danger' : note.tone === 'warn' ? 'warn' : null) : severity;
          const DeltaIcon = delta?.direction === 'up' ? TrendingUp : delta?.direction === 'down' ? TrendingDown : Minus;
          return (
            <Card key={type} className={cn('p-5', SPAN[type])} tone={severity === 'danger' ? 'danger' : severity === 'warn' ? 'warning' : 'default'}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-gray-500">{info.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {canRecord ? (
                      <label
                        className={cn(
                          'flex items-baseline gap-1 rounded-lg px-1.5 ring-1 transition focus-within:ring-2 focus-within:ring-emerald-500',
                          edited ? 'bg-emerald-50/60 ring-emerald-400' : 'ring-gray-200 hover:ring-gray-300',
                        )}
                      >
                        <input
                          inputMode="decimal"
                          aria-label={`${info.name}, sửa để ghi lần đo mới`}
                          value={display}
                          placeholder="—"
                          size={Math.max(3, display.length + 1)}
                          onChange={(event) => setEdits((current) => ({ ...current, [type]: event.target.value }))}
                          onFocus={(event) => event.target.select()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && canSave) void save(false);
                            if (event.key === 'Escape') setEdits(({ [type]: _dropped, ...rest }) => rest);
                          }}
                          className={cn(
                            'bg-transparent py-0.5 text-2xl font-bold tabular-nums outline-none! placeholder:text-gray-300',
                            tone === 'danger' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-gray-900',
                          )}
                        />
                        <span className="text-sm font-medium text-gray-500">{unitText(type)}</span>
                      </label>
                    ) : (
                      <p
                        className={cn(
                          'flex items-baseline gap-1 text-2xl font-bold tabular-nums',
                          severity === 'danger' ? 'text-red-700' : severity === 'warn' ? 'text-amber-700' : 'text-gray-900',
                        )}
                      >
                        {record ? formatValue(type, record.value) : '—'}
                        <span className="text-sm font-medium text-gray-500">{unitText(type)}</span>
                      </p>
                    )}
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

              {canRecord && (edited || !record || note.tone !== 'hint') && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={cn(
                      'text-xs',
                      note.tone === 'error' || note.tone === 'danger' ? 'font-medium text-red-600' : note.tone === 'warn' ? 'font-medium text-amber-700' : edited ? 'text-emerald-800' : 'text-gray-400',
                    )}
                  >
                    {edited && note.tone === 'hint'
                      ? record
                        ? `Số cũ ${formatValue(type, record.value)} ${unitText(type)}`
                        : 'Lần đo đầu'
                      : record || edited
                        ? note.text
                        : 'Chưa có số đo'}
                  </span>
                  {edited && (
                    <button
                      type="button"
                      onClick={() => setEdits(({ [type]: _dropped, ...rest }) => rest)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
                    >
                      <RotateCcw size={12} /> Hoàn tác
                    </button>
                  )}
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
        message={confirmMessage?.replace('Gửi lại với confirmAbnormal = true để xác nhận lưu', 'Số đúng thì bấm Vẫn lưu.')}
        confirmLabel="Vẫn lưu"
        danger={false}
        pending={pending}
        onConfirm={() => save(true)}
        onClose={() => setConfirmMessage(undefined)}
      />

      <ReasonDialog
        open={!!deleting}
        title="Xóa số đo"
        message={
          deleting && (
            <p>
              Xóa bản ghi {measurementSpec[deleting.type].name.toLowerCase()} {formatValue(deleting.type, deleting.value)} {unitText(deleting.type)} lúc{' '}
              {formatDateTime(deleting.measuredAt)}. Số đo này sẽ ẩn khỏi lịch sử.
            </p>
          )
        }
        confirmLabel="Xóa"
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
