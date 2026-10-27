// Chi tiết bệnh án (F3.10): dòng thời gian buổi khám (F3.6), diễn biến chấn thương, khóa huấn luyện
// của bệnh án (F3.8), đóng bệnh án và điều chỉnh chi phí (F3.9).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bandage, ClipboardList, FolderCheck, HeartPulse, Lock, Plus, Unlock, Wallet } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { useFormErrors } from '../../hooks/useFormErrors';
import { getHorse } from '../../api/horses';
import { getCase, getInjuries, listHorseExamRequests, listHorseLocks, updateCaseConclusion } from '../../api/medical';
import type { MedicalRecord, TrainingLock } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { Avatar, Button, CancelButton, Card, CharCount, EmptyState, ErrorBox, Field, Modal, NotFound, Notice, SectionTitle, Skeleton, Textarea, cn, invalidClass, useToast } from '../../components/ui';
import { CaseStatusPill, HealthPill } from '../../components/ui/status';
import { healthHint } from '../../lib/labels';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import { links } from '../../lib/links';
import { InjuryProgress, VisitTimeline } from './components/ExamTimeline';
import { AdjustCostModal, PlaceLockModal, ReleaseLockModal, RequestRow, VoidVisitModal } from './components/modals';
import { usePeople, type People } from './components/people';
import { useCrumbs } from '../../components/Breadcrumb';
import { leftClub, leftClubText } from '../../lib/horse-rules';
import { BackLink } from '../../components/BackLink';

type Dialog =
  | { kind: 'cost'; record: MedicalRecord }
  | { kind: 'lock' }
  | { kind: 'release'; lock: TrainingLock }
  | { kind: 'void'; record: MedicalRecord; requestIds: string[] }
  | null;

function LockBlock({ lock, people, onRelease }: { lock: TrainingLock; people: People; onRelease?: () => void }) {
  const active = lock.status === 'ACTIVE';
  return (
    <div className={cn(!active && 'border-t border-gray-100 pt-3')}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn('flex items-center gap-1.5 text-sm font-semibold', active ? 'text-red-700' : 'text-gray-600')}>
          {active ? <Lock size={14} /> : <Unlock size={14} />}
          {active ? 'Đang khóa huấn luyện' : 'Đã gỡ khóa'}
        </p>
        {onRelease && active && (
          <Button size="sm" variant="secondary" onClick={onRelease}>
            Gỡ khóa
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-sm text-gray-700">{lock.reason}</p>
      <p className="mt-1 text-xs text-gray-500">
        Đặt {formatDate(lock.lockStart)} · {people.name(lock.lockedBy, 'vet')}
        {active && (lock.lockEnd ? ` · dự kiến gỡ ${formatDate(lock.lockEnd)}` : ' · chưa đặt ngày dự kiến gỡ')}
      </p>
      {!active && (
        <p className="mt-1 text-xs text-gray-500">
          Gỡ {formatDate(lock.releasedAt)} · {lock.releasedBySystem ? 'Hệ thống' : people.name(lock.releasedBy, 'vet')}
          {lock.releaseConclusion && <span className="block text-gray-600">{lock.releaseConclusion}</span>}
        </p>
      )}
    </div>
  );
}

export default function CaseDetail() {
  const { id = '' } = useParams();
  const user = useStore((state) => state.currentUser);
  const isVet = can(user, 'case.close');
  const isOwner = user?.role === 'HORSE_OWNER';
  const detail = useService(() => getCase(id), [id]);
  const horseId = detail.data?.horseId;
  const extra = useService(async () => {
    if (!horseId) return null;
    const [horse, injuries, locks, requests] = await Promise.all([
      getHorse(horseId),
      getInjuries(horseId),
      listHorseLocks(horseId),
      isOwner ? Promise.resolve([]) : listHorseExamRequests(horseId).catch(() => []),
    ]);
    return { horse, injuries, locks, requests };
  }, [horseId, isOwner]);
  const people = usePeople(extra.data?.horse.groom ? [extra.data.horse.groom] : []);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editingConclusion, setEditingConclusion] = useState(false);
  const navigate = useNavigate();
  const caseTitle = detail.data && extra.data ? `${extra.data.horse.name} · ${detail.data.initialDiagnosis}` : null;
  useCrumbs(caseTitle ? [{ label: caseTitle }] : null);

  if (detail.loading && !detail.data) return <Skeleton rows={6} />;
  if (detail.error && !detail.data) {
    return detail.error.startsWith('Không tìm thấy') ? <NotFound message={detail.error} /> : <ErrorBox message={detail.error} />;
  }
  const item = detail.data!;
  const horse = extra.data?.horse;
  const isOpen = item.status === 'OPEN';
  const costVisible = 'totalCost' in item;
  const visits = item.visits;
  const visitIds = new Set(visits.map((visit) => visit.id));
  const caseInjuries = (extra.data?.injuries ?? []).filter((injury) => injury.history.some((step) => step.caseId === item.id));
  const caseLocks = (extra.data?.locks ?? []).filter((lock) => lock.caseId === item.id);
  const horseActiveLock = (extra.data?.locks ?? []).find((lock) => lock.status === 'ACTIVE');
  const linkedRequests = (extra.data?.requests ?? []).filter((request) => request.medicalRecordId && visitIds.has(request.medicalRecordId));
  const horseName = horse?.name ?? 'Ngựa';
  const transferred = !!horse && leftClub(horse.lifecycleStatus);
  // Lấy trước khi hủy: BE bỏ liên kết yêu cầu với buổi khám sau khi hủy.
  const requestIdsOf = (recordId: string) => linkedRequests.filter((request) => request.medicalRecordId === recordId).map((request) => request.id);

  const reload = () => {
    detail.reload();
    extra.reload();
  };
  const done = () => {
    setDialog(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <BackLink fallback={links.cases} />

      {/* Dải header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-4">
            <Link to={links.horseMedical(item.horseId)} className="shrink-0 transition hover:opacity-80">
              <Avatar name={horseName} size={64} />
            </Link>
            <div className="min-w-0">
              <Link to={links.horseMedical(item.horseId)} className="text-sm font-medium text-emerald-700 hover:underline">
                {horseName}
                {horse?.location.barn && (
                  <span className="font-normal text-gray-500"> · {[horse.location.barn.name, horse.location.stall?.code].filter(Boolean).join(' · ')}</span>
                )}
              </Link>
              <h2 className="mt-0.5 text-[1.65rem] font-bold leading-tight tracking-tight text-gray-900">{item.initialDiagnosis}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <CaseStatusPill status={item.status} />
                <span>
                  Mở {formatDateTime(item.openedAt)} · {people.name(item.openedBy, 'vet')}
                </span>
                {item.closedAt && <span>· Đóng {formatDateTime(item.closedAt)}</span>}
                <span>· {visits.filter((visit) => !visit.voidedAt).length} buổi khám</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            {costVisible && (
              <div className="text-right">
                <p className="flex items-center justify-end gap-1.5 text-xs text-gray-500">
                  <Wallet size={13} className="text-gray-400" /> Chi phí điều trị
                </p>
                {item.status === 'CANCELLED' ? (
                  <p className="text-sm text-gray-500">Bệnh án đã hủy, không có chi phí</p>
                ) : (
                  <>
                    <p className="text-2xl font-bold tabular-nums text-gray-900">{formatMoney(item.totalCost ?? 0)}</p>
                    <p className="text-xs text-gray-500">
                      {isOwner ? 'Cộng các buổi khám trong thời gian bạn sở hữu' : isOpen ? 'Cộng các buổi khám tới nay' : 'Cộng các buổi khám'}
                    </p>
                  </>
                )}
              </div>
            )}
            {isVet && !transferred && (
              <div className="flex flex-wrap justify-end gap-2">
                {isOpen && (
                  <>
                    <Button onClick={() => navigate(links.visitNew({ horseId: item.horseId, caseId: item.id, back: links.case(item.id) }))}>
                      <Plus size={16} /> Tái khám
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(links.caseClose(item.id))}>
                      <FolderCheck size={16} /> Đóng bệnh án
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {transferred && horse && <Notice tone="info">{leftClubText(horse.lifecycleStatus)}</Notice>}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Dòng thời gian buổi khám */}
        <div className="space-y-4 lg:col-span-8">
          {item.status === 'CLOSED' && (
            <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200/80">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <FolderCheck size={16} className="text-emerald-600" /> Kết luận cuối · {formatDateTime(item.closedAt)}
                </p>
                {isVet && !transferred && (
                  <Button size="sm" variant="secondary" onClick={() => setEditingConclusion(true)}>
                    Đính chính kết luận
                  </Button>
                )}
              </div>
              {item.finalConclusion && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{item.finalConclusion}</p>}
            </div>
          )}
          <SectionTitle icon={<ClipboardList size={16} />} className="mb-0">
            Dòng thời gian khám
          </SectionTitle>
          {visits.length === 0 ? (
            <EmptyState title="Chưa có buổi khám" />
          ) : (
            <VisitTimeline
              records={visits}
              people={people}
              ownRecord={(record) => record.vetId === user?.id}
              onVoid={isVet && !transferred ? (record) => setDialog({ kind: 'void', record, requestIds: requestIdsOf(record.id) }) : undefined}
              onEdit={isVet && !transferred ? (record) => navigate(links.visitNew({ edit: record.id, back: links.case(item.id) })) : undefined}
              onAdjustCost={isVet && costVisible ? (record) => setDialog({ kind: 'cost', record }) : undefined}
            />
          )}
        </div>

        {/* Cột phụ */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
          {item.status !== 'OPEN' && (
            <Notice tone="info" icon={<FolderCheck size={16} className="text-gray-400" />}>
              {item.status === 'CLOSED'
                ? 'Bệnh án đã đóng, không thêm buổi khám, không mở lại. Tái phát thì mở bệnh án mới.'
                : 'Bệnh án đã hủy do buổi mở bệnh án bị hủy.'}
            </Notice>
          )}

          {horse && (
            <Card variant="flat">
              <SectionTitle icon={<HeartPulse size={16} />}>Sức khỏe hiện tại</SectionTitle>
              <HealthPill status={horse.healthStatus} />
              <p className="mt-2 text-sm text-gray-500">{healthHint[horse.healthStatus]}</p>
            </Card>
          )}

          <Card>
            <SectionTitle icon={<Bandage size={16} />}>Diễn biến chấn thương</SectionTitle>
            {extra.loading && !extra.data ? <Skeleton rows={2} /> : <InjuryProgress items={caseInjuries} />}
          </Card>

          {/* className: ép dải đỏ khi đang khóa (shadow-card của Card đè dải tone) */}
          <Card tone={horseActiveLock ? 'danger' : 'default'} className={horseActiveLock ? 'shadow-[inset_3px_0_0_0_#ef4444]!' : ''}>
            <SectionTitle
              icon={<Lock size={16} />}
              action={
                isVet &&
                isOpen &&
                !transferred &&
                horse &&
                !horseActiveLock && (
                  <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'lock' })}>
                    Đặt khóa
                  </Button>
                )
              }
            >
              Khóa huấn luyện
            </SectionTitle>
            <div className="space-y-2.5">
              {horseActiveLock && horseActiveLock.caseId !== item.id && (
                <>
                  <LockBlock lock={horseActiveLock} people={people} onRelease={isVet && !transferred ? () => setDialog({ kind: 'release', lock: horseActiveLock }) : undefined} />
                  <p className="text-xs text-gray-500">Khóa này không gắn với bệnh án đang xem.</p>
                </>
              )}
              {caseLocks.length === 0 && !horseActiveLock && <p className="text-sm text-gray-500">Bệnh án chưa có khóa huấn luyện.</p>}
              {caseLocks.map((lock) => (
                <LockBlock
                  key={lock.id}
                  lock={lock}
                  people={people}
                  onRelease={isVet && !transferred ? () => setDialog({ kind: 'release', lock }) : undefined}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">Khóa độc lập với sức khỏe và không tự gỡ khi tới ngày dự kiến.</p>
          </Card>

          {!isOwner && (
            <Card variant="flat">
              <SectionTitle icon={<ClipboardList size={16} />}>Yêu cầu khám đã gắn ({linkedRequests.length})</SectionTitle>
              {linkedRequests.length === 0 ? (
                <p className="text-sm text-gray-500">Chưa có yêu cầu nào được gắn vào buổi khám của bệnh án.</p>
              ) : (
                <ul className="-my-3 divide-y divide-gray-100">
                  {linkedRequests.map((request) => (
                    <li key={request.id} className="py-3">
                      <RequestRow request={request} people={people} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </aside>
      </div>

      {dialog?.kind === 'cost' && <AdjustCostModal record={dialog.record} horseName={horseName} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'lock' && horse && (
        <PlaceLockModal horse={{ id: horse.id, name: horse.name }} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === 'release' && <ReleaseLockModal lock={dialog.lock} horseName={horseName} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'void' && (
        <VoidVisitModal
          record={dialog.record}
          horseName={horseName}
          people={people}
          requestIds={dialog.requestIds}
          caseInfo={{
            status: item.status,
            otherActiveVisits: visits.filter((visit) => !visit.voidedAt && visit.id !== dialog.record.id).length,
          }}
          onClose={() => setDialog(null)}
          onVoided={reload}
          onReRecord={(record, requestIds) =>
            navigate(
              links.visitNew({
                horseId: item.horseId,
                caseId: isOpen ? item.id : undefined,
                kind: requestIds.length ? 'REQUEST' : undefined,
                requestIds: requestIds.length ? requestIds : undefined,
                replaces: record.id,
                back: links.case(item.id),
              }),
            )
          }
        />
      )}

      {editingConclusion && (
        <EditConclusionModal
          caseId={item.id}
          currentConclusion={item.finalConclusion ?? ''}
          onClose={() => setEditingConclusion(false)}
          onDone={() => {
            setEditingConclusion(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function EditConclusionModal({
  caseId,
  currentConclusion,
  onClose,
  onDone,
}: {
  caseId: string;
  currentConclusion: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [conclusion, setConclusion] = useState(currentConclusion);
  const [reason, setReason] = useState('');
  const action = useAction();
  const toast = useToast();

  const serverErrors = action.fieldErrors.finalConclusion ? { ...action.fieldErrors, conclusion: action.fieldErrors.finalConclusion } : action.fieldErrors;
  const f = useFormErrors(
    {
      conclusion: !conclusion.trim() ? 'Nhập kết luận cuối' : conclusion.trim() === currentConclusion.trim() ? 'Chưa có thay đổi' : undefined,
      reason: reason.trim() ? undefined : 'Nhập lý do đính chính',
    },
    { fieldErrors: serverErrors },
  );

  const submit = async () => {
    if (!f.attempt()) return;
    const res = await action.run(() =>
      updateCaseConclusion(caseId, {
        finalConclusion: conclusion.trim(),
        reason: reason.trim(),
      }),
    );
    if (res) {
      toast.push('Đã đính chính kết luận cuối', 'success');
      onDone();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Đính chính kết luận cuối"
      description="Bệnh án đã đóng, sửa kết luận cần ghi lý do."
      dirty={conclusion !== currentConclusion || reason.trim() !== ''}
      busy={action.pending}
      footer={
        <>
          <CancelButton variant="secondary" />
          <Button disabled={action.pending} onClick={submit}>
            {action.pending ? 'Đang lưu…' : 'Lưu kết luận'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {action.error && !serverErrors.conclusion && !serverErrors.reason && <ErrorBox message={action.error} />}
        <Field label="Kết luận cuối mới" required name="conclusion" error={f.show('conclusion')} onBlur={f.blur('conclusion')} counter={<CharCount value={conclusion} max={4000} />}>
          <Textarea
            rows={4}
            maxLength={4000}
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            placeholder="Nhập kết luận chuyên môn"
            className={cn(f.show('conclusion') && invalidClass)}
          />
        </Field>
        <Field label="Lý do đính chính" required name="reason" error={f.show('reason')} onBlur={f.blur('reason')} counter={<CharCount value={reason} max={500} />}>
          <Textarea
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: Ghi nhầm thông tin phục hồi"
            className={cn(f.show('reason') && invalidClass)}
          />
        </Field>
      </div>
    </Modal>
  );
}
