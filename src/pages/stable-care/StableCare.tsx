// F4 — Chăm sóc theo khu (HLV, Quản lý CLB): bảng ngựa của một khu với Groom phụ trách, checklist hôm nay,
// tình trạng khẩu phần và số sự cố đang mở. Bấm một dòng để sang tab Chăm sóc của ngựa (lập khẩu phần, gắn việc riêng).
// BE chưa có API theo khu: mỗi ngựa gọi checklist hôm nay và khẩu phần (khu tối đa 9 ô). Quản lý CLB mở được sheet Loại việc.
// Checklist do BE tạo sẵn lúc 00:05 cho ngựa có Groom. Ngựa chưa có checklist thì tra Groom đang giao để phân biệt
// "chưa có Groom" với "hôm nay không có việc".
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ListChecks, Package, Settings2, Siren, Utensils } from 'lucide-react';
import { listAllHorses } from '../../api/horses';
import { listBarns, listGroomHistory } from '../../api/stable';
import { listChecklists, listFeedingPlans, listIncidents } from '../../api/stable-care';
import { listLowStock } from '../../api/supplies';
import type { DailyChecklist, FeedingPlan, HorseListItem } from '../../api/types';
import { useCrumbs } from '../../components/Breadcrumb';
import { Avatar, Button, ChipFilter, EmptyState, ErrorBox, Meter, NotFound, PageHeader, Pill, Skeleton, Stat, cn } from '../../components/ui';
import { HealthPill } from '../../components/ui/status';
import { useMyScope } from '../../hooks/useMyScope';
import { useService } from '../../hooks/useService';
import { clubToday } from '../../lib/club-time';
import { links } from '../../lib/links';
import { useStore } from '../../store/store';
import { inClub } from '../dashboard/data';
import { checklistProgress } from './care-helpers';
import { ChecklistPill } from './components/Checklist';
import { TaskTypesSheet } from './components/TaskTypesSheet';

interface Row {
  horse: HorseListItem;
  checklist: DailyChecklist | null;
  /** Groom đang giao: lấy từ checklist, không có checklist thì từ lịch sử giao Groom. */
  groomName: string | null;
  plans: FeedingPlan[];
  incidents: number;
}

async function loadBarn(barnId: string) {
  const today = clubToday();
  const [horses, incidents] = await Promise.all([listAllHorses({ barnId }), listIncidents({ status: 'OPEN', barnId })]);
  const rows: Row[] = await Promise.all(
    horses
      .filter(inClub)
      // Theo mã ô, ngựa chưa xếp ô xuống cuối.
      .sort((a, b) => (a.location.stall?.code ?? '~').localeCompare(b.location.stall?.code ?? '~') || a.name.localeCompare(b.name, 'vi'))
      .map(async (horse) => {
        const [checklists, plans] = await Promise.all([listChecklists(horse.id, today, today).catch(() => []), listFeedingPlans(horse.id).catch(() => [])]);
        const checklist = checklists[0] ?? null;
        const groomName = checklist
          ? checklist.groom.fullName
          : ((await listGroomHistory(horse.id).catch(() => [])).find((assignment) => !assignment.endAt)?.groom?.fullName ?? null);
        return { horse, checklist, groomName, plans, incidents: incidents.filter((item) => item.horseId === horse.id).length };
      }),
  );
  return { rows, incidents: incidents.length };
}

export default function StableCare() {
  const user = useStore((state) => state.currentUser);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [typesOpen, setTypesOpen] = useState(false);
  const manager = user?.role === 'CLUB_MANAGER';
  const trainer = user?.role === 'HEAD_TRAINER';
  const { scope, loading: scopeLoading } = useMyScope();

  const allBarns = useService(() => (manager ? listBarns() : Promise.resolve([])), [manager]);
  const barns = manager ? (allBarns.data ?? []) : (scope?.myBarns ?? []);
  const barnId = params.get('barn') && barns.some((barn) => barn.id === params.get('barn')) ? params.get('barn')! : barns[0]?.id;
  const barn = barns.find((item) => item.id === barnId);
  const data = useService(() => (barnId ? loadBarn(barnId) : Promise.resolve(null)), [barnId]);
  const low = useService(() => listLowStock(), []);
  useCrumbs([{ label: 'Chăm sóc khu' }]);

  if (!manager && !trainer) return <NotFound message="Trang này dành cho HLV trưởng và Quản lý câu lạc bộ." />;

  const rows = data.data?.rows ?? [];
  const withChecklist = rows.filter((row) => row.checklist);
  const doneCount = withChecklist.filter((row) => row.checklist?.status === 'COMPLETED').length;
  const noPlan = rows.filter((row) => !row.plans.some((plan) => plan.status === 'ACTIVE')).length;

  const pickBarn = (id: string) => setParams({ barn: id }, { replace: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title={barn ? `Chăm sóc ${barn.name}` : 'Chăm sóc khu'}
        description="Bấm vào ngựa để xem việc, khẩu phần và sự cố."
        actions={
          manager && (
            <Button variant="secondary" onClick={() => setTypesOpen(true)}>
              <Settings2 size={16} /> Loại việc
            </Button>
          )
        }
      />

      {barns.length > 1 && <ChipFilter value={barnId ?? ''} onChange={pickBarn} options={barns.map((item) => ({ value: item.id, label: item.name }))} />}

      {(manager ? allBarns.loading && !allBarns.data : scopeLoading) ? (
        <Skeleton rows={6} />
      ) : !barnId ? (
        <EmptyState title={trainer ? 'Bạn chưa phụ trách khu nào' : 'Chưa có khu chuồng nào'} hint={trainer ? 'Quản lý CLB giao khu cho HLV trưởng ở Sơ đồ chuồng.' : undefined} />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              value={withChecklist.length ? `${doneCount}/${withChecklist.length}` : 0}
              label="Ngựa xong checklist hôm nay"
              icon={<ListChecks size={18} />}
              tone={withChecklist.length && doneCount < withChecklist.length ? 'warning' : 'default'}
            />
            <Stat value={noPlan} label="Ngựa chưa có khẩu phần" icon={<Utensils size={18} />} tone="warning" />
            <Stat value={data.data?.incidents ?? 0} label="Sự cố đang mở" icon={<Siren size={18} />} tone="danger" onClick={() => navigate(links.incidents())} />
            <Stat value={low.data?.length ?? 0} label="Vật tư sắp hết" icon={<Package size={18} />} tone="warning" onClick={() => navigate(links.supplies())} />
          </section>

          {data.loading && !data.data ? (
            <Skeleton rows={6} />
          ) : data.error ? (
            <ErrorBox message={data.error} />
          ) : rows.length === 0 ? (
            <EmptyState title="Khu này chưa có ngựa" />
          ) : (
            <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-200/80">
              <div className="hidden grid-cols-12 gap-3 border-b border-gray-100 px-4 py-2.5 text-xs font-medium text-gray-500 md:grid">
                <span className="col-span-4">Ngựa</span>
                <span className="col-span-4">Checklist hôm nay</span>
                <span className="col-span-2">Khẩu phần</span>
                <span className="col-span-2 text-right">Sự cố mở</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const progress = checklistProgress(row.checklist);
                  const active = row.plans.some((plan) => plan.status === 'ACTIVE');
                  const draft = row.plans.some((plan) => plan.status === 'DRAFT');
                  return (
                    <li key={row.horse.id}>
                      <Link to={links.horse(row.horse.id, 'care')} className="grid grid-cols-2 items-center gap-3 px-4 py-3 transition hover:bg-emerald-50/40 md:grid-cols-12">
                        <span className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-4">
                          <Avatar src={row.horse.photoUrl ?? undefined} name={row.horse.name} size={40} className="rounded-xl" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-gray-900">{row.horse.name}</span>
                            <span className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                              {row.horse.location.stall?.code ?? 'Chưa xếp ô'} · {row.groomName ? `Groom ${row.groomName}` : 'Chưa có Groom'}
                              <HealthPill status={row.horse.healthStatus} />
                            </span>
                          </span>
                        </span>
                        <span className="col-span-2 md:col-span-4">
                          {row.checklist ? (
                            <span className="flex items-center gap-3">
                              <Meter value={progress.done} max={progress.total} tone={row.checklist.status === 'COMPLETED' ? 'green' : 'amber'} className="max-w-40" />
                              <span className="font-mono text-xs tabular-nums text-gray-700">
                                {progress.done}/{progress.total}
                              </span>
                              <ChecklistPill status={row.checklist.status} />
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">{row.groomName ? 'Hôm nay không có việc' : 'Không có checklist'}</span>
                          )}
                        </span>
                        <span className="md:col-span-2">
                          <Pill tone={active ? 'green' : 'amber'}>{active ? 'Đang áp dụng' : 'Chưa có'}</Pill>
                          {draft && <span className="ml-1.5 text-xs text-amber-700">có nháp</span>}
                        </span>
                        <span className={cn('text-right font-mono text-sm md:col-span-2', row.incidents ? 'font-bold text-red-700' : 'text-gray-400')}>{row.incidents}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {typesOpen && <TaskTypesSheet onClose={() => setTypesOpen(false)} />}
    </div>
  );
}
