// "Ngựa đã bán" của chủ ngựa: các con mình từng sở hữu nay đã chuyển chủ nội bộ hoặc bán ra ngoài.
// Chỉ có thông tin cơ bản (ảnh, giới tính, ngày sinh, màu lông, phả hệ 2 đời chỉ tên) và các khoảng mình từng sở hữu.
// Không có chủ mới, khu, ô, sức khỏe. Các tab khác của hồ sơ ngựa chỉ dành cho chủ hiện tại.
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarRange } from 'lucide-react';
import { getPastHorse, listPastHorses } from '../../api/horses';
import type { OwnershipSpan, PedigreeNode } from '../../api/types';
import { useCrumbs } from '../../components/Breadcrumb';
import { BackLink } from '../../components/BackLink';
import { Avatar, EmptyState, ErrorBox, NotFound, PageHeader, Skeleton, cn } from '../../components/ui';
import { useService } from '../../hooks/useService';
import { ageOf, formatDate } from '../../lib/format';
import { colorText } from '../../lib/horse-options';
import { sexLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import { now } from '../../lib/clock';

const spanText = (span: OwnershipSpan) => `${formatDate(span.startedAt)} đến ${span.endedAt ? formatDate(span.endedAt) : 'nay'}`;

export default function PastHorses() {
  useCrumbs([{ label: 'Ngựa đã bán' }]);
  const list = useService(() => listPastHorses(), []);
  const rows = list.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Ngựa đã bán" description="Các con bạn từng sở hữu. Chỉ còn xem thông tin cơ bản và khoảng thời gian bạn sở hữu." />
      {list.loading && !list.data ? (
        <Skeleton rows={4} />
      ) : list.error ? (
        <ErrorBox message={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState title="Bạn chưa bán con ngựa nào" hint="Ngựa đã chuyển cho chủ khác hoặc bán ra ngoài câu lạc bộ sẽ hiện ở đây." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row, index) => (
            <li key={row.horseId} className={cn(index === 0 && rows.length > 2 && 'sm:col-span-2 xl:col-span-1')}>
              <Link
                to={links.pastHorse(row.horseId)}
                className="group flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 transition hover:ring-emerald-300 hover:shadow-raised"
              >
                <Avatar src={row.photoUrl ?? undefined} name={row.name} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900 group-hover:text-emerald-800">{row.name}</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
                    {row.periods.map((span) => (
                      <li key={span.startedAt} className="inline-flex items-center gap-1">
                        <CalendarRange size={12} /> {spanText(span)}
                      </li>
                    ))}
                  </ul>
                </div>
                <ArrowRight size={16} className="shrink-0 text-gray-300 group-hover:text-emerald-700" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PedigreeName({ node, role }: { node?: PedigreeNode; role: string }) {
  return (
    <div className={cn('rounded-xl px-3 py-2', node ? 'bg-gray-50 ring-1 ring-gray-100' : 'border border-dashed border-gray-200')}>
      <p className="text-xs text-gray-500">{role}</p>
      <p className={cn('truncate text-sm font-medium', node ? 'text-gray-900' : 'text-gray-400')}>{node?.name ?? 'Không khai báo'}</p>
    </div>
  );
}

export function PastHorseDetail() {
  const { id = '' } = useParams();
  const detail = useService(() => getPastHorse(id), [id]);
  const horse = detail.data;
  useCrumbs(horse ? [{ label: 'Ngựa đã bán', to: links.pastHorses }, { label: horse.name }] : null);

  if (detail.loading && !horse) return <Skeleton rows={5} />;
  if (detail.error || !horse) return <NotFound message={detail.error && !detail.error.startsWith('Không tìm thấy') ? detail.error : undefined} />;

  const parent = (childId: string, role: 'SIRE' | 'DAM') => horse.ancestors.find((node) => node.childId === childId && node.parentRole === role);
  const sire = parent(horse.horseId, 'SIRE');
  const dam = parent(horse.horseId, 'DAM');
  const age = ageOf(horse.dateOfBirth ?? undefined, now());
  const facts = [
    { label: 'Giới tính', value: horse.gender ? sexLabel[horse.gender] : 'Chưa rõ' },
    { label: 'Ngày sinh', value: horse.dateOfBirth ? `${formatDate(horse.dateOfBirth)}${age !== undefined ? ` (${age} tuổi)` : ''}` : 'Chưa rõ' },
    { label: 'Màu lông', value: colorText(horse.color) ?? 'Chưa rõ' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader back={<BackLink fallback={links.pastHorses} />} title={horse.name} description="Ngựa bạn đã bán. Thông tin hiện tại của ngựa thuộc về chủ mới." />
      <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
        <section className="flex items-center gap-5 rounded-2xl bg-white p-5 ring-1 ring-gray-200/80 lg:col-span-7">
          <Avatar src={horse.photoUrl ?? undefined} name={horse.name} size={96} />
          <dl className="grid flex-1 gap-3 sm:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs text-gray-500">{fact.label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-gray-900">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-2xl bg-emerald-50/70 p-5 ring-1 ring-emerald-700/10 lg:col-span-5">
          <h3 className="text-sm font-semibold text-emerald-950">Thời gian bạn sở hữu</h3>
          <ul className="mt-2 space-y-1.5">
            {horse.periods.map((span) => (
              <li key={span.startedAt} className="inline-flex w-full items-center gap-2 tabular-nums text-sm text-emerald-900">
                <CalendarRange size={14} className="shrink-0" /> {spanText(span)}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-gray-200/80">
        <h3 className="text-sm font-semibold text-gray-900">Phả hệ</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            { role: 'Cha', node: sire, grand: ['Ông nội', 'Bà nội'] },
            { role: 'Mẹ', node: dam, grand: ['Ông ngoại', 'Bà ngoại'] },
          ].map(({ role, node, grand }) => (
            <div key={role} className="space-y-2">
              <PedigreeName role={role} node={node} />
              <div className="grid grid-cols-2 gap-2 pl-4">
                <PedigreeName role={grand[0]} node={node ? parent(node.id, 'SIRE') : undefined} />
                <PedigreeName role={grand[1]} node={node ? parent(node.id, 'DAM') : undefined} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
