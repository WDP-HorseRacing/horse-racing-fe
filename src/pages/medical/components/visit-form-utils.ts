// Hàm, hằng dùng chung của form ghi và sửa buổi khám: đọc ô số đo, chuyển đổi dòng đơn thuốc.
import type { MeasurementType, Prescription, PrescriptionInput } from '../../../api/types';
import { measurementSpec } from '../../../lib/api-labels';

/* ===== Số đo ===== */

export const METRICS: MeasurementType[] = ['WEIGHT', 'TEMPERATURE', 'HEIGHT', 'BODY_CONDITION'];
export type MetricValues = Record<MeasurementType, string>;
export const emptyMetrics = (): MetricValues => ({ WEIGHT: '', HEIGHT: '', BODY_CONDITION: '', TEMPERATURE: '' });

/** Đọc các ô số đo: giá trị hợp lệ, lỗi theo ô, và dòng ngoài khoảng bình thường để hỏi lại trước khi lưu. */
export function parseMetrics(values: MetricValues, types: MeasurementType[] = METRICS) {
  const parsed: { type: MeasurementType; value: number }[] = [];
  const errors: Partial<Record<MeasurementType, string>> = {};
  const abnormal: string[] = [];
  types.forEach((type) => {
    const raw = values[type].trim().replace(',', '.');
    if (!raw) return;
    const spec = measurementSpec[type];
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      errors[type] = 'Nhập một số';
      return;
    }
    if (value < spec.hardMin || value > spec.hardMax) {
      errors[type] = `Giá trị phải trong khoảng ${spec.hardMin}–${spec.hardMax} ${spec.unit}`;
      return;
    }
    if (value < spec.min || value > spec.max) abnormal.push(`${spec.name} ${raw} ${spec.unit} (bình thường ${spec.min}–${spec.max})`);
    parsed.push({ type, value });
  });
  return { parsed, errors, abnormal };
}

/* ===== Đơn thuốc ===== */

export interface PrescriptionRow {
  key: number;
  medicine: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string;
}

let rowKey = 0;
export const nextRowKey = () => (rowKey += 1);

export const prescriptionRowsOf = (items: Prescription[]): PrescriptionRow[] =>
  items.map((item) => ({
    key: nextRowKey(),
    medicine: item.medicine,
    dosage: item.dosage ?? '',
    frequency: item.frequency ?? '',
    startDate: item.startDate,
    endDate: item.endDate ?? '',
  }));

/** Lỗi theo dòng thuốc. `requireEnd`: buổi khám không mở bệnh án thì thuốc phải có ngày kết thúc. */
export function prescriptionErrors(rows: PrescriptionRow[], requireEnd: boolean) {
  const errors: Record<string, string> = {};
  rows.forEach((row) => {
    if (!row.medicine.trim() || !row.dosage.trim() || !row.frequency.trim() || !row.startDate) errors[`rx.${row.key}`] = 'Nhập đủ tên thuốc, liều, tần suất và ngày bắt đầu';
    else if (row.endDate && row.endDate < row.startDate) errors[`rx.${row.key}`] = 'Ngày kết thúc sớm hơn ngày bắt đầu';
    else if (requireEnd && !row.endDate) errors[`rx.${row.key}`] = 'Đơn thuốc của buổi khám không mở bệnh án phải có ngày kết thúc';
  });
  return errors;
}

export const prescriptionInputs = (rows: PrescriptionRow[]): PrescriptionInput[] =>
  rows.map((row) => ({
    medicine: row.medicine.trim(),
    dosage: row.dosage.trim(),
    frequency: row.frequency.trim(),
    startDate: row.startDate,
    ...(row.endDate ? { endDate: row.endDate } : {}),
  }));
