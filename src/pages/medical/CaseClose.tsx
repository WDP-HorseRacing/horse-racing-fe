// F3.9 — Trang đóng bệnh án (VET).
// Chi phí đã ghi ở từng buổi khám, trang này chỉ hiện tổng. Còn vết chấn thương chưa lành thì BE chặn đóng:
// trang liệt kê vết và dẫn sang ghi buổi tái khám đánh dấu Đã lành.
// Cột trái: kết luận cuối, chi phí, quyết định với khóa huấn luyện còn hiệu lực.
// Cột phải: tóm tắt bệnh án, yêu cầu khám còn chờ của ngựa, nút đóng.
import { useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Bandage, FileCheck2, Lock, Plus, Wallet } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { getHorse } from '../../api/horses';
import { closeCase, getCase, getClosePreview, getInjuries, listHorseExamRequests } from '../../api/medical';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { useCrumbs } from '../../components/Breadcrumb';
import { CharCount, ErrorBox, Field, Notice, NotFound, PageHeader, Skeleton, Textarea, Button, cn, invalidClass, scrollToFirstError, useToast } from '../../components/ui';
import { bodyRegionLabel, injuryTypeLabel } from '../../lib/api-labels';
import { RecoveryTag } from './components/ExamTimeline';
import { healthLabel } from '../../lib/labels';
import { formatDate, formatMoney } from '../../lib/format';
import { links, safeInternalPath } from '../../lib/links';
import { usePeople } from './components/people';
import { RequestMeta, RequestText } from './components/parts';
import { dateToIso, todayKey } from './components/utils';
import { BackLink, FormSection, HorseCard, Outcome, SaveCard } from './components/form-page';
import { DatePicker } from '../../components/ui/DatePicker';

const CONCLUSION_MAX = 4000;

export default function CaseClose() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const action = useAction();
  const user = useStore((state) => state.currentUser);
  const formRef = useRef<HTMLDivElement>(null);
  const people = usePeople();

  const data = useService(async () => {
    const item = await getCase(id);
    const [horse, preview, pending, injuries] = await Promise.all([
      getHorse(item.horseId),
      item.status === 'OPEN' ? getClosePreview(id) : Promise.resolve(null),
      listHorseExamRequests(item.horseId).then((rows) => rows.filter((row) => row.status === 'PENDING')).catch(() => []),
      getInjuries(item.horseId).catch(() => []),
    ]);
    return { item, horse, preview, pending, injuries: injuries.filter((injury) => injury.history.some((step) => step.caseId === id)) };
  }, [id]);

  const [conclusion, setConclusion] = useState('');
  const [decision, setDecision] = useState<'RELEASE' | 'KEEP' | ''>('');
  const [keepDate, setKeepDate] = useState('');
  const [attempted, setAttempted] = useState(false);

  const item = data.data?.item;
  const horse = data.data?.horse;
  useCrumbs(item && horse ? [{ label: `${horse.name} · ${item.initialDiagnosis}`, to: links.case(item.id) }, { label: 'Đóng bệnh án' }] : null);

  if (!can(user, 'case.close')) return <NotFound message="Chỉ bác sĩ thú y đóng được bệnh án." />;
  if (data.loading && !data.data) return <Skeleton rows={6} />;
  if (data.error || !data.data || !item || !horse) return <NotFound message={data.error} />;

  const { preview, pending, injuries } = data.data;
  const back = safeInternalPath(params.get('back')) ?? links.case(item.id);
  if (item.status !== 'OPEN' || !preview) {
    return (
      <div className="space-y-5">
        <PageHeader back={<BackLink to={links.case(item.id)}>Về bệnh án</BackLink>} title="Đóng bệnh án" />
        <Notice tone="info">Bệnh án này đã {item.status === 'CLOSED' ? 'đóng' : 'hủy'}, không đóng lại được.</Notice>
      </div>
    );
  }

  const lock = preview.activeLock;
  const unhealed = injuries.filter((injury) => injury.currentRecoveryStatus !== 'HEALED');
  // Đếm của BE là chuẩn, danh sách lấy từ diễn biến chấn thương.
  const blocked = preview.unhealedInjuryCount > 0;
  const followUp = links.visitNew({ horseId: horse.id, caseId: item.id, back: links.caseClose(item.id) });
  const errors: Record<string, string> = {};
  if (!conclusion.trim()) errors.conclusion = 'Nhập kết luận cuối';
  if (lock && !decision) errors.decision = 'Chọn gỡ hoặc giữ khóa huấn luyện';
  if (lock && decision === 'KEEP' && !keepDate) errors.keepDate = 'Chọn ngày dự kiến gỡ khóa';
  const show = (key: string) => (attempted ? errors[key] : undefined);
  const visits = item.visits.filter((visit) => !visit.voidedAt);

  const submit = () => {
    setAttempted(true);
    if (blocked) return;
    if (Object.keys(errors).length > 0) {
      scrollToFirstError(formRef.current ?? document);
      return;
    }
    action.run(
      () =>
        closeCase(item.id, {
          finalConclusion: conclusion.trim(),
          ...(lock ? { lockDecision: decision as 'RELEASE' | 'KEEP' } : {}),
          ...(lock && decision === 'KEEP' ? { lockExpectedEnd: dateToIso(keepDate) } : {}),
        }),
      () => {
        toast.push(`Đã đóng bệnh án của ${horse.name}`, 'success');
        navigate(links.case(item.id), { replace: true });
      },
    );
  };

  return (
    <div className="space-y-5" ref={formRef}>
      <PageHeader
        back={<BackLink to={back}>Về bệnh án</BackLink>}
        title="Đóng bệnh án"
        description={`${horse.name} · ${item.initialDiagnosis}`}
      />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {blocked && (
            <Notice tone="danger" icon={<Bandage size={16} />}>
              <p className="font-medium">Còn {preview.unhealedInjuryCount} chấn thương chưa lành, chưa đóng được bệnh án.</p>
              <p className="mt-0.5">Ghi một buổi tái khám đánh dấu Đã lành cho từng vết dưới đây rồi quay lại đóng.</p>
              {unhealed.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {unhealed.map((injury) => (
                    <li key={injury.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{bodyRegionLabel[injury.bodyRegion]}</span>
                      <span>· {injuryTypeLabel[injury.injuryType]}</span>
                      <RecoveryTag status={injury.currentRecoveryStatus} />
                    </li>
                  ))}
                </ul>
              )}
              <Button size="sm" className="mt-3" onClick={() => navigate(followUp)}>
                <Plus size={14} /> Ghi buổi tái khám
              </Button>
            </Notice>
          )}

          {preview.healthWarning && (
            <Notice tone="warning">
              Ngựa vẫn đang <span className="font-semibold">{healthLabel[preview.healthStatus]}</span>. Ngựa khỏi rồi thì nhớ đổi lại sức khỏe.
            </Notice>
          )}

          <FormSection icon={<FileCheck2 size={16} />} title="Kết luận cuối">
            <Field name="conclusion" error={show('conclusion')} counter={<CharCount value={conclusion} max={CONCLUSION_MAX} />}>
              <Textarea
                rows={6}
                maxLength={CONCLUSION_MAX}
                value={conclusion}
                onChange={(event) => setConclusion(event.target.value)}
                placeholder="Ví dụ: Hồi phục hoàn toàn sau 2 tuần giảm tải, siêu âm gân bình thường"
                className={cn('min-h-36', show('conclusion') && invalidClass)}
              />
            </Field>
          </FormSection>

          <FormSection icon={<Wallet size={16} />} title="Chi phí điều trị">
            <p className="text-2xl font-bold tabular-nums text-gray-900">{formatMoney(item.totalCost ?? 0)}</p>
            <p className="text-sm text-gray-500">
              Cộng chi phí {visits.length} buổi khám của bệnh án. Chi phí ghi ở từng buổi khám, sai số thì điều chỉnh ở buổi đó trong trang bệnh án.
            </p>
          </FormSection>

          {lock && (
            <FormSection icon={<Lock size={16} />} title="Khóa huấn luyện còn hiệu lực">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{lock.reason}</span>
                {lock.lockEnd && <span className="text-gray-500"> · dự kiến gỡ {formatDate(lock.lockEnd)}</span>}
              </p>
              <div data-field="decision" data-invalid={show('decision') ? 'true' : undefined} className="grid gap-2 sm:grid-cols-2">
                {(['RELEASE', 'KEEP'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDecision(value)}
                    aria-pressed={decision === value}
                    className={cn(
                      'rounded-xl bg-white px-4 py-3 text-left transition',
                      decision === value ? 'ring-2 ring-emerald-700' : show('decision') ? 'ring-1 ring-red-300' : 'ring-1 ring-gray-200 hover:ring-gray-300',
                    )}
                  >
                    <span className="block text-sm font-semibold text-gray-900">{value === 'RELEASE' ? 'Gỡ khóa khi đóng' : 'Giữ khóa'}</span>
                    <span className="block text-xs text-gray-500">{value === 'RELEASE' ? 'Ngựa được tập lại nếu sức khỏe cho phép.' : 'Khóa vẫn hiệu lực sau khi đóng bệnh án.'}</span>
                  </button>
                ))}
              </div>
              {show('decision') && <p className="text-xs font-medium text-red-600">{show('decision')}</p>}
              {decision === 'KEEP' && (
                <Field label="Ngày dự kiến gỡ" required name="keepDate" error={show('keepDate')} className="sm:max-w-xs">
                  <DatePicker value={keepDate} min={todayKey()} onChange={setKeepDate} invalid={!!show('keepDate')} />
                </Field>
              )}
            </FormSection>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
          <HorseCard
            name={horse.name}
            to={links.horseMedical(horse.id)}
            place={[horse.location.barn?.name, horse.location.stall?.code].filter(Boolean).join(' · ')}
            health={horse.healthStatus}
            locked={horse.activeTrainingLock}
          >
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Mở bệnh án</dt>
                <dd className="text-gray-900">{formatDate(item.openedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Bác sĩ mở</dt>
                <dd className="truncate text-gray-900">{people.name(item.openedBy, 'vet')}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Số buổi khám</dt>
                <dd className="text-gray-900">{visits.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Chấn thương đã ghi</dt>
                <dd className="text-gray-900">
                  {injuries.length}
                  {unhealed.length > 0 && <span className="text-red-600"> · {unhealed.length} chưa lành</span>}
                </dd>
              </div>
            </dl>
          </HorseCard>

          {pending.length > 0 && (
            <div className="rounded-2xl bg-amber-50/60 p-4 ring-1 ring-amber-200/70">
              <p className="text-sm font-medium text-amber-900">Ngựa còn {pending.length} yêu cầu khám đang chờ</p>
              <p className="mt-0.5 text-xs text-amber-800">Yêu cầu vẫn ở hàng đợi sau khi đóng bệnh án.</p>
              <ul className="mt-2.5 space-y-2">
                {pending.map((row) => (
                  <li key={row.id} className="rounded-lg bg-white/80 p-2.5">
                    <RequestMeta request={row} people={people} />
                    <div className="mt-1">
                      <RequestText text={row.description} compact />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <SaveCard>
            <ul className="space-y-1.5">
              <Outcome>Bệnh án chuyển sang Đã đóng, không thêm buổi khám, không mở lại</Outcome>
              <Outcome>Chủ ngựa và quản lý nhận thông báo kèm chi phí {formatMoney(item.totalCost ?? 0)}</Outcome>
              {lock && decision === 'RELEASE' && <Outcome>Gỡ khóa huấn luyện</Outcome>}
              {lock && decision === 'KEEP' && <Outcome tone="warning">Giữ khóa{keepDate ? ` tới khoảng ${formatDate(keepDate)}` : ''}</Outcome>}
            </ul>
            {action.error && <ErrorBox message={action.error} />}
            <div className="space-y-2 border-t border-gray-100 pt-4">
              <Button className="h-11 w-full" onClick={submit} disabled={action.pending || blocked}>
                {action.pending ? 'Đang lưu…' : 'Đóng bệnh án'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate(back)} disabled={action.pending}>
                Hủy
              </Button>
            </div>
          </SaveCard>
        </aside>
      </div>
    </div>
  );
}
