// Cây phả hệ 3 đời dạng lưới ngang: ngựa → cha mẹ → ông bà. Ô không khai báo để trống.
import { useNavigate } from 'react-router-dom';
import { EyeOff } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { getPedigree, type PedigreeNode } from '../../../services/horse.service';
import { Card, ErrorBox, Pill, Skeleton, cn, useToast } from '../../../components/ui';
import { DeletedPill } from '../../../components/ui/status';
import { lifecycleLabel, sexLabel } from '../../../lib/labels';
import { links } from '../../../lib/links';

function NodeCard({
  node,
  role,
  generation,
  onRestricted,
}: {
  node?: PedigreeNode;
  role: string;
  generation: 0 | 1 | 2;
  onRestricted: () => void;
}) {
  const navigate = useNavigate();
  const height = generation === 0 ? 'min-h-40 flex-1' : generation === 1 ? 'min-h-[104px] flex-1' : 'min-h-[72px] flex-1';

  if (!node) {
    return (
      <div
        className={cn(
          'flex flex-col justify-center rounded-xl border border-dashed border-gray-200 px-4 py-3',
          height,
        )}
      >
        <span className="text-xs text-gray-400">{role}</span>
        <span className="text-sm text-gray-400">Không khai báo</span>
      </div>
    );
  }

  const open = () => {
    if (node.restricted || !node.id) onRestricted();
    else if (generation > 0) navigate(links.horse(node.id, 'pedigree'));
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={generation === 0}
      className={cn(
        'group flex flex-col justify-center rounded-xl border px-4 py-3 text-left transition disabled:cursor-default [&>*]:shrink-0',
        height,
        generation === 0
          ? 'border-emerald-600/70 bg-white ring-1 ring-emerald-600/20'
          : node.restricted
            ? 'border-gray-200 bg-white hover:border-gray-300'
            : 'border-gray-200 bg-white hover:border-gray-400',
      )}
    >
      <span className="text-xs text-gray-500">{role}</span>
      <span className={cn('truncate font-semibold text-gray-900', generation === 0 ? 'text-2xl' : 'text-sm', generation > 0 && !node.restricted && 'group-hover:text-emerald-800')}>
        {node.name}
      </span>
      {node.restricted ? (
        <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <EyeOff size={12} className="text-gray-400" /> Không có quyền xem hồ sơ
        </span>
      ) : (
        <>
          <span className="text-xs text-gray-500">
            {node.sex ? sexLabel[node.sex] : ''}
            {node.birthYear ? ` · sinh ${node.birthYear}` : ''}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            {node.deleted && <DeletedPill />}
            {node.lifecycleStatus && node.lifecycleStatus !== 'ACTIVE' && <Pill tone="gray">{lifecycleLabel[node.lifecycleStatus]}</Pill>}
          </span>
        </>
      )}
    </button>
  );
}

export default function PedigreeTab({ horseId }: { horseId: string }) {
  const toast = useToast();
  const { data, loading, error } = useService(() => getPedigree(horseId), [horseId]);
  if (loading) return <Skeleton rows={4} />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được phả hệ'} />;

  const restricted = () => toast.push('Không có quyền xem hồ sơ này (404) — ngựa không thuộc sở hữu của bạn', 'error');

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">Phả hệ ba đời</p>
          <p className="text-sm text-gray-500">Bấm vào tổ tiên để mở hồ sơ.</p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr]">
        <div className="flex">
          <div className="flex w-full flex-col">
            <NodeCard node={data.horse} role="Ngựa" generation={0} onRestricted={restricted} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <NodeCard node={data.sire} role="Cha" generation={1} onRestricted={restricted} />
          <NodeCard node={data.dam} role="Mẹ" generation={1} onRestricted={restricted} />
        </div>
        <div className="flex flex-col gap-3">
          <NodeCard node={data.sireSire} role="Ông nội" generation={2} onRestricted={restricted} />
          <NodeCard node={data.sireDam} role="Bà nội" generation={2} onRestricted={restricted} />
          <NodeCard node={data.damSire} role="Ông ngoại" generation={2} onRestricted={restricted} />
          <NodeCard node={data.damDam} role="Bà ngoại" generation={2} onRestricted={restricted} />
        </div>
      </div>
    </Card>
  );
}
