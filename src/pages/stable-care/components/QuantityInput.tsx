// Ô số lượng của kho (ngưỡng, tồn, số còn lại, số đề xuất, lượng món ăn): số không âm, tối đa 2 chữ số lẻ.
// Dấu thập phân là dấu phẩy. Gõ dấu chấm vẫn được, rời ô thì tự đổi thành phẩy. Chữ số lẻ thứ ba không nhận.
import type { InputHTMLAttributes } from 'react';
import { Input } from '../../../components/ui';
import { normalizeQuantity, sanitizeQuantity } from '../../../lib/stable-labels';

export function QuantityInput({
  value,
  onChange,
  onBlur,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & { value: string; onChange: (value: string) => void }) {
  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(event) => onChange(sanitizeQuantity(event.target.value))}
      onBlur={(event) => {
        const normalized = normalizeQuantity(value);
        if (normalized !== value) onChange(normalized);
        onBlur?.(event);
      }}
    />
  );
}
