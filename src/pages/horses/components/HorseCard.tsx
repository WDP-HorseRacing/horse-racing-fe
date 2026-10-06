// Thẻ ảnh của một con ngựa trong Danh sách ngựa (chế độ Thẻ): ảnh 4:3 hoặc họa tiết sọc cỏ,
// tình trạng bất thường nổi trên ảnh, mã ô kiểu số áo đua, dòng nhận dạng và chỗ ở.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import type { HorseListItem } from '../../../api/types';
import { TurfPlaceholder } from '../../../components/TurfPlaceholder';
import { cn } from '../../../components/ui';
import { DeletedPill, LifecyclePill } from '../../../components/ui/status';
import { healthLabel, sexLabel } from '../../../lib/labels';
import { placementStatusLabel } from '../../../lib/api-labels';
import { breedLabel } from '../../../lib/horse-options';
import { links } from '../../../lib/links';
import { isReadOnlyHorse } from '../../../lib/horse-rules';

const HEALTH_BADGE: Record<string, string> = {
  UNDER_OBSERVATION: 'bg-amber-500/90 text-white',
  INJURED: 'bg-red-600/90 text-white',
  QUARANTINED: 'bg-white/95 text-red-700 ring-1 ring-red-300',
};

export function HorseCard({ horse, age, index = 0 }: { horse: HorseListItem; age?: number; index?: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const { barn, stall, placementStatus } = horse.location;
  const locked = !horse.isDeleted && horse.lifecycleStatus === 'ACTIVE' && horse.healthStatus === 'ELIGIBLE' && !horse.canRegisterRace;
  const muted = isReadOnlyHorse(horse);
  const identity = [horse.gender ? sexLabel[horse.gender] : undefined, breedLabel(horse.breed), age !== undefined ? `${age} tuổi` : undefined].filter(Boolean).join(' · ');
  const place =
    placementStatus === 'PLACED'
      ? barn?.name
      : placementStatus === 'NOT_APPLICABLE'
        ? placementStatusLabel.NOT_APPLICABLE
        : `${barn?.name ? `${barn.name} · ` : ''}${placementStatusLabel[placementStatus].toLowerCase()}`;

  return (
    <Link
      to={links.horse(horse.id)}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
      className={cn(
        'card-rise group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200/80 transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_44px_-28px_rgba(6,78,59,0.6)] hover:ring-emerald-200',
        muted && 'opacity-60',
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <TurfPlaceholder name={horse.name} size="sm" className="absolute inset-0" />
        {horse.photoUrl && !failed && (
          <img
            src={horse.photoUrl}
            alt={horse.name}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn('absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]', loaded ? 'opacity-100' : 'opacity-0')}
          />
        )}
        <span className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/25 to-transparent" />
        <span className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
          {!horse.isDeleted && horse.healthStatus !== 'ELIGIBLE' && (
            <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur', HEALTH_BADGE[horse.healthStatus])}>{healthLabel[horse.healthStatus]}</span>
          )}
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-600/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              <Lock size={10} /> Khóa huấn luyện
            </span>
          )}
        </span>
        {stall && <span className="saddle-tag absolute right-2.5 top-2.5 text-[11px]">{stall.code}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-base font-semibold text-gray-900">{horse.name}</p>
          {horse.isDeleted ? <DeletedPill /> : horse.lifecycleStatus !== 'ACTIVE' && <LifecyclePill status={horse.lifecycleStatus} />}
        </div>
        <p className="truncate text-[13px] text-gray-500">{identity || 'Chưa rõ giới tính, giống'}</p>
        <p className={cn('mt-auto truncate pt-1 text-xs', placementStatus === 'PENDING_BARN' || placementStatus === 'PENDING_STALL' ? 'font-medium text-amber-800' : 'text-gray-400')}>{place}</p>
      </div>
    </Link>
  );
}
