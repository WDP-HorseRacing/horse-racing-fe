// Chọn loại chuyển nhượng: bán ra ngoài câu lạc bộ (đổi vòng đời) hoặc chuyển cho chủ khác trong câu lạc bộ (đổi chủ).
import type { ReactNode } from 'react';
import { ArrowLeftRight, ChevronRight, LogOut } from 'lucide-react';
import { Button, Modal, cn } from '../../../components/ui';

function Option({
  icon,
  title,
  description,
  disabledReason,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  disabledReason?: string;
  onSelect: () => void;
}) {
  const disabled = !!disabledReason;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl px-4 py-3.5 text-left ring-1 transition',
        disabled ? 'cursor-not-allowed bg-gray-50 ring-gray-100' : 'bg-white ring-gray-200 hover:bg-emerald-50/60 hover:ring-emerald-300',
      )}
    >
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', disabled ? 'bg-gray-100 text-gray-400' : 'bg-emerald-50 text-emerald-700')}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-semibold', disabled ? 'text-gray-400' : 'text-gray-900')}>{title}</span>
        <span className="mt-0.5 block text-sm text-gray-500">{description}</span>
        {disabledReason && <span className="mt-1 block text-xs font-medium text-amber-700">{disabledReason}</span>}
      </span>
      {!disabled && <ChevronRight size={16} className="mt-2 shrink-0 text-gray-400" />}
    </button>
  );
}

export default function TransferChooser({
  open,
  horseName,
  internalBlockedReason,
  onClose,
  onExternal,
  onInternal,
}: {
  open: boolean;
  horseName: string;
  /** Lý do không chuyển chủ nội bộ được (ví dụ ngựa chưa có chủ), undefined nếu được. */
  internalBlockedReason?: string;
  onClose: () => void;
  onExternal: () => void;
  onInternal: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Chuyển nhượng ${horseName}`}
      description="Chọn hình thức chuyển nhượng."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Quay lại
        </Button>
      }
    >
      <div className="space-y-2.5">
        <Option
          icon={<ArrowLeftRight size={16} />}
          title="Chuyển cho chủ khác trong câu lạc bộ"
          description="Chủ ngựa bán cho một chủ ngựa khác của câu lạc bộ. Ngựa ở lại, giữ khu, ô, Groom và lớp."
          disabledReason={internalBlockedReason}
          onSelect={onInternal}
        />
        <Option
          icon={<LogOut size={16} />}
          title="Bán ra ngoài câu lạc bộ"
          description="Ngựa rời câu lạc bộ. Trả ô, rời khu, kết thúc Groom, hồ sơ chuyển sang chỉ đọc."
          onSelect={onExternal}
        />
      </div>
    </Modal>
  );
}
