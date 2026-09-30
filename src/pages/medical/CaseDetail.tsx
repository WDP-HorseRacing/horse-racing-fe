// Chi tiết bệnh án: dòng thời gian buổi khám (F3.6), khóa liên quan (F3.8), đóng bệnh án (F3.9).
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FolderCheck, HeartPulse, Lock, Plus, Unlock, Wallet } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getCase, type ExamCard, type LockRow } from '../../services/medical.service';
import { ERR_NOT_FOUND } from '../../services/db';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  NotFound,
  Notice,
  SectionTitle,
  Skeleton,
  cn,
} from '../../components/ui';
import { CasePill, HealthPill, UrgencyPill } from '../../components/ui/status';
import { healthHint } from '../../lib/labels';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import { links } from '../../lib/links';
import ExaminationSheet from './components/ExaminationSheet';
import { ExamTimeline } from './components/ExamTimeline';
import { CloseCaseModal, CorrectionModal, LiftLockModal, PlaceLockModal } from './components/modals';
import { RequestLines } from './components/parts';

function LockBlock({ lock, onLift }: { lock: LockRow; onLift?: () => void }) {
  return (
    <div className={cn(!lock.active && 'border-t border-gray-100 pt-3')}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn('flex items-center gap-1.5 text-sm font-semibold', lock.active ? 'text-red-700' : 'text-gray-600')}>
          {lock.active ? <Lock size={14} /> : <Unlock size={14} />}
          {lock.active ? 'Đang khóa huấn luyện' : 'Đã gỡ khóa'}
        </p>
        {onLift && (
          <Button size="sm" variant="secondary" onClick={onLift}>
            Gỡ khóa
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-sm text-gray-700">{lock.reason}</p>
      <p className="mt-1 text-xs text-gray-500">
        Đặt {formatDate(lock.placedAt)} · {lock.placedByName}
        {lock.active && (lock.expectedLiftDate ? ` · dự kiến gỡ ${formatDate(lock.expectedLiftDate)}` : ' · chưa đặt ngày dự kiến gỡ')}
      </p>
      {lock.pastExpected && <p className="mt-1.5 text-xs font-medium text-amber-800">Đã qua ngày dự kiến — chờ bác sĩ xác nhận</p>}
      {!lock.active && (
        <p className="mt-1 text-xs text-gray-500">
          Gỡ {formatDate(lock.liftedAt)} · {lock.liftedByName} · {lock.liftKindLabel}
          {lock.liftReason && <span className="block text-gray-600">{lock.liftReason}</span>}
        </p>
      )}
    </div>
  );
}

export default function CaseDetail() {
  const { id = '' } = useParams();
  const detail = useService(() => getCase(id), [id]);
  const [addingExam, setAddingExam] = useState(false);
  const [closing, setClosing] = useState(false);
  const [placingLock, setPlacingLock] = useState(false);
  const [lifting, setLifting] = useState<LockRow | null>(null);
  const [correcting, setCorrecting] = useState<ExamCard | null>(null);

  if (detail.loading && !detail.data) return <Skeleton rows={6} />;
  if (detail.error === ERR_NOT_FOUND) return <NotFound />;
  if (detail.error) return <ErrorBox message={detail.error} />;
  const data = detail.data!;
  const item = data.medicalCase;
  const isOpen = item.status === 'OPEN';
  const lock = data.horseActiveLock;
  const pastLocks = data.locks.filter((entry) => !entry.active);

  return (
    <div className="space-y-6">
      <Link to={links.cases} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-emerald-700">
        <ArrowLeft size={15} /> Bệnh án
      </Link>

      {/* Dải header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-4">
            <Link to={links.horse(data.horse.id, 'medical')} className="shrink-0 transition hover:opacity-80">
              <Avatar src={data.horse.avatar} name={data.horse.name} size={64} />
            </Link>
            <div className="min-w-0">
              <Link to={links.horse(data.horse.id, 'medical')} className="text-sm font-medium text-emerald-700 hover:underline">
                {data.horse.name}
                {data.horse.zoneName && <span className="font-normal text-gray-500"> · {[data.horse.zoneName, data.horse.stallCode].filter(Boolean).join(' · ')}</span>}
              </Link>
              <h2 className="mt-0.5 text-[1.65rem] font-bold leading-tight tracking-tight text-gray-900">{item.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <CasePill status={item.status} />
                {item.fromPeriodic && <span>Mở từ buổi khám định kỳ ·</span>}
                <span>
                  Mở {formatDate(item.openedAt)} bởi {item.openedByName}
                </span>
                {item.closedAt && (
                  <span>
                    · Đóng {formatDate(item.closedAt)} bởi {item.closedByName}
                  </span>
                )}
                <span>· {item.examCount} buổi khám</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            {item.costVisible && (
              <div className="text-right">
                <p className="flex items-center justify-end gap-1.5 text-xs text-gray-500">
                  <Wallet size={13} className="text-gray-400" /> Chi phí điều trị
                </p>
                {item.cost !== undefined ? (
                  <p className="text-2xl font-bold tabular-nums text-gray-900">{formatMoney(item.cost)}</p>
                ) : (
                  <p className="text-sm text-gray-500">Chốt một lần khi đóng bệnh án</p>
                )}
              </div>
            )}
            {(data.canAddExam || data.canClose) && (
              <div className="flex flex-wrap justify-end gap-2">
                {data.canAddExam && (
                  <Button onClick={() => setAddingExam(true)}>
                    <Plus size={16} /> Thêm buổi khám
                  </Button>
                )}
                {data.canClose && (
                  <Button variant="secondary" onClick={() => setClosing(true)}>
                    <FolderCheck size={16} /> Đóng bệnh án
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Dòng thời gian buổi khám */}
        <div className="space-y-4 lg:col-span-8">
          <SectionTitle icon={<ClipboardList size={16} />} className="mb-0">
            Dòng thời gian khám
          </SectionTitle>
          {data.exams.length === 0 ? (
            <EmptyState title="Chưa có buổi khám" />
          ) : (
            <ExamTimeline exams={data.exams} onCorrect={data.canCorrect ? setCorrecting : undefined} />
          )}
          {!isOpen && (
            <div className="ml-6 rounded-2xl bg-white p-5 ring-1 ring-gray-200/80">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FolderCheck size={16} className="text-emerald-600" /> Đóng bệnh án · {formatDateTime(item.closedAt)} · {item.closedByName}
              </p>
              {item.closeNote && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{item.closeNote}</p>}
              {item.costVisible && item.cost !== undefined && (
                <p className="mt-2 text-sm text-gray-600">
                  Chi phí chốt: <span className="font-semibold text-gray-900">{formatMoney(item.cost)}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Cột phụ dính */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
          {!isOpen && (
            <Notice tone="info" icon={<FolderCheck size={16} className="text-gray-400" />}>
              Bệnh án đã đóng, chỉ đọc. Không mở lại — tái phát thì mở bệnh án mới.
            </Notice>
          )}

          <Card>
            <SectionTitle icon={<HeartPulse size={16} />}>Sức khỏe hiện tại</SectionTitle>
            <HealthPill status={data.horse.healthStatus} />
            <p className="mt-2 text-sm text-gray-500">{healthHint[data.horse.healthStatus]}</p>
          </Card>

          {/* className: shadow-card trong Card đè dải tone (twMerge không nhận ra shadow-card) — ép dải đỏ bằng ! */}
          <Card tone={lock ? 'danger' : 'default'} className={lock ? '!shadow-[inset_3px_0_0_0_#ef4444]' : ''}>
            <SectionTitle
              icon={<Lock size={16} />}
              action={
                !lock &&
                data.canLock && (
                  <Button size="sm" variant="secondary" onClick={() => setPlacingLock(true)}>
                    Đặt khóa
                  </Button>
                )
              }
            >
              Khóa huấn luyện
            </SectionTitle>
            <div className="space-y-2.5">
              {lock ? (
                <>
                  <LockBlock lock={lock} onLift={lock.canLift ? () => setLifting(lock) : undefined} />
                  {lock.caseId !== item.id && (
                    <p className="text-xs text-gray-500">Khóa này không gắn với bệnh án đang xem{lock.caseTitle ? ` (gắn với "${lock.caseTitle}")` : ''}.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">Ngựa không có khóa huấn luyện hiệu lực.</p>
              )}
              {pastLocks.map((entry) => (
                <LockBlock key={entry.id} lock={entry} />
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Khóa độc lập với trạng thái sức khỏe và không tự gỡ khi tới ngày dự kiến.
            </p>
          </Card>

          <Card>
            <SectionTitle icon={<ClipboardList size={16} />}>Yêu cầu khám đã gắn ({data.linkedRequests.length})</SectionTitle>
            {data.linkedRequests.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa có yêu cầu nào.</p>
            ) : (
              <ul className="-my-3 divide-y divide-gray-100">
                {data.linkedRequests.map((request) => (
                  <li key={request.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {request.urgency === 'URGENT' && <UrgencyPill urgency={request.urgency} />}
                      {request.sourceLabel} · {request.createdByName}
                    </div>
                    <div className="mt-1.5">
                      <RequestLines lines={request.descriptionLines} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{formatDateTime(request.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      {addingExam && (
        <ExaminationSheet
          horseId={data.horse.id}
          kind="CASE"
          caseId={item.id}
          onClose={() => setAddingExam(false)}
          onDone={() => {
            setAddingExam(false);
            detail.reload();
          }}
        />
      )}
      {closing && (
        <CloseCaseModal
          caseId={item.id}
          title={item.title}
          horseName={data.horse.name}
          lock={lock ? { reason: lock.reason, expectedLiftDate: lock.expectedLiftDate, linkedToCase: lock.caseId === item.id } : undefined}
          onClose={() => setClosing(false)}
          onDone={() => {
            setClosing(false);
            detail.reload();
          }}
        />
      )}
      {placingLock && (
        <PlaceLockModal
          horseId={data.horse.id}
          caseId={item.id}
          onClose={() => setPlacingLock(false)}
          onDone={() => {
            setPlacingLock(false);
            detail.reload();
          }}
        />
      )}
      {lifting && (
        <LiftLockModal
          lock={{ id: lifting.id, horseName: data.horse.name, reason: lifting.reason, placedAt: lifting.placedAt }}
          onClose={() => setLifting(null)}
          onDone={() => {
            setLifting(null);
            detail.reload();
          }}
        />
      )}
      {correcting && (
        <CorrectionModal
          examinationId={correcting.id}
          examLabel={`Buổi khám ${formatDateTime(correcting.examinedAt)} · BS. ${correcting.vetName}`}
          onClose={() => setCorrecting(null)}
          onDone={() => {
            setCorrecting(null);
            detail.reload();
          }}
        />
      )}
    </div>
  );
}
