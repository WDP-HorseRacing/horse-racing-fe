// Ô nhập tiền (đồng, số nguyên): chỉ nhận chữ số, tự chấm hàng nghìn khi gõ, chữ "đ" cố định ở cuối.
// Giá trị là chuỗi đã chấm ("18.000"), đọc ra số bằng parseMoney trong lib/format.
import type { InputHTMLAttributes } from 'react';
import { Input, cn } from './ui';
import { formatMoneyInput } from '../lib/format';

export function MoneyInput({
  value,
  onChange,
  suffix = 'đ',
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  value: string;
  onChange: (value: string) => void;
  /** Chữ sau số, vd "đ" hoặc "đ/kg". */
  suffix?: string;
}) {
  return (
    <div className="relative">
      <Input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(formatMoneyInput(event.target.value))}
        className={cn('tabular-nums', className)}
        style={{ paddingRight: `${Math.max(2.25, suffix.length * 0.5 + 1.25)}rem` }}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">{suffix}</span>
    </div>
  );
}
