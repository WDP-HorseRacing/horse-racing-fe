import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import { addMeasurement, deleteMeasurement, listMeasurements } from '../../../services/horse.service';
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
  SectionTitle,
  Select,
  Skeleton,
} from '../../../components/ui';
import { LineChart, chartColors } from '../../../components/charts/LineChart';
import { measurementLabel } from '../../../lib/labels';
import { formatDateShort, formatDateTime, toDateKey } from '../../../lib/format';
import { now } from '../../../lib/clock';
import type { MeasurementType } from '../../../types/domain';

const types: MeasurementType[] = ['WEIGHT', 'HEIGHT', 'BODY_CONDITION', 'TEMPERATURE'];

const allowedByRole: Record<string, MeasurementType[]> = {
  HEAD_TRAINER: ['WEIGHT', 'BODY_CONDITION'],
  VETERINARIAN: ['WEIGHT', 'HEIGHT', 'BODY_CONDITION', 'TEMPERATURE'],
  GROOM: ['WEIGHT', 'TEMPERATURE'],
};

export default function BodyTab({ horseId }: { horseId: string }) {
  const currentUser = useStore((state) => state.currentUser);
  const canAdd = can(currentUser, 'measurement.add');
  const isGroom = currentUser?.role === 'GROOM';
  const { data, loading, reload } = useService(() => listMeasurements(horseId), [horseId]);
  const action = useAction();

  const options = allowedByRole[currentUser?.role ?? ''] ?? [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: (options[0] ?? 'WEIGHT') as MeasurementType,
    value: '',
    measuredAt: new Date().toISOString().slice(0, 16),
  });
  const [chartType, setChartType] = useState<MeasurementType>('WEIGHT');

  if (loading) return <Skeleton rows={4} />;
  const rows = data ?? [];

  const latest = (type: MeasurementType) => rows.find((row) => row.type === type);

  const submit = async () => {
    const done = await action.run(() =>
      addMeasurement({
        horseId,
        type: form.type,
        value: Number(form.value.replace(',', '.')),
        measuredAt: new Date(form.measuredAt).toISOString(),
      }),
    );
    if (done !== undefined) {
      setOpen(false);
      setForm({ ...form, value: '' });
      reload();
    }
  };

  const chartPoints = rows
    .filter((row) => row.type === chartType)
    .map((row) => ({ x: new Date(row.measuredAt).getTime(), y: row.value }))
    .sort((a, b) => a.x - b.x);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-light text-gray-500">
          {isGroom
            ? 'Bạn thấy số đo mới nhất của cân nặng và thân nhiệt.'
            : 'Số đo ngoài khoảng bình thường được tô màu cảnh báo.'}
        </p>
        {canAdd && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Ghi số đo
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {types
          .filter((type) => !isGroom || type === 'WEIGHT' || type === 'TEMPERATURE')
          .map((type) => {
            const meta = measurementLabel[type];
            const record = latest(type);
            const out = record && (record.value < meta.min || record.value > meta.max);
            return (
              <Card key={type} tone={out ? 'warning' : 'default'}>
                <p className="text-xs text-gray-400">{meta.name}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${out ? 'text-amber-700' : 'text-gray-900'}`}>
                  {record ? record.value.toLocaleString('vi-VN') : '—'}
                  <span className="ml-1 text-sm font-medium text-gray-400">{meta.unit}</span>
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  Bình thường {meta.min}–{meta.max} {meta.unit}
                </p>
              </Card>
            );
          })}
      </div>

      {!isGroom && (
        <>
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>Biểu đồ theo thời gian</SectionTitle>
              <Select
                value={chartType}
                onChange={(event) => setChartType(event.target.value as MeasurementType)}
                className="w-48"
              >
                {types.map((type) => (
                  <option key={type} value={type}>
                    {measurementLabel[type].name}
                  </option>
                ))}
              </Select>
            </div>
            <LineChart
              series={[
                {
                  key: chartType,
                  label: measurementLabel[chartType].name,
                  color: chartColors.emerald,
                  points: chartPoints,
                },
              ]}
              band={{ from: measurementLabel[chartType].min, to: measurementLabel[chartType].max }}
              yLabel={`Đơn vị: ${measurementLabel[chartType].unit} · vùng xanh là khoảng bình thường`}
              formatX={(value) => formatDateShort(new Date(value))}
            />
          </Card>

          <Card>
            <SectionTitle>Lịch sử số đo</SectionTitle>
            {rows.length === 0 ? (
              <EmptyState title="Chưa có số đo nào" />
            ) : (
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {rows.map((row) => {
                  const meta = measurementLabel[row.type];
                  const out = row.value < meta.min || row.value > meta.max;
                  return (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-700">{meta.name}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(row.measuredAt)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm font-semibold tabular-nums ${out ? 'text-amber-600' : 'text-gray-800'}`}
                        >
                          {row.value.toLocaleString('vi-VN')} {meta.unit}
                        </span>
                        {(row.recordedBy === currentUser?.id || currentUser?.role === 'CLUB_MANAGER') && (
                          <button
                            onClick={async () => {
                              const done = await action.run(() => deleteMeasurement(row.id));
                              if (done !== undefined) reload();
                            }}
                            className="rounded-lg p-1.5 text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                            title="Xóa số đo"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {action.error && <ErrorBox message={action.error} />}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ghi số đo"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Quay lại
            </Button>
            <Button onClick={submit} disabled={action.pending}>
              {action.pending ? 'Đang lưu…' : 'Lưu số đo'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Loại chỉ số" required error={action.field === 'type' ? action.error : undefined}>
            <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as MeasurementType })}>
              {options.map((type) => (
                <option key={type} value={type}>
                  {measurementLabel[type].name} ({measurementLabel[type].unit})
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={`Giá trị (${measurementLabel[form.type].unit})`}
            required
            hint={`Khoảng bình thường ${measurementLabel[form.type].min}–${measurementLabel[form.type].max}`}
            error={action.field === 'value' ? action.error : undefined}
          >
            <Input
              value={form.value}
              onChange={(event) => setForm({ ...form, value: event.target.value })}
              placeholder="Ví dụ: 486"
            />
          </Field>
          <Field
            label="Thời điểm đo"
            required
            hint="Không ở tương lai, nhập lùi tối đa 7 ngày"
            error={action.field === 'measuredAt' ? action.error : undefined}
          >
            <Input
              type="datetime-local"
              max={`${toDateKey(now())}T23:59`}
              value={form.measuredAt}
              onChange={(event) => setForm({ ...form, measuredAt: event.target.value })}
            />
          </Field>
          {action.error && !action.field && <ErrorBox message={action.error} />}
        </div>
      </Modal>
    </div>
  );
}
