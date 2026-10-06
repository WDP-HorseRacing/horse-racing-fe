import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarPlus, Plus } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { listPrograms, type ProgramRow } from '../../../services/training.service';
import { Button, EmptyState, ErrorBox, PageHeader, Reveal, SearchInput, Skeleton, Toolbar } from '../../../components/ui';
import { IntensityMeter } from '../../../components/ui/status';
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
        title="Giáo án"
        description="Khuôn mẫu các môn học theo giai đoạn, ngày và ngựa chỉ xuất hiện khi mở lớp từ giáo án."
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
            <span className="font-medium text-gray-900 tabular-nums">{data.rows.length}</span> giáo án ·{' '}
            <span className="font-medium text-gray-900 tabular-nums">
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
          {rows.map((row) => (
            <ProgramCard
              key={row.id}
              row={row}
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
  canOpenClass,
  onOpen,
  onOpenClass,
}: {
  row: ProgramRow;
  canOpenClass: boolean;
  onOpen: () => void;
  onOpenClass: () => void;
}) {
  const { summary } = row;
  return (
    <article
      data-reveal
      className="grid gap-5 rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80 transition-colors hover:ring-gray-300 sm:p-6 lg:grid-cols-12"
    >
      <div className="min-w-0 lg:col-span-4">
        <Link to={links.program(row.id)} className="text-lg font-bold leading-tight text-gray-900 hover:text-emerald-700">
          {row.name}
        </Link>
        <p className="mt-0.5 text-xs text-gray-500">Soạn bởi {row.createdByName}</p>
        {row.description && <p className="mt-3 line-clamp-3 text-sm text-gray-600">{row.description}</p>}
      </div>

      <div className="min-w-0 space-y-4 lg:col-span-5">
        <PhaseTimeline phases={summary.phases} size="md" showRuler />
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500">Thời lượng</dt>
            <dd className="font-medium text-gray-900 tabular-nums">
              {summary.totalWeeks} tuần · {row.phaseCount} giai đoạn
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Tổng buổi</dt>
            <dd className="font-medium text-gray-900 tabular-nums">{summary.totalSessions} buổi</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Khối lượng đỉnh</dt>
            <dd className="font-medium text-gray-900 tabular-nums">{volumeLabel(summary.peakWeeklyVolumeM)}/tuần</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col justify-between gap-4 lg:col-span-3 lg:border-l lg:border-gray-100 lg:pl-5">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gray-500">Cường độ cao nhất</dt>
            <dd>{summary.maxIntensity ? <IntensityMeter intensity={summary.maxIntensity} /> : '—'}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gray-500">Lớp đang dùng</dt>
            <dd className="font-medium text-gray-900 tabular-nums">
              {row.openClassCount > 0 ? (
                `${row.openClassCount} lớp`
              ) : (
                <span className="font-normal text-gray-500">
                  {row.classCount > 0 ? `${row.classCount} lớp đã xong` : 'Chưa có lớp'}
                </span>
              )}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {canOpenClass && (
            <Button size="sm" variant="secondary" onClick={onOpenClass}>
              <CalendarPlus size={14} /> Mở lớp từ giáo án này
            </Button>
          )}
          <Button size="sm" variant="inline" onClick={onOpen}>
            Chi tiết <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </article>
  );
}
