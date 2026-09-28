// Tab "Ngựa trong lớp": danh sách đang học và đã rút.
import { Link } from 'react-router-dom';
import { LogOut, UserPlus } from 'lucide-react';
import type { ClassDetail, EnrollmentRow } from '../../../services/training.service';
import { Avatar, Button, Card, EmptyState, Meter, Pill, SectionTitle } from '../../../components/ui';
import { EligibilityBadge, HealthPill } from '../../../components/ui/status';
import { enrollmentCloseLabel, intensityLabel } from '../../../lib/labels';
import { formatDate } from '../../../lib/format';
import { links } from '../../../lib/links';

export function ClassHorsesTab({
  detail,
  onEnroll,
  onWithdraw,
}: {
  detail: ClassDetail;
  onEnroll: () => void;
  onWithdraw: (row: EnrollmentRow) => void;
}) {
  const { active, withdrawn } = detail.enrollments;
  const full = detail.enrolled >= detail.capacity;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-8">
        <SectionTitle
          action={
            detail.canEnroll ? (
              <Button size="sm" onClick={onEnroll}>
                <UserPlus size={14} /> Đăng ký ngựa
              </Button>
            ) : undefined
          }
        >
          Đang học
          <span className="ml-1 font-normal text-gray-400 tabular-nums">
            {detail.ownerFiltered ? `${active.length} ngựa của bạn` : `${active.length}/${detail.capacity}`}
          </span>
        </SectionTitle>
        {!detail.ownerFiltered && (
          <Meter value={detail.enrolled} max={detail.capacity} tone={full ? 'amber' : 'green'} className="mb-4" />
        )}
        {active.length === 0 ? (
          <EmptyState
            title="Chưa có ngựa nào trong lớp"
            hint={detail.canEnroll ? 'Bấm "Đăng ký ngựa" để chọn ngựa thuộc khu của lớp.' : undefined}
          />
        ) : (
          <ul className="divide-y divide-gray-50">
            {active.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5">
                <Link to={links.horse(row.horseId)} className="flex min-w-[180px] flex-1 items-center gap-3">
                  <Avatar src={row.horseAvatar} name={row.horseName} size={42} />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 hover:text-emerald-800">{row.horseName}</p>
                    <p className="text-xs font-light text-gray-500">Groom {row.groomName ?? 'chưa phân công'}</p>
                  </div>
                </Link>
                <div className="w-32 text-sm">
                  <p className="text-xs font-light text-gray-400">Vào lớp</p>
                  <p className="text-gray-800 tabular-nums">{formatDate(row.joinedAt)}</p>
                </div>
                <div className="min-w-[180px] flex-1">
                  <div className="mb-1">
                    <HealthPill status={row.healthStatus} />
                  </div>
                  <EligibilityBadge
                    allowed={row.train.allowed}
                    reason={row.train.reason}
                    label={
                      detail.maxIntensity
                        ? `${row.train.allowed ? 'Được tập' : 'Không được tập'} mức ${intensityLabel[detail.maxIntensity]}`
                        : row.train.allowed
                          ? 'Được tập'
                          : 'Không được tập'
                    }
                  />
                </div>
                {row.canWithdraw && (
                  <Button size="sm" variant="ghost" onClick={() => onWithdraw(row)} className="hover:bg-red-50 hover:text-red-600">
                    <LogOut size={14} /> Rút khỏi lớp
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {active.some((row) => !row.train.allowed) && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Ngựa không được tập ở một buổi cụ thể sẽ được đánh dấu vắng riêng buổi đó (chặn y tế) khi bắt đầu buổi — lớp và các ngựa khác
            không bị ảnh hưởng.
          </p>
        )}
      </Card>

      <div className="space-y-4 lg:col-span-4">
        <Card variant="flat">
          <SectionTitle>
            Đã rút <span className="ml-1 font-normal text-gray-400 tabular-nums">{withdrawn.length}</span>
          </SectionTitle>
          {withdrawn.length === 0 ? (
            <p className="text-sm font-light text-gray-400">Chưa có ngựa nào rút khỏi lớp.</p>
          ) : (
            <ul className="space-y-2.5">
              {withdrawn.map((row) => (
                <li key={row.id} className="rounded-xl bg-white p-3 ring-1 ring-emerald-950/[0.05]">
                  <div className="flex items-center gap-2.5">
                    <Avatar src={row.horseAvatar} name={row.horseName} size={32} />
                    <Link to={links.horse(row.horseId)} className="min-w-0 flex-1 truncate font-medium text-gray-800 hover:text-emerald-800">
                      {row.horseName}
                    </Link>
                    {row.withdrawReason && (
                      <Pill tone={row.withdrawReason === 'MANUAL' ? 'slate' : 'orange'}>{enrollmentCloseLabel[row.withdrawReason]}</Pill>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 tabular-nums">
                    {formatDate(row.joinedAt)} → {formatDate(row.withdrawnAt)}
                    {row.withdrawnByName && ` · ${row.withdrawnByName}`}
                  </p>
                  {row.withdrawNote && <p className="mt-1 text-xs font-light text-gray-600">{row.withdrawNote}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="rounded-2xl border border-dashed border-emerald-900/10 p-4 text-xs font-light leading-relaxed text-gray-500">
          Rút ngựa chỉ đóng đăng ký: các buổi chưa diễn ra biến mất khỏi lịch của ngựa đó, không buổi học nào bị hủy. Hệ thống tự rút
          khi ngựa đổi khu chuồng, giải nghệ hoặc chuyển nhượng.
        </div>
      </div>
    </div>
  );
}
