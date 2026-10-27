// Ô nhập tiền (đồng, số nguyên): chỉ nhận chữ số, tự chấm hàng nghìn khi gõ, chữ "đ" cố định ở cuối.
// Giá trị là chuỗi đã chấm ("18.000"), đọc ra số bằng parseMoney trong lib/format.
// Gõ dấu phẩy, dấu trừ hay chấm thập phân thì nhắc ngay dưới ô vì tiền đồng không có số lẻ, số âm.
import { useState, type InputHTMLAttributes } from 'react';
import { Input, cn } from './ui';
import { formatMoneyInput } from '../lib/format';

export function MoneyInput({
  value,
  onChange,
  onBlur,
  suffix = 'đ',
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  value: string;
  onChange: (value: string) => void;
  /** Chữ sau số, vd "đ" hoặc "đ/kg". */
  suffix?: string;
}) {
  const [note, setNote] = useState<string>();
  return (
    <div>
      <div className="relative">
        <Input
          {...rest}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            const raw = event.target.value;
            setNote(/[,-]|\.$|^\d{4,}\.\d{1,2}$/.test(raw.trim()) ? 'Số tiền tính bằng đồng, không có số lẻ hay số âm' : undefined);
            onChange(formatMoneyInput(raw));
          }}
          onBlur={(event) => {
            setNote(undefined);
            onBlur?.(event);
          }}
          className={cn('tabular-nums', className)}
          style={{ paddingRight: `${Math.max(2.25, suffix.length * 0.5 + 1.25)}rem` }}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">{suffix}</span>
      </div>
      {note && (
        <span role="status" className="mt-1 block text-xs font-medium text-amber-700">
          {note}
        </span>
      )}
    </div>
  );
}
