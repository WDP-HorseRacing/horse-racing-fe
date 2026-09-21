import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Boxes, Camera, CheckCircle2, ClipboardCheck, Play, UtensilsCrossed } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  approveDietPlan,
  completeTask,
  createIncident,
  createRestockRequest,
  decideRestockRequest,
  listDailyTasks,
  listDietPlans,
  listIncidents,
  listRestockRequests,
  listStock,
  listSupplyItems,
  resolveIncident,
} from '../../services/care.service';
import { listCareInstructions } from '../../services/medical.service';
import { listTodaySessions } from '../../services/training.service';
import { listHorses, listZones } from '../../services/horse.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  Pill,
  SectionTitle,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { SessionPill } from '../../components/ui/status';
import { dietKindLabel, incidentTypeLabel, mealLabel, supplyGroupLabel, workoutLabel } from '../../lib/labels';
import { formatDateTime } from '../../lib/format';
import { readImageFile } from '../../lib/files';
import type { IncidentType } from '../../types/domain';

/* ===== F4.3 — Hôm nay ===== */

export function TodayCare() {
  const navigate = useNavigate();
  const tasks = useService(() => listDailyTasks(), []);
  const sessions = useService(() => listTodaySessions(), []);
  const action = useAction();

  const mine = (tasks.data ?? []).filter((task) => task.mine);
  const done = mine.filter((task) => task.doneAt).length;

  const byHorse = mine.reduce<Record<string, typeof mine>>((groups, task) => {
    groups[task.horseId] = [...(groups[task.horseId] ?? []), task];
    return groups;
  }, {});

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Hôm nay"
        description={`${done}/${mine.length} công việc đã hoàn thành.`}
      />

      {action.error && <ErrorBox message={action.error} />}

      {/* Buổi tập trong ngày — chỉ đọc, mở sang màn hình thực hiện buổi tập */}
      <Card>
        <SectionTitle icon={<Play size={16} className="text-emerald-600" />}>Buổi tập hôm nay</SectionTitle>
        {(sessions.data?.length ?? 0) === 0 ? (
          <p className="py-4 text-center text-sm font-light text-gray-400">Bạn không có buổi tập nào hôm nay.</p>
        ) : (
          <div className="space-y-2">
            {sessions.data?.map((session) => (
              <button
                key={session.id}
                onClick={() => navigate('/training/today')}
                className="flex w-full items-center gap-3 rounded-xl bg-gray-50 p-3 text-left transition hover:bg-gray-100"
              >
                <span className="w-20 shrink-0 font-mono text-xs text-gray-400">{session.slotLabel}</span>
                <Avatar src={session.horseAvatar} name={session.horseName} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">{session.horseName}</p>
                  <p className="truncate text-xs text-gray-400">
                    {workoutLabel[session.workoutType]} {session.distanceM} m × {session.repetitions}
                  </p>
                </div>
                <SessionPill status={session.status} />
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs font-light text-gray-400">
          Trạng thái buổi tập lấy từ lịch huấn luyện, không tích tay ở đây.
        </p>
      </Card>

      {tasks.loading && <Skeleton rows={4} />}

      {/* Checklist */}
      <div className="space-y-4">
        {Object.entries(byHorse).map(([horseId, horseTasks]) => {
          const doneCount = horseTasks.filter((task) => task.doneAt).length;
          return (
            <Card key={horseId}>
              <div className="mb-4 flex items-center gap-3">
                <Avatar src={horseTasks[0].horseAvatar} name={horseTasks[0].horseName} size={40} />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{horseTasks[0].horseName}</p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all"
                      style={{ width: `${(doneCount / horseTasks.length) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-500 tabular-nums">
                  {doneCount}/{horseTasks.length}
                </span>
              </div>

              <div className="space-y-1">
                {horseTasks.map((task) => (
                  <button
                    key={task.id}
                    disabled={!!task.doneAt}
                    onClick={async () => {
                      const result = await action.run(() => completeTask(task.id));
                      if (result !== undefined) tasks.reload();
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                      task.doneAt ? 'bg-emerald-50/60 opacity-70' : 'hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle2 size={20} className={task.doneAt ? 'text-emerald-600' : 'text-gray-200'} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${task.doneAt ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                        {task.label}
                      </p>
                      {task.doneAt && <p className="text-xs text-gray-400">Hoàn thành {formatDateTime(task.doneAt)}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {!tasks.loading && mine.length === 0 && (
        <EmptyState
          title="Hôm nay bạn chưa được giao ngựa nào"
          hint="Quản lý câu lạc bộ hoặc huấn luyện viên phân công ngựa cho bạn trên sơ đồ chuồng."
        />
      )}
    </div>
  );
}

/* ===== Việc chăm sóc của tôi ===== */

export function CareInstructions() {
  const { data, loading } = useService(() => listCareInstructions(), []);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Việc chăm sóc của tôi"
        description="Chỉ dẫn chăm sóc do bác sĩ ghi trong hồ sơ khám đang điều trị của những con ngựa bạn phụ trách."
      />
      {loading && <Skeleton rows={3} />}
      {!loading && (data?.length ?? 0) === 0 && (
        <EmptyState title="Không có chỉ dẫn chăm sóc nào" hint="Ngựa bạn phụ trách hiện không có hồ sơ đang điều trị." />
      )}
      <div className="space-y-3">
        {data?.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start gap-4">
              <Avatar src={item.horseAvatar} name={item.horseName} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{item.horseName}</p>
                <p className="mt-1 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                  {item.careInstruction}
                </p>
                <p className="mt-2 text-xs text-gray-400">Từ hồ sơ khám ngày {item.examDate}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card tone="muted">
        <p className="text-sm text-gray-500">
          Bạn thấy chỉ dẫn chăm sóc nhưng không thấy chẩn đoán và đơn thuốc — đó là chi tiết y tế thuộc quyền của bác sĩ,
          quản lý và chủ ngựa.
        </p>
      </Card>
    </div>
  );
}

/* ===== F4.2 — Khẩu phần ===== */

export function DietPlans() {
  const currentUser = useStore((state) => state.currentUser);
  const canApprove = can(currentUser, 'diet.approve');
  const { data, loading, reload } = useService(() => listDietPlans(), []);
  const action = useAction();

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Khẩu phần ăn"
        description={
          currentUser?.role === 'GROOM'
            ? 'Bạn chỉ thấy khẩu phần đã được bác sĩ duyệt.'
            : 'Huấn luyện viên đề xuất, bác sĩ thú y duyệt. Phiên bản cũ vẫn áp dụng tới khi bản mới được duyệt.'
        }
      />
      {action.error && <ErrorBox message={action.error} />}
      {loading && <Skeleton rows={3} />}

      <div className="space-y-4">
        {data?.map((plan) => (
          <Card key={plan.id} tone={plan.status === 'PENDING' ? 'warning' : 'default'}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                  {plan.horseName}
                  <Pill tone={plan.status === 'APPROVED' ? 'green' : plan.status === 'PENDING' ? 'amber' : 'gray'}>
                    {plan.status === 'APPROVED' ? 'Đang áp dụng' : plan.status === 'PENDING' ? 'Chờ duyệt' : 'Đã thay thế'}
                  </Pill>
                  <span className="text-xs font-normal text-gray-400">phiên bản {plan.revision}</span>
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Đề xuất bởi {plan.proposedByName}
                  {plan.approvedByName ? ` · duyệt bởi ${plan.approvedByName}` : ''}
                </p>
              </div>
              {canApprove && plan.status === 'PENDING' && (
                <Button
                  onClick={async () => {
                    const done = await action.run(() => approveDietPlan(plan.id));
                    if (done !== undefined) reload();
                  }}
                >
                  <UtensilsCrossed size={15} /> Duyệt khẩu phần
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {plan.meals.map((meal) => (
                <div key={meal.meal} className="rounded-xl bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-gray-400">{mealLabel[meal.meal]}</p>
                  {meal.items.map((item, index) => (
                    <p key={index} className="text-sm text-gray-700">
                      {item.name}{' '}
                      <span className="text-gray-400">
                        {item.amount} {item.unit}
                      </span>
                      <span className="ml-1 text-[11px] text-gray-300">{dietKindLabel[item.kind]}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ===== F4.4 — Sự cố ===== */

export function IncidentList() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const canReport = can(currentUser, 'incident.create');
  const canHandle = can(currentUser, 'incident.handle');
  const { data, loading, reload } = useService(() => listIncidents(), []);
  const action = useAction();

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Báo cáo sự cố"
        description="Sự cố tại chuồng được đẩy thẳng vào khung việc cần xử lý của bác sĩ thú y."
        actions={
          canReport ? (
            <Button onClick={() => navigate('/care/incidents/new')}>
              <Camera size={16} /> Báo sự cố mới
            </Button>
          ) : undefined
        }
      />
      {action.error && <ErrorBox message={action.error} />}
      {loading && <Skeleton rows={3} />}
      {!loading && (data?.length ?? 0) === 0 && <EmptyState title="Chưa có sự cố nào được báo" />}

      <div className="space-y-3">
        {data?.map((incident) => (
          <Card key={incident.id} tone={incident.urgent && incident.status !== 'RESOLVED' ? 'danger' : 'default'}>
            <div className="flex flex-wrap items-start gap-4">
              {incident.photos[0] && (
                <img src={incident.photos[0]} alt="Ảnh sự cố" className="h-20 w-28 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                  {incident.horseName}
                  <Pill tone="gray">{incidentTypeLabel[incident.type]}</Pill>
                  {incident.urgent && <Pill tone="red">Khẩn</Pill>}
                  <Pill tone={incident.status === 'RESOLVED' ? 'green' : incident.status === 'IN_PROGRESS' ? 'amber' : 'blue'}>
                    {incident.status === 'RESOLVED' ? 'Đã xử lý' : incident.status === 'IN_PROGRESS' ? 'Đang xử lý' : 'Mới'}
                  </Pill>
                </p>
                <p className="mt-1 text-sm text-gray-600">{incident.description}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {incident.reportedByName} · {formatDateTime(incident.createdAt)}
                  {incident.handledByName ? ` · bác sĩ ${incident.handledByName}` : ''}
                </p>
                {incident.conclusion && (
                  <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{incident.conclusion}</p>
                )}
              </div>
              {canHandle && incident.status !== 'RESOLVED' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const conclusion = window.prompt('Kết luận xử lý sự cố:');
                    if (!conclusion) return;
                    const done = await action.run(() => resolveIncident(incident.id, conclusion));
                    if (done !== undefined) reload();
                  }}
                >
                  Đánh dấu đã xử lý
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function IncidentForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const horses = useService(() => listHorses(), []);
  const action = useAction();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string>();

  const [form, setForm] = useState({
    horseId: params.get('horseId') ?? '',
    type: 'NOT_EATING' as IncidentType,
    description: '',
    urgent: false,
    photos: [] as string[],
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <PageHeader
        title="Báo cáo sự cố"
        description="Ghi lại những gì bạn quan sát được tại chuồng. Bác sĩ thú y và huấn luyện viên khu nhận thông báo ngay."
      />

      <Card>
        <div className="space-y-4">
          <Field label="Ngựa" required error={action.field === 'horseId' ? action.error : undefined}>
            <Select value={form.horseId} onChange={(event) => setForm({ ...form, horseId: event.target.value })}>
              <option value="">Chọn ngựa</option>
              {horses.data?.map((horse) => (
                <option key={horse.id} value={horse.id}>
                  {horse.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Loại sự cố" required>
            <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as IncidentType })}>
              {Object.entries(incidentTypeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Mô tả" required error={action.field === 'description' ? action.error : undefined}>
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Ngựa có biểu hiện gì, từ lúc nào, bạn đã làm gì?"
            />
          </Field>

          <Field label="Ảnh" required error={action.field === 'photos' ? action.error : photoError}>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                setPhotoError(undefined);
                try {
                  const src = await readImageFile(file);
                  setForm((current) => ({ ...current, photos: [...current.photos, src] }));
                } catch (caught) {
                  setPhotoError(caught instanceof Error ? caught.message : 'Không đọc được tệp ảnh');
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                <Camera size={14} /> Thêm ảnh
              </Button>
              {form.photos.map((photo, index) => (
                <img key={index} src={photo} alt="Ảnh sự cố" className="h-16 w-20 rounded-lg object-cover" />
              ))}
            </div>
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.urgent}
              onChange={(event) => setForm({ ...form, urgent: event.target.checked })}
              className="h-4 w-4 rounded accent-red-600"
            />
            Mức khẩn — bác sĩ nhận thông báo ưu tiên
          </label>

          {action.error && !action.field && <ErrorBox message={action.error} />}

          <div className="flex gap-3">
            <Button
              onClick={async () => {
                const done = await action.run(() => createIncident(form));
                if (done) navigate('/care/incidents');
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang gửi…' : 'Gửi báo cáo'}
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Hủy
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ===== F4.5 — Vật tư ===== */

export function Supplies() {
  const currentUser = useStore((state) => state.currentUser);
  const canRequest = can(currentUser, 'restock.request');
  const canApprove = can(currentUser, 'restock.approve');
  const stock = useService(() => listStock(), []);
  const requests = useService(() => listRestockRequests(), []);
  const items = useService(() => listSupplyItems(), []);
  const zones = useService(() => listZones(), []);
  const action = useAction();

  const [requestOpen, setRequestOpen] = useState(false);
  const [form, setForm] = useState({ zoneId: '', itemId: '', quantity: 0, reason: '' });

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Vật tư"
        description="Tồn kho theo khu. Mục dưới ngưỡng tối thiểu được tô cảnh báo."
        actions={
          canRequest ? (
            <Button onClick={() => setRequestOpen(true)}>
              <Boxes size={16} /> Đề xuất bổ sung
            </Button>
          ) : undefined
        }
      />

      {action.error && <ErrorBox message={action.error} />}

      {(requests.data?.length ?? 0) > 0 && (
        <Card>
          <SectionTitle icon={<ClipboardCheck size={16} className="text-emerald-600" />}>Đề xuất bổ sung</SectionTitle>
          <div className="space-y-2">
            {requests.data?.map((request) => (
              <div
                key={request.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl p-3 ${
                  request.status === 'PENDING' ? 'bg-amber-50/70' : 'bg-gray-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800">
                    {request.itemName} — {request.quantity} {request.unit}{' '}
                    <span className="font-normal text-gray-400">· {request.zoneName}</span>
                  </p>
                  <p className="text-xs text-gray-500">{request.reason}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {request.requestedByName}
                    {request.decidedByName ? ` · quyết định bởi ${request.decidedByName}` : ''}
                    {request.decisionNote ? ` — ${request.decisionNote}` : ''}
                  </p>
                </div>
                <Pill tone={request.status === 'APPROVED' ? 'green' : request.status === 'REJECTED' ? 'red' : 'amber'}>
                  {request.status === 'APPROVED' ? 'Đã duyệt' : request.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                </Pill>
                {canApprove && request.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        const done = await action.run(() => decideRestockRequest(request.id, true, ''));
                        if (done !== undefined) {
                          requests.reload();
                          stock.reload();
                        }
                      }}
                    >
                      Duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const note = window.prompt('Lý do từ chối:');
                        if (!note) return;
                        const done = await action.run(() => decideRestockRequest(request.id, false, note));
                        if (done !== undefined) requests.reload();
                      }}
                    >
                      Từ chối
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {stock.loading && <Skeleton rows={4} />}
      {stock.data?.map((zone) => (
        <Card key={zone.zoneId}>
          <SectionTitle>{zone.zoneName}</SectionTitle>
          {zone.items.length === 0 ? (
            <p className="text-sm font-light text-gray-400">Khu này chưa có vật tư nào được theo dõi.</p>
          ) : (
            <div className="space-y-1">
              {zone.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      {supplyGroupLabel[item.group]} · ngưỡng tối thiểu {item.minQuantity} {item.unit}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${item.low ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {item.quantity} {item.unit}
                    {item.low && ' · dưới ngưỡng'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Đề xuất bổ sung vật tư"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequestOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() => createRestockRequest(form));
                if (done !== undefined) {
                  setRequestOpen(false);
                  requests.reload();
                }
              }}
              disabled={action.pending}
            >
              Gửi đề xuất
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Khu" required>
            <Select value={form.zoneId} onChange={(event) => setForm({ ...form, zoneId: event.target.value })}>
              <option value="">Chọn khu</option>
              {zones.data?.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vật tư" required>
            <Select value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })}>
              <option value="">Chọn vật tư</option>
              {items.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Số lượng" required error={action.field === 'quantity' ? action.error : undefined}>
            <Input
              type="number"
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
            />
          </Field>
          <Field label="Lý do" required error={action.field === 'reason' ? action.error : undefined}>
            <Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
