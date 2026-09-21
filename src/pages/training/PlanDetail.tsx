import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Plus, XCircle } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  addPhase,
  cancelPlan,
  clearNeedsReview,
  completePlanEarly,
  countSessionsToCancel,
  getPlan,
  listSlots,
  type WorkoutTemplateInput,
} from '../../services/training.service';
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  Modal,
  NotFound,
  PageHeader,
  Pill,
  SectionTitle,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { PlanPill } from '../../components/ui/status';
import { WeekGrid } from '../../components/WeekGrid';
import { PhasePanel } from './PhasePanel';
import { planCloseLabel } from '../../lib/labels';
import { formatDate } from '../../lib/format';
import type { PlanCloseReason } from '../../types/domain';

const phaseStateLabel = {
  PAST: 'Đã qua',
  CURRENT: 'Đang diễn ra',
  FUTURE: 'Chưa tới',
  NOT_RUN: 'Không thực hiện',
} as const;

const phaseStateTone = {
  PAST: 'gray',
  CURRENT: 'blue',
  FUTURE: 'gray',
  NOT_RUN: 'slate',
} as const;

export default function PlanDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useService(() => getPlan(id), [id]);
  const slots = useService(() => listSlots(), []);
  const action = useAction();

  const [activePhase, setActivePhase] = useState(0);
  const [closeMode, setCloseMode] = useState<'EARLY' | 'CANCEL' | null>(null);
  const [closeForm, setCloseForm] = useState({ reason: 'GOAL_REACHED' as PlanCloseReason, note: '' });
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [newPhase, setNewPhase] = useState({ name: '', goal: '', weeks: 4, template: [] as WorkoutTemplateInput[] });
  const affected = useService(() => (closeMode ? countSessionsToCancel(id) : Promise.resolve(0)), [closeMode, id]);

  if (loading) return <Skeleton rows={6} />;
  if (error || !data) return <NotFound />;

  const { plan, phases } = data;
  const phase = phases[activePhase];
  const canClose = plan.canEdit && (plan.status === 'ACTIVE' || plan.status === 'SCHEDULED');

  return (
    <div className="space-y-6 pb-8">
      <button
        onClick={() => navigate('/training/plans')}
        className="flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-gray-600"
      >
        <ArrowLeft size={16} /> Danh sách giáo án
      </button>

      <PageHeader
        title={plan.name}
        description={`${plan.horseName} · ${plan.goal}`}
        actions={
          canClose ? (
            <>
              {plan.status === 'ACTIVE' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCloseMode('EARLY');
                    setCloseForm({ reason: 'GOAL_REACHED', note: '' });
                  }}
                >
                  <CheckCircle2 size={15} /> Kết thúc sớm
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  setCloseMode('CANCEL');
                  setCloseForm({ reason: 'INJURY_ILLNESS', note: '' });
                }}
              >
                <XCircle size={15} /> Hủy giáo án
              </Button>
            </>
          ) : undefined
        }
      />

      {plan.needsReview && plan.canEdit && (
        <Card tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">Giáo án này cần xem lại</p>
              <p className="mt-0.5 text-sm text-gray-600">{plan.needsReviewReason}</p>
            </div>
            <Button
              onClick={async () => {
                const done = await action.run(() => clearNeedsReview(id));
                if (done !== undefined) reload();
              }}
            >
              Tiếp tục áp dụng
            </Button>
          </div>
        </Card>
      )}

      {action.error && <ErrorBox message={action.error} />}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <PlanPill status={plan.status} />
            <span className="text-sm text-gray-600">
              {formatDate(plan.startDate)} → {formatDate(plan.endDate)}
            </span>
            {plan.targetDistanceM && <Pill tone="gray">Cự ly mục tiêu {plan.targetDistanceM} m</Pill>}
          </div>
          <span className="text-xs text-gray-400">Lập bởi {data.createdByName}</span>
        </div>
        {plan.status === 'CANCELLED' && data.closeReason && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Đã hủy — {planCloseLabel[data.closeReason]}
            {data.closeNote ? `: ${data.closeNote}` : ''}
          </p>
        )}
      </Card>

      {/* Dòng thời gian giai đoạn */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Các giai đoạn</SectionTitle>
          {plan.canEdit && plan.status !== 'CANCELLED' && plan.status !== 'COMPLETED' && (
            <Button size="sm" variant="secondary" onClick={() => setAddPhaseOpen(true)}>
              <Plus size={14} /> Thêm giai đoạn nối tiếp
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {phases.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setActivePhase(index)}
              className={`rounded-xl border px-4 py-2.5 text-left transition ${
                activePhase === index
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <p className="text-sm font-semibold text-gray-800">
                Giai đoạn {item.orderNo} — {item.name}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                {item.weeks} tuần · {formatDate(item.startDate)} → {formatDate(item.endDate)}
                <Pill tone={phaseStateTone[item.state]}>{phaseStateLabel[item.state]}</Pill>
              </p>
            </button>
          ))}
        </div>
      </Card>

      {phase && (
        <PhasePanel
          phase={phase}
          planId={id}
          horseId={plan.horseId}
          canEdit={plan.canEdit}
          onChanged={reload}
        />
      )}

      {/* Kết thúc sớm / hủy */}
      <Modal
        open={closeMode !== null}
        onClose={() => setCloseMode(null)}
        title={closeMode === 'EARLY' ? 'Kết thúc sớm giáo án' : 'Hủy giáo án'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseMode(null)}>
              Quay lại
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const done = await action.run(() =>
                  closeMode === 'EARLY'
                    ? completePlanEarly(id, closeForm.reason, closeForm.note)
                    : cancelPlan(id, closeForm.reason, closeForm.note),
                );
                if (done !== undefined) {
                  setCloseMode(null);
                  reload();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang xử lý…' : 'Xác nhận'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            <strong>{affected.data ?? 0}</strong> buổi tập đã lên lịch từ hôm nay trở đi sẽ bị hủy với nhóm lý do
            &ldquo;Theo giáo án&rdquo;. Buổi đang chờ đánh giá vẫn đánh giá bình thường, buổi đã hoàn thành giữ nguyên
            lịch sử.
          </p>
          <Field label="Lý do" required>
            <Select
              value={closeForm.reason}
              onChange={(event) => setCloseForm({ ...closeForm, reason: event.target.value as PlanCloseReason })}
            >
              {closeMode === 'EARLY'
                ? (['GOAL_REACHED', 'NEW_PLAN', 'OTHER'] as PlanCloseReason[]).map((value) => (
                    <option key={value} value={value}>
                      {planCloseLabel[value]}
                    </option>
                  ))
                : (['INJURY_ILLNESS', 'GOAL_CHANGED', 'OWNER_REQUEST', 'OTHER'] as PlanCloseReason[]).map((value) => (
                    <option key={value} value={value}>
                      {planCloseLabel[value]}
                    </option>
                  ))}
            </Select>
          </Field>
          <Field
            label="Mô tả thêm"
            required={closeForm.reason === 'OTHER'}
            hint={closeForm.reason === 'OTHER' ? 'Tối thiểu 10 ký tự' : undefined}
            error={action.field === 'note' ? action.error : undefined}
          >
            <Textarea value={closeForm.note} onChange={(event) => setCloseForm({ ...closeForm, note: event.target.value })} />
          </Field>
          {action.error && !action.field && <ErrorBox message={action.error} />}
        </div>
      </Modal>

      {/* Thêm giai đoạn nối tiếp */}
      <Modal
        open={addPhaseOpen}
        onClose={() => setAddPhaseOpen(false)}
        title="Thêm giai đoạn nối tiếp"
        width="max-w-4xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddPhaseOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() => addPhase(id, newPhase));
                if (done) {
                  setAddPhaseOpen(false);
                  setNewPhase({ name: '', goal: '', weeks: 4, template: [] });
                  reload();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang lưu…' : 'Thêm giai đoạn'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
            Giai đoạn mới bắt đầu ngay sau ngày kết thúc hiện tại của giáo án ({formatDate(plan.endDate)}).
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tên giai đoạn" required>
              <Input value={newPhase.name} onChange={(event) => setNewPhase({ ...newPhase, name: event.target.value })} />
            </Field>
            <Field label="Số tuần" required hint="1–12 tuần">
              <Input
                type="number"
                min={1}
                max={12}
                value={newPhase.weeks}
                onChange={(event) => setNewPhase({ ...newPhase, weeks: Number(event.target.value) })}
              />
            </Field>
            <Field label="Mục tiêu">
              <Input value={newPhase.goal} onChange={(event) => setNewPhase({ ...newPhase, goal: event.target.value })} />
            </Field>
          </div>
          <WeekGrid
            value={newPhase.template}
            slots={slots.data ?? []}
            onChange={(template) => setNewPhase({ ...newPhase, template })}
          />
          {action.error && <ErrorBox message={action.error} />}
        </div>
      </Modal>
    </div>
  );
}
