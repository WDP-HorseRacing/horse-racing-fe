// Cây phả hệ 3 đời thu nhỏ ở thẻ hồ sơ khi thêm / sửa ngựa: ngựa đang nhập → cha / mẹ → ông bà.
// Chỉ phản chiếu lựa chọn trong biểu mẫu; ông bà lấy từ cha mẹ đã chọn (danh sách ngựa đã tải sẵn).
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../../components/ui';

export interface PedigreeNode {
  id: string;
  name: string;
}

type Side = 'sire' | 'dam';

function Box({ node, side, role, size = 'md' }: { node?: PedigreeNode | null; side: Side; role: string; size?: 'md' | 'sm' }) {
  const tone = side === 'sire' ? 'bg-emerald-50/80 ring-emerald-200/70' : 'bg-amber-50/80 ring-amber-200/70';
  return (
    <div className="relative min-w-0">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={node?.id ?? 'empty'}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={cn(
            'rounded-lg px-2 ring-1',
            size === 'md' ? 'py-1.5' : 'py-1',
            node ? tone : 'border border-dashed border-gray-200 bg-white ring-0',
          )}
        >
          <p className="text-[10px] font-medium text-gray-500">{role}</p>
          <p className={cn('truncate font-semibold', size === 'md' ? 'text-[13px]' : 'text-xs', node ? 'text-gray-900' : 'font-normal text-gray-400')} title={node?.name}>
            {node?.name ?? (size === 'md' ? 'Không khai báo' : '—')}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Ngoặc nối một ô ở cột trước với hai ô ở cột sau. */
function Bracket() {
  return (
    <div className="flex w-3 shrink-0 items-stretch py-[22%]" aria-hidden>
      <div className="w-full rounded-l-md border-y border-l border-gray-300" />
    </div>
  );
}

function Pair({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col justify-around gap-1.5">{children}</div>;
}

export function PedigreeMini({
  name,
  sire,
  dam,
  grand,
}: {
  name: string;
  sire?: PedigreeNode | null;
  dam?: PedigreeNode | null;
  /** Ông bà: cha của cha, mẹ của cha, cha của mẹ, mẹ của mẹ. */
  grand: { sireSire?: PedigreeNode | null; sireDam?: PedigreeNode | null; damSire?: PedigreeNode | null; damDam?: PedigreeNode | null };
}) {
  return (
    <div className="rounded-2xl bg-gray-50/80 p-3.5 ring-1 ring-gray-100">
      <p className="mb-2.5 text-sm font-semibold text-gray-900">Phả hệ</p>
      <div className="flex items-stretch">
        <div className="flex w-[28%] shrink-0 items-center">
          <div className="w-full rounded-lg bg-white px-2 py-2 shadow-[0_6px_14px_-10px_rgba(6,78,59,0.5)] ring-1 ring-gray-200">
            <p className="text-[10px] font-medium text-gray-500">Ngựa</p>
            <p className="truncate text-[13px] font-bold text-gray-900" title={name}>
              {name.trim() || 'Chưa đặt tên'}
            </p>
          </div>
        </div>
        <Bracket />
        <Pair>
          <Box node={sire} side="sire" role="Cha" />
          <Box node={dam} side="dam" role="Mẹ" />
        </Pair>
        <div className="flex w-3 shrink-0 flex-col justify-around" aria-hidden>
          <div className="h-[38%] rounded-l-md border-y border-l border-gray-300" />
          <div className="h-[38%] rounded-l-md border-y border-l border-gray-300" />
        </div>
        <Pair>
          <Box node={grand.sireSire} side="sire" role="Ông nội" size="sm" />
          <Box node={grand.sireDam} side="sire" role="Bà nội" size="sm" />
          <Box node={grand.damSire} side="dam" role="Ông ngoại" size="sm" />
          <Box node={grand.damDam} side="dam" role="Bà ngoại" size="sm" />
        </Pair>
      </div>
    </div>
  );
}
