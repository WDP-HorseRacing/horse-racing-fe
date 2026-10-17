// Ô chọn chủ sở hữu: tài khoản chủ ngựa đang hoạt động, tự tải danh sách khi hiện.
// Dùng ở gán chủ, chuyển chủ nội bộ và kích hoạt lại ngựa đã chuyển nhượng (BE bắt buộc chọn chủ).
import { listAllUsers } from '../../../api/users';
import type { UserAccount } from '../../../api/types';
import { Select, cn, invalidClass } from '../../../components/ui';
import { useService } from '../../../hooks/useService';

export function OwnerSelect({
  value,
  onChange,
  exclude,
  invalid,
  disabled,
  placeholder = 'Chọn chủ sở hữu',
}: {
  value: string;
  onChange: (id: string, owner?: UserAccount) => void;
  /** Bỏ một tài khoản khỏi danh sách (vd chủ hiện tại khi chuyển chủ). */
  exclude?: string | null;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const owners = useService(() => listAllUsers({ role: 'HORSE_OWNER', status: 'ACTIVE' }), []);
  const list = (owners.data ?? []).filter((item) => item.id !== exclude);
  const loading = owners.loading && !owners.data;
  return (
    <Select
      value={value}
      disabled={disabled || loading}
      onChange={(event) => onChange(event.target.value, list.find((item) => item.id === event.target.value))}
      className={cn(invalid && invalidClass)}
    >
      <option value="">{loading ? 'Đang tải…' : placeholder}</option>
      {list.map((owner) => (
        <option key={owner.id} value={owner.id}>
          {owner.fullName} · {owner.email}
        </option>
      ))}
    </Select>
  );
}
