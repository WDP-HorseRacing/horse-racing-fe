import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { listPlans } from '../../services/training.service';
import { listZones } from '../../services/horse.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { Avatar, Button, Card, EmptyState, PageHeader, Pill, Select, Skeleton } from '../../components/ui';
import { PlanPill } from '../../components/ui/status';
import { planStatusLabel } from '../../lib/labels';
import { formatDate } from '../../lib/format';

export default function PlanList() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [status, setStatus] = useState('');
  const [zoneId, setZoneId] = useState('');
  const zones = useService(() => listZones(), []);
  const { data, loading } = useService(() => listPlans({ status, zoneId }), [status, zoneId]);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Giáo án huấn luyện"
        description="Giáo án chia giai đoạn nối tiếp; mỗi giai đoạn có một tuần mẫu quy định cự ly, khối lượng và mặt sân."
        actions={
          can(currentUser, 'plan.edit') ? (
            <Button onClick={() => navigate('/training/plans/new')}>
              <Plus size={16} /> Lập giáo án
            </Button>
          ) : undefined
        }
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Mọi trạng thái</option>
            {Object.entries(planStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
            <option value="">Mọi khu chuồng</option>
            {zones.data?.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading && <Skeleton rows={4} />}
      {!loading && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="Chưa có giáo án nào khớp bộ lọc"
          hint="Bỏ bớt điều kiện lọc, hoặc lập giáo án mới cho ngựa trong khu bạn phụ trách."
        />
      )}

      <div className="space-y-3">
        {data?.map((plan) => (
          <Link key={plan.id} to={`/training/plans/${plan.id}`}>
            <Card className="transition hover:border-emerald-100 hover:shadow-[0_8px_24px_rgba(5,96,69,0.08)]">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar src={plan.horseAvatar} name={plan.horseName} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">{plan.horseName}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-700">{plan.name}</span>
                    <PlanPill status={plan.status} />
                    {plan.needsReview && <Pill tone="amber">Cần xem lại</Pill>}
                  </p>
                  <p className="mt-1 truncate text-sm font-light text-gray-500">{plan.goal}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-700">
                    {formatDate(plan.startDate)} → {formatDate(plan.endDate)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {plan.currentPhaseNo
                      ? `Giai đoạn ${plan.currentPhaseNo}/${plan.phaseCount}`
                      : `${plan.phaseCount} giai đoạn`}{' '}
                    · {plan.zoneName ?? '—'}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
