// Tab Y tế trong hồ sơ ngựa (F3.10). CM, HT, VET, OWNER xem; GROOM không.
// HT không thấy chi phí; OWNER chỉ thấy chi phí của bệnh án đã đóng.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  ClipboardList,
  FolderCheck,
  FolderOpen,
  HeartPulse,
  History,
  Lock,
  Send,
  Stethoscope,
  Unlock,
  Wallet,
} from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { getHorseMedical, type ExamCard, type LockRow } from '../../../services/medical.service';
import { ERR_FORBIDDEN } from '../../../services/db';
import { Button, Card, Dot, EmptyState, ErrorBox, Notice, SectionTitle, Sheet, Skeleton, cn } from '../../../components/ui';
import { CasePill, RequestPill, UrgencyPill, healthDot } from '../../../components/ui/status';
import { healthHint, healthLabel } from '../../../lib/labels';
import { formatDate, formatDateTime, formatMoney } from '../../../lib/format';
import { links } from '../../../lib/links';
import ExaminationSheet from '../../medical/components/ExaminationSheet';
import { ExamTimeline } from '../../medical/components/ExamTimeline';
import {
  CorrectionModal,
  HealthChangeModal,
  LiftLockModal,
  PlaceLockModal,
  RequestForm,
} from '../../medical/components/modals';
import { HealthShift, PeriodicPill, RequestLines } from '../../medical/components/parts';
import { healthText } from '../../medical/components/utils';

type Dialog =
  | { kind: 'exam' }
  | { kind: 'health' }
  | { kind: 'lock' }
  | { kind: 'lift'; lock: LockRow }
  | { kind: 'request' }
  | { kind: 'correct'; exam: ExamCard }
  | null;

export default function MedicalTab({ horseId }: { horseId: string }) {
  const medical = useService(() => getHorseMedical(horseId), [horseId]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [allExams, setAllExams] = useState(false);

  if (medical.loading && !medical.data) return <Skeleton rows={5} />;
  if (medical.error === ERR_FORBIDDEN) {
    return <Notice tone="info">Nội dung y tế (bệnh án, buổi khám, chẩn đoán) không hiển thị với vai trò của bạn.</Notice>;
  }
  if (medical.error) return <ErrorBox message={medical.error} />;
  const data = medical.data!;
  const done = () => {
    setDialog(null);
    medical.reload();
  };
  const exams = allExams ? data.exams : data.exams.slice(0, 4);
  const hasVetActions = data.canExamine || data.canChangeHealth || data.canLock;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* ===== Cột chính ===== */}
      <div className="space-y-5 lg:col-span-8">
        {/* Sức khỏe + nhật ký */}
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500">Sức khỏe hiện tại</p>
              <p className={cn('mt-1 flex items-center gap-2 text-lg font-semibold', healthText[data.horse.healthStatus])}>
                <Dot tone={healthDot[data.horse.healthStatus]} hollow={data.horse.healthStatus === 'QUARANTINED'} className="h-2.5 w-2.5" />
                {healthLabel[data.horse.healthStatus]}
              </p>
              <p className="mt-1 text-sm text-gray-500">{healthHint[data.horse.healthStatus]}</p>
            </div>
            {data.canChangeHealth && (
              <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'health' })}>
                <HeartPulse size={14} /> Đổi trạng thái
              </Button>
            )}
          </div>
          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs text-gray-500">
              <History size={13} className="text-gray-400" /> Nhật ký đổi trạng thái sức khỏe
            </p>
            {data.healthLogs.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa có lần đổi trạng thái nào.</p>
            ) : (
              <ol className="space-y-3">
                {data.healthLogs.map((log) => (
                  <li key={log.id} className="flex flex-wrap items-start gap-x-4 gap-y-1.5">
                    <span className="w-32 shrink-0 text-xs tabular-nums text-gray-500">{formatDateTime(log.changedAt)}</span>
                    <div className="min-w-0 flex-1">
                      <HealthShift from={log.fromStatus} to={log.toStatus} />
                      <p className="mt-1 text-sm text-gray-700">{log.reason}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {log.changedByName} ·{' '}
                        {log.direct ? (
                          'đổi trực tiếp, không qua buổi khám'
                        ) : log.caseId ? (
                          <Link to={links.case(log.caseId)} className="text-emerald-700 hover:underline">
                            trong buổi khám của bệnh án "{log.caseTitle}"
                          </Link>
                        ) : (
                          'trong buổi khám định kỳ'
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>

        {/* Bệnh án */}
        <Card>
          <SectionTitle icon={<FolderOpen size={16} />}>Bệnh án ({data.cases.length})</SectionTitle>
          {data.cases.length === 0 ? (
            <p className="text-sm text-gray-500">Ngựa chưa có bệnh án nào.</p>
          ) : (
            <ul className="-mx-2 -my-1 space-y-0.5">
              {data.cases.map((item) => (
                <li key={item.id}>
                  <Link to={links.case(item.id)} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-xl p-2 transition hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold text-gray-900">
                        {item.title}
                        {item.activeLock && <Lock size={13} className="shrink-0 text-red-600" aria-label="Khóa còn hiệu lực" />}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Mở {formatDate(item.openedAt)} · {item.openedByName}
                        {item.closedAt && ` · đóng ${formatDate(item.closedAt)}`} · {item.examCount} buổi khám
                        {item.nextAppointment && item.status === 'OPEN' && ` · hẹn khám tiếp ${formatDate(item.nextAppointment)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.costVisible && item.cost !== undefined && (
                        <span className="text-sm font-semibold tabular-nums text-gray-900">{formatMoney(item.cost)}</span>
                      )}
                      <CasePill status={item.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Buổi khám */}
        <div>
          <SectionTitle
            icon={<Stethoscope size={16} />}
            action={
              data.exams.length > 4 && (
                <Button size="sm" variant="ghost" onClick={() => setAllExams(!allExams)}>
                  {allExams ? 'Thu gọn' : `Xem cả ${data.exams.length} buổi`}
                </Button>
              )
            }
          >
            Buổi khám ({data.exams.length})
          </SectionTitle>
          {data.exams.length === 0 ? (
            <EmptyState title="Chưa có buổi khám nào" hint="Buổi khám định kỳ và buổi khám trong bệnh án đều hiện ở đây." />
          ) : (
            <ExamTimeline
              exams={exams}
              showCase
              compact={!allExams}
              onCorrect={data.canExamine ? (exam) => setDialog({ kind: 'correct', exam }) : undefined}
            />
          )}
        </div>
      </div>

      {/* ===== Cột phụ ===== */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
        {hasVetActions && (
          <Card>
            <SectionTitle icon={<Stethoscope size={16} />}>Thao tác bác sĩ</SectionTitle>
            <div className="grid gap-2">
              {data.canExamine && (
                <Button onClick={() => setDialog({ kind: 'exam' })} className="justify-start">
                  <Stethoscope size={15} /> Ghi buổi khám
                  {data.pendingRequestCount > 0 && (
                    <span className="ml-auto rounded-md bg-white/15 px-1.5 text-xs font-medium">{data.pendingRequestCount} yêu cầu chờ</span>
                  )}
                </Button>
              )}
              {data.canChangeHealth && (
                <Button variant="secondary" onClick={() => setDialog({ kind: 'health' })} className="justify-start">
                  <HeartPulse size={15} /> Đổi sức khỏe trực tiếp
                </Button>
              )}
              {data.canLock && !data.activeLock && (
                <Button variant="secondary" onClick={() => setDialog({ kind: 'lock' })} className="justify-start">
                  <Lock size={15} /> Đặt khóa huấn luyện
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Khóa */}
        <Card tone={data.activeLock ? 'danger' : 'default'} className={data.activeLock ? '!shadow-[inset_3px_0_0_0_#ef4444]' : ''}>
          <SectionTitle icon={<Lock size={16} />}>Khóa huấn luyện</SectionTitle>
          {data.activeLock ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-700">Đang khóa huấn luyện</p>
              <p className="text-sm text-gray-800">{data.activeLock.reason}</p>
              <p className="text-xs text-gray-500">
                Từ {formatDate(data.activeLock.placedAt)} · {data.activeLock.placedByName}
                {data.activeLock.expectedLiftDate
                  ? ` · dự kiến gỡ ${formatDate(data.activeLock.expectedLiftDate)}`
                  : ' · chưa đặt ngày dự kiến gỡ'}
              </p>
              {data.activeLock.pastExpected && (
                <p className="text-xs font-medium text-amber-800">Đã qua ngày dự kiến — chờ bác sĩ xác nhận</p>
              )}
              {data.activeLock.caseId && (
                <Link to={links.case(data.activeLock.caseId)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                  <FolderOpen size={12} /> {data.activeLock.caseTitle}
                </Link>
              )}
              {data.activeLock.canLift && (
                <div className="pt-1">
                  <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'lift', lock: data.activeLock! })}>
                    <Unlock size={14} /> Gỡ khóa
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Không có khóa hiệu lực.</p>
          )}
          {data.lockHistory.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500">Lịch sử khóa</p>
              {data.lockHistory.map((lock) => (
                <div key={lock.id} className="text-xs text-gray-500">
                  <p className="text-gray-700">{lock.reason}</p>
                  <p>
                    {formatDate(lock.placedAt)} → {formatDate(lock.liftedAt)} · {lock.liftKindLabel}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Khám định kỳ */}
        {data.periodic && (
          <Card>
            <SectionTitle icon={<CalendarClock size={16} />}>Khám định kỳ</SectionTitle>
            <p className="text-xs text-gray-500">Hạn kế tiếp</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900">{formatDate(data.periodic.dueDate)}</p>
            <div className="mt-1">
              <PeriodicPill
                state={data.periodic.state}
                label={data.periodic.stateLabel}
                overdueDays={data.periodic.overdueDays}
                alerted={data.periodic.alerted}
              />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {data.periodic.neverExamined
                ? `Chưa từng khám — tính từ ngày tạo hồ sơ ${formatDate(data.periodic.baseDate)}.`
                : `Khám gần nhất ${formatDate(data.periodic.lastExamAt)} (${data.periodic.lastExamKind === 'PERIODIC' ? 'định kỳ' : 'trong bệnh án'}).`}
            </p>
          </Card>
        )}

        {/* Chi phí */}
        {data.costVisible && (
          <Card>
            <SectionTitle icon={<Wallet size={16} />}>Tổng chi phí y tế</SectionTitle>
            <p className="text-lg font-semibold tabular-nums text-gray-900">{formatMoney(data.totalCost ?? 0)}</p>
            <p className="mt-1 text-xs text-gray-500">
              Tổng chi phí {data.closedCaseCount} bệnh án đã đóng. Bệnh án đang mở chưa có chi phí; khám định kỳ không tính phí.
            </p>
          </Card>
        )}

        {/* Yêu cầu khám */}
        {data.requestsVisible && (
        <Card>
          <SectionTitle
            icon={<ClipboardList size={16} />}
            action={
              data.canRequest &&
              !data.canExamine && (
                <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'request' })}>
                  <Send size={13} /> Gửi yêu cầu
                </Button>
              )
            }
          >
            Yêu cầu khám
          </SectionTitle>
          {data.requests.length === 0 ? (
            <p className="text-sm text-gray-500">Chưa có yêu cầu khám nào.</p>
          ) : (
            <ul className="-my-3 divide-y divide-gray-100">
              {data.requests.slice(0, 5).map((request) => (
                <li key={request.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {request.urgency === 'URGENT' && <UrgencyPill urgency={request.urgency} />}
                    <RequestPill status={request.status} />
                    <span className="text-xs text-gray-500">{request.sourceLabel}</span>
                  </div>
                  <div className="mt-1">
                    <RequestLines lines={request.descriptionLines} compact />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {request.createdByName} · {formatDateTime(request.createdAt)}
                    {request.status === 'DISMISSED' && request.dismissReason && ` · bỏ qua: ${request.dismissReason}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        )}

        {data.cases.some((item) => item.status === 'CLOSED') && !data.costVisible && (
          <p className="flex items-center gap-1.5 px-1 text-xs text-gray-500">
            <FolderCheck size={13} className="text-gray-400" /> Chi phí y tế không hiển thị với vai trò của bạn.
          </p>
        )}
      </aside>

      {dialog?.kind === 'exam' && <ExaminationSheet horseId={horseId} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'health' && <HealthChangeModal horseId={horseId} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'lock' && <PlaceLockModal horseId={horseId} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'lift' && (
        <LiftLockModal
          lock={{ id: dialog.lock.id, horseName: data.horse.name, reason: dialog.lock.reason, placedAt: dialog.lock.placedAt }}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.kind === 'correct' && (
        <CorrectionModal
          examinationId={dialog.exam.id}
          examLabel={`Buổi khám ${formatDateTime(dialog.exam.examinedAt)} · BS. ${dialog.exam.vetName}`}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.kind === 'request' && (
        <Sheet open onClose={() => setDialog(null)} title={`Gửi yêu cầu khám — ${data.horse.name}`}>
          <RequestForm horseId={horseId} onCancel={() => setDialog(null)} onDone={done} />
        </Sheet>
      )}
    </div>
  );
}

