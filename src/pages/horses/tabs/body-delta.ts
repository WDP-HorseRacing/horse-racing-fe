// Chênh lệch của một chỉ số so với lần đo liền trước, hiện trên thẻ chỉ số và khi rê chuột trên biểu đồ.
// Cân nặng thêm phần trăm. Thân nhiệt, chiều cao, điểm thể trạng chỉ ghi số chênh lệch.
import type { MeasurementType } from '../../../api/types';

export interface MeasurementDelta {
  text: string;
  direction: 'up' | 'down' | 'same';
}

const UNIT: Record<MeasurementType, string> = {
  WEIGHT: 'kg',
  TEMPERATURE: '°C',
  HEIGHT: 'cm',
  BODY_CONDITION: 'điểm',
};

const number = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
/** Dấu trừ dùng ký tự "−" cho dễ đọc. */
const signed = (value: number) => `${value > 0 ? '+' : '−'}${number(Math.abs(value))}`;

export function measurementDelta(type: MeasurementType, current: number, previous: number | undefined): MeasurementDelta | undefined {
  if (previous === undefined) return undefined;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return { text: 'Không đổi', direction: 'same' };
  let text = `${signed(diff)} ${UNIT[type]}`;
  if (type === 'WEIGHT' && previous > 0) text += ` (${signed((diff / previous) * 100)}%)`;
  return { text, direction: diff > 0 ? 'up' : 'down' };
}
