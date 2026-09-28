import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarPlus, Layers, Plus } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { listPrograms, type ProgramRow } from '../../../services/training.service';
import { Button, cn, EmptyState, ErrorBox, PageHeader, Pill, Reveal, SearchInput, Skeleton, Toolbar } from '../../../components/ui';
import { IntensityPill } from '../../../components/ui/status';
import { links } from '../../../lib/links';
import { PhaseTimeline } from '../setup-components/PhaseTimeline';
import { volumeLabel } from '../setup-components/helpers';

export default function ProgramList() {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => listPrograms(), []);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi');
    return (data?.rows ?? []).filter(
      (row) => !term || `${row.name} ${row.description ?? ''}`.toLocaleLowerCase('vi').includes(term),
    );
  }, [data, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Huấn luyện · giáo án"
        title="Giáo án"
        description="Giáo án là khuôn mẫu: các môn học xếp theo giai đoạn, số buổi mỗi tuần. Giáo án không có ngày và không gắn với con ngựa nào — ngày và ngựa chỉ xuất hiện khi mở lớp từ giáo án."
        actions={
          data?.canManage ? (
            <Button onClick={() => navigate(links.programNew)}>
              <Plus size={16} /> Soạn giáo án
            </Button>
          ) : undefined
        }
      />

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm giáo án…" className="min-w-[220px] flex-1" />
        {data && (
          <span className="px-2 text-sm text-gray-500">
            <span className="font-semibold text-gray-900 tabular-nums">{data.rows.length}</span> giáo án ·{' '}
            <span className="font-semibold text-gray-900 tabular-nums">
              {data.rows.reduce((sum, row) => sum + row.openClassCount, 0)}
            </span>{' '}
            lớp đang chạy hoặc sắp tới
          </span>
        )}
      </Toolbar>

      {error && <ErrorBox message={error} />}
      {loading && !data && <Skeleton rows={4} />}
      {data && rows.length === 0 && (
        <EmptyState
          title={data.rows.length === 0 ? 'Chưa có giáo án nào' : 'Không có giáo án khớp từ khóa'}
          hint={data.canManage ? 'Soạn giáo án đầu tiên từ các môn học có sẵn.' : undefined}
        />
      )}

      {rows.length > 0 && (
        <Reveal className="space-y-4">
          {rows.map((row, index) => (
            <ProgramCard
              key={row.id}
              row={row}
              featured={index === 0 && !search}
              canOpenClass={!!data?.canOpenClass}
              onOpen={() => navigate(links.program(row.id))}
              onOpenClass={() => navigate(`${links.classNew}?programId=${row.id}`)}
            />
          ))}
        </Reveal>
      )}
    </div>
  );
}

function ProgramCard({
  row,
  featured,
  canOpenClass,
  onOpen,
  onOpenClass,
}: {
  row: ProgramRow;
  featured: boolean;
  canOpenClass: boolean;
  onOpen: () => void;
  onOpenClass: () => void;
}) {
  const { summary } = row;
  return (
    <article
      data-reveal
      className={cn(
        'group grid gap-5 rounded-2xl bg-white p-5 ring-1 transition-all duration-200 hover:-translate-y-0.5 sm:p-6 lg:grid-cols-12',
        featured ? 'shadow-grass-lift ring-emerald-200/70' : 'shadow-grass ring-emerald-950/[0.04]',
      )}
    >
      <div className="min-w-0 lg:col-span-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              featured ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700',
            )}
          >
            <Layers size={18} />
          </span>
          <div className="min-w-0">
            <Link to={links.program(row.id)} className="text-lg font-bold leading-tight text-gray-900 hover:text-emerald-800">
              {row.name}
            </Link>
            <p className="mt-0.5 text-xs font-light text-gray-400">Soạn bởi {row.createdByName}</p>
          </div>
        </div>
        {row.description && <p className="mt-3 line-clamp-3 text-sm font-light text-gray-600">{row.description}</p>}
      </div>

      <div className="min-w-0 space-y-4 lg:col-span-5">
        <PhaseTimeline phases={summary.phases} size="md" showRuler />
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs font-light text-gray-400">Thời lượng</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">
              {summary.totalWeeks} tuần · {row.phaseCount} giai đoạn
            </dd>
          </div>
          <div>
            <dt className="text-xs font-light text-gray-400">Tổng buổi</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{summary.totalSessions} buổi</dd>
          </div>
          <div>
            <dt className="text-xs font-light text-gray-400">Khối lượng đỉnh</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{volumeLabel(summary.peakWeeklyVolumeM)}/tuần</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-xl bg-emerald-50/50 p-4 lg:col-span-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500">Cường độ cao nhất</span>
            {summary.maxIntensity ? <IntensityPill intensity={summary.maxIntensity} /> : <span>—</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500">Lớp đang dùng</span>
            {row.openClassCount > 0 ? (
              <Pill tone="green">{row.openClassCount} lớp</Pill>
            ) : (
              <span className="text-xs font-light text-gray-400">
                {row.classCount > 0 ? `${row.classCount} lớp đã xong` : 'Chưa có lớp'}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOpenClass && (
            <Button size="sm" onClick={onOpenClass}>
              <CalendarPlus size={14} /> Mở lớp từ giáo án này
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onOpen}>
            Chi tiết <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </article>
  );
}
