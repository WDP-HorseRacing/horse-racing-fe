// Hàm, hằng dùng chung của form ghi và sửa buổi khám: đọc ô số đo, chuyển đổi dòng đơn thuốc.
import type { MeasurementType, Prescription, PrescriptionInput } from '../../../api/types';
import { measurementSpec } from '../../../lib/api-labels';

/* ===== Số đo ===== */

export const METRICS: MeasurementType[] = ['WEIGHT', 'TEMPERATURE', 'HEIGHT', 'BODY_CONDITION'];
export type MetricValues = Record<MeasurementType, string>;
/** Số đo hợp lệ: số nguyên hoặc thập phân tối đa 2 chữ số, dấu chấm hoặc phẩy. */
export const METRIC_PATTERN = /^\d+([.,]\d{1,2})?$/;
export const emptyMetrics = (): MetricValues => ({ WEIGHT: '', HEIGHT: '', BODY_CONDITION: '', TEMPERATURE: '' });

/** Đọc các ô số đo: giá trị hợp lệ, lỗi theo ô, và dòng ngoài khoảng bình thường để hỏi lại trước khi lưu. */
export function parseMetrics(values: MetricValues, types: MeasurementType[] = METRICS) {
  const parsed: { type: MeasurementType; value: number }[] = [];
  const errors: Partial<Record<MeasurementType, string>> = {};
  const abnormal: string[] = [];
  types.forEach((type) => {
    const text = values[type].trim();
    if (!text) return;
    const spec = measurementSpec[type];
    // Chỉ nhận số thập phân thường (450, 37,5): Number() còn đọc cả "0x20", "1e2".
    if (!METRIC_PATTERN.test(text)) {
      errors[type] = 'Nhập số, tối đa 2 chữ số sau dấu phẩy (vd 37,5)';
      return;
    }
    const raw = text.replace(',', '.');
    const value = Number(raw);
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

export type PrescriptionField = 'medicine' | 'dosage' | 'frequency' | 'startDate' | 'endDate';
/** Tên ô của một ô trong dòng thuốc, dùng cho useFormErrors. */
export const rxKey = (rowKey: number, field: PrescriptionField) => `rx.${rowKey}.${field}`;

/** Lỗi theo từng ô của dòng thuốc. `requireEnd`: buổi khám không mở bệnh án thì thuốc phải có ngày kết thúc. */
export function prescriptionErrors(rows: PrescriptionRow[], requireEnd: boolean) {
  const errors: Record<string, string> = {};
  rows.forEach((row) => {
    if (!row.medicine.trim()) errors[rxKey(row.key, 'medicine')] = 'Nhập tên thuốc';
    if (!row.dosage.trim()) errors[rxKey(row.key, 'dosage')] = 'Nhập liều lượng';
    if (!row.frequency.trim()) errors[rxKey(row.key, 'frequency')] = 'Nhập tần suất';
    if (!row.startDate) errors[rxKey(row.key, 'startDate')] = 'Chọn ngày bắt đầu';
    if (row.endDate && row.startDate && row.endDate < row.startDate) errors[rxKey(row.key, 'endDate')] = 'Ngày kết thúc phải từ ngày bắt đầu trở đi';
    else if (requireEnd && !row.endDate) errors[rxKey(row.key, 'endDate')] = 'Chọn ngày kết thúc (buổi khám không mở bệnh án)';
  });
  return errors;
}

/** Lỗi backend theo ô đơn thuốc ("prescriptions.0.medicine") đổi sang tên ô của form. */
export function mapServerFieldErrors(fieldErrors: Record<string, string>, rows: PrescriptionRow[]) {
  const mapped: Record<string, string> = {};
  Object.entries(fieldErrors).forEach(([field, message]) => {
    const match = /^prescriptions\.(\d+)\.(medicine|dosage|frequency|startDate|endDate)$/.exec(field);
    const row = match ? rows[Number(match[1])] : undefined;
    mapped[row && match ? rxKey(row.key, match[2] as PrescriptionField) : field] = message;
  });
  return mapped;
}

export const prescriptionInputs = (rows: PrescriptionRow[]): PrescriptionInput[] =>
  rows.map((row) => ({
    medicine: row.medicine.trim(),
    dosage: row.dosage.trim(),
    frequency: row.frequency.trim(),
    startDate: row.startDate,
    ...(row.endDate ? { endDate: row.endDate } : {}),
  }));
