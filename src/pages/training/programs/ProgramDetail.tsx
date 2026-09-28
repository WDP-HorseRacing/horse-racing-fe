import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import { deleteProgram, getProgram, type ProgramPhaseDetail } from '../../../services/training.service';
import {
  Button,
  Card,
  cn,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Meter,
  NotFound,
  PageHeader,
  Pill,
  SectionTitle,
  Skeleton,
  Tip,
  useToast,
} from '../../../components/ui';
import { ClassPill, IntensityPill } from '../../../components/ui/status';
import { surfaceLabel, workoutLabel } from '../../../lib/labels';
import { formatDate } from '../../../lib/format';
import { links } from '../../../lib/links';
import { PhaseTimeline } from '../setup-components/PhaseTimeline';
import { phaseTone, volumeLabel, workoutLine } from '../setup-components/helpers';

export default function ProgramDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error } = useService(() => getProgram(id), [id]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useAction();

  if (loading && !data) return <Skeleton rows={8} />;
  if (error || !data) return <NotFound message={error} />;

  const { summary } = data;

  const doDelete = async () => {
    const done = await remove.run(() => deleteProgram(data.id));
    if (done) {
      toast.push(`Đã xóa giáo án "${data.name}"`, 'success');
      navigate(links.programs);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <Link to={links.programs} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 transition hover:text-gray-700">
            <ArrowLeft size={15} /> Danh sách giáo án
          </Link>
        }
        eyebrow="Giáo án · khuôn mẫu không ngày, không gắn ngựa"
        title={data.name}
        description={data.description}
        actions={
          <>
            {data.canManage && (
              <>
                <Tip content={data.deletable ? undefined : `Không xóa được: ${data.blockReason}`}>
                  <span>
                    <Button variant="ghost" disabled={!data.deletable} onClick={() => setConfirmDelete(true)}>
                      <Trash2 size={15} /> Xóa
                    </Button>
                  </span>
                </Tip>
                <Button variant="secondary" onClick={() => navigate(`${links.program(data.id)}/edit`)}>
                  <Pencil size={15} /> Sửa giáo án
                </Button>
              </>
            )}
            {data.canOpenClass && (
              <Button onClick={() => navigate(`${links.classNew}?programId=${data.id}`)}>
                <CalendarPlus size={16} /> Mở lớp từ giáo án này
              </Button>
            )}
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <Card>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <Figure label="Thời lượng" value={`${summary.totalWeeks} tuần`} />
                <Figure label="Giai đoạn" value={String(data.phaseCount)} />
                <Figure label="Tổng buổi" value={String(summary.totalSessions)} />
                <Figure label="Khối lượng đỉnh" value={`${volumeLabel(summary.peakWeeklyVolumeM)}/tuần`} />
              </div>
              {summary.maxIntensity && (
                <span className="flex items-center gap-2 text-sm text-gray-500">
                  Cường độ cao nhất <IntensityPill intensity={summary.maxIntensity} />
                </span>
              )}
            </div>
            <PhaseTimeline phases={summary.phases} size="lg" showRuler />
          </Card>

          {data.phaseDetails.map((phase, index) => (
            <PhaseTable key={index} phase={phase} index={index} />
          ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4">
          {data.warnings.length > 0 && (
            <div className="space-y-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 shadow-amber ring-1 ring-amber-100">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={15} /> Lưu ý khi dùng giáo án
              </p>
              <ul className="space-y-1.5">
                {data.warnings.map((warning) => (
                  <li key={warning} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Card variant="flat">
            <SectionTitle action={<span className="text-xs text-gray-400 tabular-nums">{data.classes.length} lớp</span>}>
              Các lớp đang dùng giáo án này
            </SectionTitle>
            {data.classes.length === 0 ? (
              <EmptyState title="Chưa có lớp nào" hint="Mở lớp để sinh buổi học theo ngày thật và đăng ký ngựa." className="py-8" />
            ) : (
              <ul className="space-y-2">
                {data.classes.map((cls) => (
                  <li key={cls.id}>
                    <Link
                      to={links.class(cls.id)}
                      className="block rounded-xl bg-white p-3 ring-1 ring-emerald-950/[0.05] transition hover:ring-emerald-300"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-gray-900">{cls.name}</span>
                        <ClassPill status={cls.status} />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {cls.zoneName} · {formatDate(cls.startDate)} → {formatDate(cls.endDate)}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Meter value={cls.enrolled} max={cls.capacity} className="flex-1" />
                        <span className="text-xs text-gray-500 tabular-nums">
                          {cls.enrolled}/{cls.capacity}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {data.openClassCount > 0 && (
              <p className="mt-3 text-xs font-light text-gray-500">
                Sửa giáo án không làm đổi buổi đã sinh của {data.openClassCount} lớp đang chạy hoặc sắp tới.
              </p>
            )}
          </Card>

          <p className="px-1 text-xs font-light text-gray-400">
            Soạn bởi {data.createdByName} · cập nhật {formatDate(data.updatedAt)}
          </p>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Xóa giáo án"
        message={
          <>
            Xóa giáo án <span className="font-semibold text-gray-900">{data.name}</span>? Chưa có lớp nào mở từ giáo án này nên xóa
            an toàn. Xóa là xóa mềm, vẫn giữ trong nhật ký.
          </>
        }
        confirmLabel="Xóa giáo án"
        pending={remove.pending}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(false)}
      >
        {remove.error && <ErrorBox message={remove.error} />}
      </ConfirmDialog>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-light text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}

function PhaseTable({ phase, index }: { phase: ProgramPhaseDetail; index: number }) {
  return (
    <Card className="overflow-hidden p-0 sm:p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
        <span className={cn('h-8 w-1.5 rounded-full', phaseTone(index).split(' ')[0])} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-light text-gray-400">Giai đoạn {phase.no}</p>
          <p className="font-semibold text-gray-900">{phase.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <Pill tone="slate">{phase.weeks} tuần</Pill>
          <Pill tone="green">{phase.sessionsPerWeek} buổi/tuần</Pill>
          <Pill tone="slate">{volumeLabel(phase.weeklyVolumeM)}/tuần</Pill>
          {phase.restDays === 0 && <Pill tone="amber">Không có ngày nghỉ</Pill>}
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="bg-emerald-50/30 text-xs text-gray-500">
              <th className="px-5 py-2.5 font-semibold sm:px-6">Môn học</th>
              <th className="px-3 py-2.5 font-semibold">Loại</th>
              <th className="px-3 py-2.5 font-semibold">Cự ly × lặp</th>
              <th className="px-3 py-2.5 font-semibold">Cường độ</th>
              <th className="px-3 py-2.5 font-semibold">Mặt sân</th>
              <th className="px-5 py-2.5 text-right font-semibold sm:px-6">Buổi/tuần</th>
            </tr>
          </thead>
          <tbody>
            {phase.items.map((item) => (
              <tr key={item.id} className="border-t border-gray-50">
                <td className="px-5 py-3 sm:px-6">
                  <span className="font-medium text-gray-900">{item.name}</span>
                  {item.deleted && (
                    <Pill tone="red" className="ml-2">
                      Môn đã xóa
                    </Pill>
                  )}
                </td>
                <td className="px-3 py-3 text-gray-600">{workoutLabel[item.workoutType]}</td>
                <td className="px-3 py-3 text-gray-700 tabular-nums">{workoutLine(item.distanceM, item.repetitions)}</td>
                <td className="px-3 py-3">
                  <IntensityPill intensity={item.intensity} />
                </td>
                <td className="px-3 py-3 text-gray-600">{surfaceLabel[item.surface]}</td>
                <td className="px-5 py-3 text-right font-semibold text-gray-900 tabular-nums sm:px-6">× {item.sessionsPerWeek}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
