// Cây phả hệ 3 đời dạng lưới ngang: ngựa → cha mẹ → ông bà. Ô không khai báo (hoặc tổ tiên đã xóa hồ sơ) để trống.
// Chủ ngựa chỉ thấy tên và vị trí của tổ tiên không thuộc sở hữu (canOpen = false), không mở được hồ sơ đó.
import { useNavigate } from 'react-router-dom';
import { EyeOff } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { getPedigree } from '../../../api/horses';
import type { PedigreeNode } from '../../../api/types';
import { Card, ErrorBox, Skeleton, cn, useToast } from '../../../components/ui';
import { sexLabel } from '../../../lib/labels';
import { links } from '../../../lib/links';

interface Node {
  id?: string;
  name: string;
  canOpen: boolean;
  gender?: PedigreeNode['gender'];
  dateOfBirth?: string | null;
}

function NodeCard({ node, role, generation, onRestricted }: { node?: Node; role: string; generation: 0 | 1 | 2; onRestricted: () => void }) {
  const navigate = useNavigate();
  const height = generation === 0 ? 'min-h-40 flex-1' : generation === 1 ? 'min-h-[104px] flex-1' : 'min-h-[72px] flex-1';

  if (!node) {
    return (
      <div className={cn('flex flex-col justify-center rounded-xl border border-dashed border-gray-200 px-4 py-3', height)}>
        <span className="text-xs text-gray-400">{role}</span>
        <span className="text-sm text-gray-400">Không khai báo</span>
      </div>
    );
  }

  const open = () => {
    if (!node.canOpen || !node.id) onRestricted();
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
        generation === 0 ? 'border-emerald-600/70 bg-white ring-1 ring-emerald-600/20' : 'border-gray-200 bg-white hover:border-gray-400',
      )}
    >
      <span className="text-xs text-gray-500">{role}</span>
      <span
        className={cn(
          'truncate font-semibold text-gray-900',
          generation === 0 ? 'text-2xl' : 'text-sm',
          generation > 0 && node.canOpen && 'group-hover:text-emerald-800',
        )}
      >
        {node.name}
      </span>
      {!node.canOpen ? (
        <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <EyeOff size={12} className="text-gray-400" /> Không thuộc sở hữu của bạn
        </span>
      ) : (
        <span className="text-xs text-gray-500">
          {node.gender ? sexLabel[node.gender] : ''}
          {node.dateOfBirth ? ` · sinh ${node.dateOfBirth.slice(0, 4)}` : ''}
        </span>
      )}
    </button>
  );
}

export default function PedigreeTab({ horseId }: { horseId: string }) {
  const toast = useToast();
  const { data, loading, error } = useService(() => getPedigree(horseId), [horseId]);
  if (loading) return <Skeleton rows={4} />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được phả hệ'} />;

  const restricted = () => toast.push('Hồ sơ này không thuộc sở hữu của bạn nên không mở được', 'error');
  const find = (childId: string | undefined, role: 'SIRE' | 'DAM', generation: number) =>
    childId ? data.ancestors.find((item) => item.childId === childId && item.parentRole === role && item.generation === generation) : undefined;
  const sire = find(data.horseId, 'SIRE', 1);
  const dam = find(data.horseId, 'DAM', 1);

  return (
    <Card>
      <div className="mb-4">
        <p className="font-semibold text-gray-900">Phả hệ ba đời</p>
        <p className="text-sm text-gray-500">Chỉ gồm ngựa có hồ sơ tại câu lạc bộ. Bấm vào tổ tiên để mở hồ sơ.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr]">
        <div className="flex">
          <div className="flex w-full flex-col">
            <NodeCard node={{ id: data.horseId, name: data.horseName, canOpen: true }} role="Ngựa" generation={0} onRestricted={restricted} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <NodeCard node={sire} role="Cha" generation={1} onRestricted={restricted} />
          <NodeCard node={dam} role="Mẹ" generation={1} onRestricted={restricted} />
        </div>
        <div className="flex flex-col gap-3">
          <NodeCard node={find(sire?.id, 'SIRE', 2)} role="Ông nội" generation={2} onRestricted={restricted} />
          <NodeCard node={find(sire?.id, 'DAM', 2)} role="Bà nội" generation={2} onRestricted={restricted} />
          <NodeCard node={find(dam?.id, 'SIRE', 2)} role="Ông ngoại" generation={2} onRestricted={restricted} />
          <NodeCard node={find(dam?.id, 'DAM', 2)} role="Bà ngoại" generation={2} onRestricted={restricted} />
        </div>
      </div>
    </Card>
  );
}
