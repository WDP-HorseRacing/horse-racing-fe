// F4.2 — Khối khẩu phần trong tab Chăm sóc: bản đang áp dụng theo 4 bữa, các bản nháp (HLV khu sửa, áp dụng, xóa), lịch sử gập lại.
// Groom chỉ nhận bản đang áp dụng (BE lọc). Quản lý CLB, bác sĩ chỉ xem.
import { useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash2, Utensils } from 'lucide-react';
import { applyFeedingPlan, deleteFeedingPlan, listFeedingPlans } from '../../../api/stable-care';
import type { FeedingPlan } from '../../../api/types';
import { Button, ConfirmDialog, EmptyState, ErrorBox, Pill, Skeleton, cn, useToast } from '../../../components/ui';
import { useAction, useService } from '../../../hooks/useService';
import { formatDate, formatDateTime } from '../../../lib/format';
import { FeedingPlanEditor } from './FeedingPlanEditor';
import { MealPlan } from './MealPlan';

export function FeedingSection({ horse, canEdit, className }: { horse: { id: string; name: string; barnId?: string | null }; canEdit: boolean; className?: string }) {
  const toast = useToast();
  const plans = useService(() => listFeedingPlans(horse.id), [horse.id]);
  const [editing, setEditing] = useState<{ draft?: FeedingPlan } | null>(null);
  const [applying, setApplying] = useState<FeedingPlan | null>(null);
  const [removing, setRemoving] = useState<FeedingPlan | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const apply = useAction();
  const remove = useAction();

  const rows = plans.data ?? [];
  const active = rows.find((plan) => plan.status === 'ACTIVE');
  const drafts = rows.filter((plan) => plan.status === 'DRAFT');
  const archived = rows.filter((plan) => plan.status === 'ARCHIVED');

  return (
    <section className={cn('rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Utensils size={17} className="text-emerald-700" /> Khẩu phần ăn
        </h3>
        {canEdit && (
          <Button variant="inline" size="sm" onClick={() => setEditing({})}>
            <Plus size={14} /> Lập khẩu phần
          </Button>
        )}
      </div>

      {plans.loading && !plans.data ? (
        <Skeleton rows={3} />
      ) : plans.error ? (
        <ErrorBox message={plans.error} />
      ) : (
        <div className="space-y-4">
          {active ? (
            <div>
              <MealPlan plan={active} />
              {active.note && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{active.note}</p>}
              <p className="mt-2 text-xs text-gray-500">
                Áp dụng từ {formatDate(active.approvedAt)}
                {active.approver ? ` bởi HLV ${active.approver.fullName}` : ''}
              </p>
            </div>
          ) : (
            <EmptyState
              title="Chưa có khẩu phần đang áp dụng"
              hint={canEdit ? 'Lập khẩu phần theo bữa rồi áp dụng, Groom thấy ngay trên màn Việc hôm nay.' : 'HLV khu lập và áp dụng khẩu phần cho ngựa.'}
              className="py-6"
            />
          )}

          {drafts.map((draft) => (
            <div key={draft.id} className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Pill tone="amber">Nháp</Pill>
                  <span className="text-xs font-normal text-gray-500">
                    {draft.creator.fullName} · sửa {formatDateTime(draft.updatedAt)}
                  </span>
                </p>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" title="Xóa bản nháp" onClick={() => setRemoving(draft)}>
                      <Trash2 size={15} />
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditing({ draft })}>
                      <Pencil size={13} /> Sửa
                    </Button>
                    <Button size="sm" onClick={() => setApplying(draft)}>
                      Áp dụng
                    </Button>
                  </div>
                )}
              </div>
              <MealPlan plan={draft} />
              {draft.note && <p className="mt-2 text-sm text-gray-600">{draft.note}</p>}
            </div>
          ))}

          {archived.length > 0 && (
            <div>
              <button type="button" onClick={() => setHistoryOpen((open) => !open)} className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
                <ChevronDown size={15} className={cn('transition', historyOpen && 'rotate-180')} /> Lịch sử ({archived.length})
              </button>
              {historyOpen && (
                <ul className="mt-2 space-y-3">
                  {archived.map((plan) => (
                    <li key={plan.id} className="rounded-2xl bg-gray-50/70 p-3 ring-1 ring-gray-100">
                      <p className="mb-2 text-xs text-gray-500">
                        Áp dụng {formatDate(plan.approvedAt)} đến {formatDate(plan.archivedAt)}
                        {plan.approver ? ` · HLV ${plan.approver.fullName}` : ''}
                      </p>
                      <MealPlan plan={plan} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {editing && <FeedingPlanEditor horse={horse} draft={editing.draft} onClose={() => setEditing(null)} onSaved={plans.reload} />}
      <ConfirmDialog
        open={!!applying}
        danger={false}
        title={`Áp dụng khẩu phần cho ${horse.name}`}
        message={active ? 'Khẩu phần đang áp dụng sẽ chuyển vào lịch sử. Groom thấy bản mới ngay.' : 'Groom thấy khẩu phần này ngay trên màn Việc hôm nay.'}
        confirmLabel="Áp dụng"
        pending={apply.pending}
        onClose={() => {
          apply.clearError();
          setApplying(null);
        }}
        onConfirm={() =>
          applying &&
          void apply.run(
            () => applyFeedingPlan(applying.id),
            () => {
              toast.push(`Đã áp dụng khẩu phần mới cho ${horse.name}`, 'success');
              setApplying(null);
              plans.reload();
            },
          )
        }
      >
        {apply.error && <ErrorBox message={apply.error} />}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!removing}
        title="Xóa bản nháp"
        message="Bản nháp bị xóa hẳn. Khẩu phần đang áp dụng không đổi."
        confirmLabel="Xóa"
        pending={remove.pending}
        onClose={() => {
          remove.clearError();
          setRemoving(null);
        }}
        onConfirm={() =>
          removing &&
          void remove.run(
            () => deleteFeedingPlan(removing.id),
            () => {
              toast.push('Đã xóa bản nháp', 'success');
              setRemoving(null);
              plans.reload();
            },
          )
        }
      >
        {remove.error && <ErrorBox message={remove.error} />}
      </ConfirmDialog>
    </section>
  );
}
