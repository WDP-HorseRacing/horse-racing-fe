// Ô số lượng của kho (ngưỡng, tồn, số còn lại, số đề xuất, lượng món ăn): số không âm, tối đa 2 chữ số lẻ.
// Dấu thập phân là dấu phẩy. Gõ dấu chấm vẫn được, rời ô thì tự đổi thành phẩy. Chữ số lẻ thứ ba không nhận.
// Gõ chữ hay dấu trừ thì bỏ đi và nhắc ngay dưới ô (nhắc nổi, không đẩy bố cục).
import { useState, type InputHTMLAttributes } from 'react';
import { Input } from '../../../components/ui';
import { normalizeQuantity, sanitizeQuantity } from '../../../lib/stable-labels';

export function QuantityInput({
  value,
  onChange,
  onBlur,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & { value: string; onChange: (value: string) => void }) {
  const [note, setNote] = useState<string>();
  return (
    <div className="relative">
      <Input
        {...rest}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => {
          const raw = event.target.value;
          setNote(/[^\d.,\s]/.test(raw) ? 'Chỉ nhập số không âm, dùng dấu phẩy cho số lẻ' : undefined);
          onChange(sanitizeQuantity(raw));
        }}
        onBlur={(event) => {
          setNote(undefined);
          const normalized = normalizeQuantity(value);
          if (normalized !== value) onChange(normalized);
          onBlur?.(event);
        }}
      />
      {note && (
        <span role="status" className="absolute left-0 top-full z-10 mt-0.5 whitespace-nowrap rounded bg-white px-1 text-xs font-medium text-amber-700 shadow-sm">
          {note}
        </span>
      )}
    </div>
  );
}
