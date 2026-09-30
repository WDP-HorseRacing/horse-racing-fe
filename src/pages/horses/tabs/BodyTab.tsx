// F1.5 — chỉ số cơ thể: 4 biểu đồ cùng một màu, dải bình thường xám; chỉ bản ghi bất thường mới có màu.
// Form ghi nhiều chỉ số trong một lần đo (backend hỏi xác nhận khi ngoài khoảng bình thường — mã 422),
// bác sĩ xóa bản ghi ghi sai kèm lý do. Bản ghi từ buổi khám chỉ xử lý được ở hồ sơ y tế.
import { useState } from 'react';
import { Plus, Stethoscope, Trash2 } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { addMeasurements, deleteMeasurement, listMeasurements } from '../../../api/horses';
import type { CreatedMeasurement, Measurement, MeasurementType } from '../../../api/types';
import { AppError } from '../../../lib/errors';
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
  cn,
  useToast,
  type Column,
} from '../../../components/ui';
import { LineChart, chartColors } from '../../../components/charts/LineChart';
import { measurementSpec } from '../../../lib/api-labels';
import { TEMP_ALERT_C } from '../../../lib/rules';
import { addDays, formatDateShort, formatDateTime } from '../../../lib/format';
import { now } from '../../../lib/clock';
import { ReasonDialog } from '../../stable/components/PlacementDialogs';

const TYPES: MeasurementType[] = ['WEIGHT', 'TEMPERATURE', 'HEIGHT', 'BODY_CONDITION'];
// Bốn biểu đồ dùng chung một màu — màu chỉ để nói "bất thường", không để phân biệt loại chỉ số.
const LINE_COLOR = chartColors.emerald;

interface Row extends Omit<Measurement, 'value'> {
  value: number;
}

/** Vượt ngưỡng cảnh báo (báo khẩn) → đỏ; chỉ ngoài khoảng bình thường → hổ phách. */
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

function alertToast(created: CreatedMeasurement[]) {
  const alerts = created.flatMap((item) => item.alerts);
  if (alerts.some((item) => item.alert === 'FEVER')) return 'Đã lưu. Thân nhiệt vượt ngưỡng sốt — đã báo khẩn bác sĩ, HT của khu và tạo yêu cầu khám khẩn';
  if (alerts.some((item) => item.alert === 'WEIGHT_DROP')) return 'Đã lưu. Cân nặng giảm hơn 5% trong 14 ngày — đã báo bác sĩ, HT và tạo yêu cầu khám';
  return undefined;
}

export default function BodyTab({ horseId, canRecord, canDelete }: { horseId: string; canRecord: boolean; canDelete: boolean }) {
  const toast = useToast();
  const [filter, setFilter] = useState<MeasurementType | 'ALL'>('ALL');
  const list = useService(async () => {
    const page = await listMeasurements(horseId, { limit: 500 });
    return page.items.map((item) => ({ ...item, value: Number(item.value) }));
  }, [horseId]);

  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState<Record<MeasurementType, string>>({ WEIGHT: '', TEMPERATURE: '', HEIGHT: '', BODY_CONDITION: '' });
  const [measuredAt, setMeasuredAt] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [confirmMessage, setConfirmMessage] = useState<string>();
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deleteError, setDeleteError] = useState<string>();

  const rows: Row[] = list.data ?? [];

  const openForm = () => {
    setValues({ WEIGHT: '', TEMPERATURE: '', HEIGHT: '', BODY_CONDITION: '' });
    setMeasuredAt(toLocalInput(now()));
    setFormError(undefined);
    setFormOpen(true);
  };

  const entered = TYPES.filter((type) => values[type].trim() !== '').map((type) => ({ type, value: Number(values[type].replace(',', '.')) }));
  const invalid = entered.find(
    (item) => Number.isNaN(item.value) || item.value < measurementSpec[item.type].hardMin || item.value > measurementSpec[item.type].hardMax,
  );

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
      setFormOpen(false);
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

  const latest = (type: MeasurementType) => rows.find((row) => row.type === type);

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
          const info = measurementSpec[type];
          const record = latest(type);
          const severity = record ? severityOf(record) : null;
          const points = rows
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
                    <span className="text-sm font-medium text-gray-500">{unitText(type)}</span>
                    {severity && (
                      <span className={cn('ml-1 inline-flex items-center gap-1.5 self-center text-xs font-medium', severity === 'danger' ? 'text-red-700' : 'text-amber-800')}>
                        <Dot tone={severity} />
                        {severity === 'danger' ? 'Vượt ngưỡng sốt' : 'Ngoài khoảng bình thường'}
                      </span>
                    )}
                  </p>
                </div>
                <p className="text-right text-xs text-gray-500">
                  Bình thường {info.min}–{info.max} {unitText(type)}
                  {record && <span className="block">Lần đo gần nhất {formatDateShort(record.measuredAt)}</span>}
                </p>
              </div>
              <LineChart
                height={type === 'WEIGHT' || type === 'BODY_CONDITION' ? 200 : 180}
                series={[{ key: type, label: info.name, color: LINE_COLOR, points }]}
                band={{ from: info.min, to: info.max }}
                threshold={type === 'TEMPERATURE' ? { value: TEMP_ALERT_C, label: `Ngưỡng sốt ${TEMP_ALERT_C} °C` } : undefined}
                formatX={(value) => formatDateShort(new Date(value))}
                formatY={(value) => (type === 'TEMPERATURE' || type === 'BODY_CONDITION' ? value.toFixed(1) : String(Math.round(value)))}
              />
            </Card>
          );
        })}
      </div>

      <div className="space-y-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[{ value: 'ALL', label: 'Tất cả' }, ...TYPES.map((type) => ({ value: type, label: measurementSpec[type].name }))]}
        />
        <DataTable rows={filtered} columns={columns} rowKey={(row) => row.id} pageSize={10} emptyTitle="Chưa có bản ghi chỉ số" />
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Ghi chỉ số cơ thể"
        description="Nhập một hoặc nhiều chỉ số của cùng một lần đo. Không ghi thời điểm ở tương lai, nhập lùi tối đa 7 ngày. Ghi sai thì bác sĩ xóa kèm lý do rồi đo lại."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Quay lại
            </Button>
            <Button onClick={() => save(false)} disabled={pending || entered.length === 0 || !!invalid || !measuredAt}>
              {pending ? 'Đang lưu…' : 'Lưu chỉ số'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {TYPES.map((type) => {
              const spec = measurementSpec[type];
              const bad = invalid?.type === type;
              return (
                <Field
                  key={type}
                  label={`${spec.name} (${unitText(type)})`}
                  hint={`Bình thường ${spec.min}–${spec.max}`}
                  error={bad ? `Chỉ nhận ${spec.hardMin}–${spec.hardMax} ${unitText(type)}` : undefined}
                >
                  <Input
                    inputMode="decimal"
                    value={values[type]}
                    onChange={(event) => setValues({ ...values, [type]: event.target.value })}
                    placeholder="Để trống nếu không đo"
                  />
                </Field>
              );
            })}
          </div>
          <Field label="Thời điểm đo" required>
            <Input type="datetime-local" value={measuredAt} min={minInput} max={toLocalInput(now())} onChange={(event) => setMeasuredAt(event.target.value)} />
          </Field>
          {values.TEMPERATURE && (
            <p className="text-xs text-gray-500">
              Trên {TEMP_ALERT_C} °C: hệ thống báo khẩn bác sĩ, HT của khu và tự tạo yêu cầu khám khẩn. Cân nặng giảm hơn 5% trong 14 ngày cũng được cảnh báo.
            </p>
          )}
          {formError && <ErrorBox message={formError} />}
        </div>
      </Modal>

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
              {formatDateTime(deleting.measuredAt)}. Bản ghi bị ẩn khỏi lịch sử và mốc cảnh báo sụt cân; lý do được lưu vào nhật ký.
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
    </div>
  );
}
