import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Lock, Plus, Stethoscope, Syringe, Unlock } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  createCareSchedule,
  createDefaultCareSchedules,
  createMedicalRecord,
  dismissTask,
  getHealthBoard,
  listCareSchedules,
  listIsolationStalls,
  listMedicalRecords,
  listTrainingLocks,
  liftTrainingLock,
  markCareDone,
  placeTrainingLock,
} from '../../services/medical.service';
import { getStableMap, listHorses } from '../../services/horse.service';
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
import { HealthPill, SeverityPill, stallBorder } from '../../components/ui/status';
import {
  careInterval,
  careTypeLabel,
  healthLabel,
  medicalReasonLabel,
  medicalStatusLabel,
  severityLabel,
} from '../../lib/labels';
import { formatDate, formatMoney, toDateKey } from '../../lib/format';
import { now } from '../../lib/clock';
import type { CareScheduleType, HealthStatus, MedicalReason, Severity } from '../../types/domain';

/* ===== F3.1 — Sơ đồ sức khỏe ===== */

export function HealthBoard() {
  const navigate = useNavigate();
  const board = useService(() => getHealthBoard(), []);
  const map = useService(() => getStableMap(), []);
  const action = useAction();
  const [createFor, setCreateFor] = useState<{ horseId: string; horseName: string; detail: string; key: string } | null>(
    null,
  );
  const [filterStatus, setFilterStatus] = useState<HealthStatus | ''>('');

  if (board.loading || map.loading) return <Skeleton rows={5} />;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Sơ đồ trạng thái sức khỏe"
        description="Màu ô chuồng theo trạng thái sức khỏe, biểu tượng ổ khóa là ngựa đang bị khóa huấn luyện."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(Object.keys(healthLabel) as HealthStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
            className={`rounded-2xl border p-5 text-left transition ${
              filterStatus === status ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100 bg-white'
            } shadow-[0_2px_8px_rgba(5,96,69,0.05)]`}
          >
            <p className="text-3xl font-bold text-gray-900 tabular-nums">{board.data?.counts[status] ?? 0}</p>
            <p className="mt-1 text-sm text-gray-500">{healthLabel[status]}</p>
          </button>
        ))}
      </div>

      {board.data?.showTasks && (
        <Card>
          <SectionTitle icon={<AlertTriangle size={16} className="text-amber-500" />}>
            Việc cần xử lý ({board.data.tasks.length})
          </SectionTitle>
          {board.data.tasks.length === 0 ? (
            <EmptyState title="Không có việc nào đang chờ" hint="Mọi tín hiệu từ các luồng khác đã được xử lý." />
          ) : (
            <div className="space-y-2">
              {board.data.tasks.map((task) => (
                <div key={task.key} className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-4">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${task.urgent ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {task.horseName} <span className="font-normal text-gray-400">· {task.source}</span>
                    </p>
                    <p className="text-sm text-gray-500">{task.detail}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setCreateFor({
                          horseId: task.horseId,
                          horseName: task.horseName,
                          detail: task.detail,
                          key: task.key,
                        })
                      }
                    >
                      Tạo hồ sơ khám
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const note = window.prompt('Ghi chú ngắn vì sao không cần khám:');
                        if (!note) return;
                        const done = await action.run(() => dismissTask(task.key, note));
                        if (done !== undefined) board.reload();
                      }}
                    >
                      Không cần khám
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {action.error && <ErrorBox message={action.error} />}

      {map.data?.map((zone) => (
        <Card key={zone.zoneId}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>{zone.zoneName}</SectionTitle>
            <Pill tone="gray">
              {zone.occupied}/{zone.capacity} ô đang dùng
            </Pill>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {zone.cells
              .filter((cell) => !filterStatus || cell.healthStatus === filterStatus)
              .map((cell) => (
                <button
                  key={cell.stallId}
                  disabled={!cell.horseId}
                  onClick={() => navigate(`/horses/${cell.horseId}?tab=medical`)}
                  className={`rounded-xl border p-3 text-left transition ${
                    cell.healthStatus
                      ? `${stallBorder[cell.healthStatus]} hover:brightness-95`
                      : 'border-dashed border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-400">{cell.code}</span>
                    {cell.locked && <Lock size={12} className="text-red-500" />}
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-gray-800">{cell.horseName ?? 'Trống'}</p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">
                    {cell.healthStatus ? healthLabel[cell.healthStatus] : '—'}
                  </p>
                </button>
              ))}
          </div>
        </Card>
      ))}

      {createFor && (
        <MedicalRecordModal
          horseId={createFor.horseId}
          horseName={createFor.horseName}
          prefillSymptoms={createFor.detail}
          sourceKey={createFor.key}
          onClose={() => setCreateFor(null)}
          onDone={() => {
            setCreateFor(null);
            board.reload();
          }}
        />
      )}
    </div>
  );
}

/* ===== Biểu mẫu hồ sơ khám ===== */

export function MedicalRecordModal({
  horseId,
  horseName,
  prefillSymptoms,
  sourceKey,
  onClose,
  onDone,
}: {
  horseId: string;
  horseName: string;
  prefillSymptoms?: string;
  sourceKey?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const action = useAction();
  const stalls = useService(() => listIsolationStalls(), []);
  const [form, setForm] = useState({
    examDate: toDateKey(now()),
    reason: 'INCIDENT' as MedicalReason,
    symptoms: prefillSymptoms ?? '',
    diagnosis: '',
    severity: 'MODERATE' as Severity,
    treatmentPlan: '',
    careInstruction: '',
    recheckDate: '',
    noRaceUntil: '',
    cost: '',
    status: 'IN_TREATMENT' as 'IN_TREATMENT' | 'RESOLVED',
    newHealthStatus: '' as HealthStatus | '',
    healthReason: '',
    isolationStallId: '',
  });
  const [prescriptions, setPrescriptions] = useState([{ drug: '', dosage: '', days: 5 }]);

  const fieldError = (field: string) => (action.field === field ? action.error : undefined);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Tạo hồ sơ khám — ${horseName}`}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button
            onClick={async () => {
              const done = await action.run(() =>
                createMedicalRecord({
                  horseId,
                  examDate: form.examDate,
                  reason: form.reason,
                  symptoms: form.symptoms,
                  diagnosis: form.diagnosis,
                  severity: form.severity,
                  treatmentPlan: form.treatmentPlan,
                  prescriptions: prescriptions.filter((item) => item.drug.trim()),
                  careInstruction: form.careInstruction,
                  recheckDate: form.recheckDate || undefined,
                  noRaceUntil: form.noRaceUntil || undefined,
                  cost: form.cost ? Number(form.cost) : undefined,
                  status: form.status,
                  sourceKey,
                  newHealthStatus: form.newHealthStatus || undefined,
                  healthReason: form.healthReason || form.diagnosis,
                  isolationStallId: form.isolationStallId || undefined,
                }),
              );
              if (done) onDone();
            }}
            disabled={action.pending}
          >
            {action.pending ? 'Đang lưu…' : 'Lưu hồ sơ khám'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ngày khám" required error={fieldError('examDate')}>
            <Input
              type="date"
              max={toDateKey(now())}
              value={form.examDate}
              onChange={(event) => setForm({ ...form, examDate: event.target.value })}
            />
          </Field>
          <Field label="Lý do khám" required>
            <Select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value as MedicalReason })}>
              {Object.entries(medicalReasonLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Triệu chứng" required error={fieldError('symptoms')}>
          <Textarea value={form.symptoms} onChange={(event) => setForm({ ...form, symptoms: event.target.value })} />
        </Field>
        <Field label="Chẩn đoán" required error={fieldError('diagnosis')}>
          <Textarea value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mức độ" required>
            <Select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as Severity })}>
              {Object.entries(severityLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trạng thái hồ sơ" required>
            <Select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as 'IN_TREATMENT' | 'RESOLVED' })}
            >
              {Object.entries(medicalStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Hướng điều trị">
          <Textarea value={form.treatmentPlan} onChange={(event) => setForm({ ...form, treatmentPlan: event.target.value })} />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-600">Đơn thuốc</p>
          <div className="space-y-2">
            {prescriptions.map((item, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_90px]">
                <Input
                  placeholder="Tên thuốc"
                  value={item.drug}
                  onChange={(event) =>
                    setPrescriptions(
                      prescriptions.map((row, position) =>
                        position === index ? { ...row, drug: event.target.value } : row,
                      ),
                    )
                  }
                />
                <Input
                  placeholder="Liều và cách dùng"
                  value={item.dosage}
                  onChange={(event) =>
                    setPrescriptions(
                      prescriptions.map((row, position) =>
                        position === index ? { ...row, dosage: event.target.value } : row,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  placeholder="Số ngày"
                  value={item.days}
                  onChange={(event) =>
                    setPrescriptions(
                      prescriptions.map((row, position) =>
                        position === index ? { ...row, days: Number(event.target.value) } : row,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => setPrescriptions([...prescriptions, { drug: '', dosage: '', days: 5 }])}
          >
            <Plus size={14} /> Thêm dòng thuốc
          </Button>
        </div>

        <Field label="Chỉ dẫn cho nhân viên chăm sóc" hint="Nhân viên chăm sóc của ngựa đọc được nội dung này">
          <Textarea
            value={form.careInstruction}
            onChange={(event) => setForm({ ...form, careInstruction: event.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ngày tái khám">
            <Input type="date" value={form.recheckDate} onChange={(event) => setForm({ ...form, recheckDate: event.target.value })} />
          </Field>
          <Field label="Không được đua tới ngày">
            <Input type="date" value={form.noRaceUntil} onChange={(event) => setForm({ ...form, noRaceUntil: event.target.value })} />
          </Field>
          <Field label="Chi phí" hint="Sinh một dòng chi phí loại Y tế">
            <Input type="number" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} />
          </Field>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="mb-3 text-sm font-semibold text-emerald-800">Đổi trạng thái sức khỏe sau khám</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trạng thái mới">
              <Select
                value={form.newHealthStatus}
                onChange={(event) => setForm({ ...form, newHealthStatus: event.target.value as HealthStatus })}
              >
                <option value="">Giữ nguyên trạng thái hiện tại</option>
                {Object.entries(healthLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            {form.newHealthStatus === 'QUARANTINED' && (
              <Field label="Ô cách ly" required error={fieldError('isolationStallId')}>
                <Select
                  value={form.isolationStallId}
                  onChange={(event) => setForm({ ...form, isolationStallId: event.target.value })}
                >
                  <option value="">Chọn ô cách ly còn trống</option>
                  {stalls.data?.map((stall) => (
                    <option key={stall.id} value={stall.id}>
                      {stall.code}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        </div>

        {action.error && !action.field && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Danh sách hồ sơ khám ===== */

export function MedicalRecords() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const currentUser = useStore((state) => state.currentUser);
  const isVet = can(currentUser, 'medical.edit');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [horseId, setHorseId] = useState('');
  const horses = useService(() => listHorses(), []);
  const { data, loading, reload } = useService(() => listMedicalRecords({ status, horseId }), [status, horseId]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedHorse, setSelectedHorse] = useState('');

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Hồ sơ khám bệnh"
        description="Hồ sơ y tế không xóa được. Sửa được trong 24 giờ kể từ lúc tạo, sau đó chỉ thêm ghi chú theo dõi."
        actions={
          isVet ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Tạo hồ sơ khám
            </Button>
          ) : undefined
        }
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Mọi trạng thái hồ sơ</option>
            {Object.entries(medicalStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={horseId} onChange={(event) => setHorseId(event.target.value)}>
            <option value="">Mọi ngựa</option>
            {horses.data?.map((horse) => (
              <option key={horse.id} value={horse.id}>
                {horse.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading && <Skeleton rows={4} />}
      {!loading && (data?.length ?? 0) === 0 && <EmptyState title="Chưa có hồ sơ khám nào khớp bộ lọc" />}

      <div className="space-y-3">
        {data?.map((record) => (
          <Card key={record.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">{record.horseName}</span>
                  <Pill tone={record.status === 'IN_TREATMENT' ? 'amber' : 'green'}>
                    {medicalStatusLabel[record.status]}
                  </Pill>
                  {record.severity && <SeverityPill severity={record.severity} />}
                </p>
                <p className="mt-1 text-sm text-gray-700">{record.diagnosis ?? 'Chi tiết chỉ hiển thị theo quyền'}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {formatDate(record.examDate)} · {medicalReasonLabel[record.reason]} · {record.createdByName}
                  {record.cost !== undefined ? ` · ${formatMoney(record.cost)}` : ''}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/horses/${record.horseId}?tab=medical`)}>
                Mở hồ sơ ngựa
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {createOpen && (
        <Modal
          open
          onClose={() => setCreateOpen(false)}
          title="Chọn ngựa để tạo hồ sơ khám"
          footer={
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Đóng
            </Button>
          }
        >
          <div className="space-y-2">
            {horses.data
              ?.filter((horse) => horse.lifecycleStatus !== 'TRANSFERRED' && !horse.isReference)
              .map((horse) => (
                <button
                  key={horse.id}
                  onClick={() => {
                    setSelectedHorse(horse.id);
                    setCreateOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-gray-50"
                >
                  <Avatar src={horse.avatar} name={horse.name} size={34} />
                  <span className="flex-1 text-sm font-medium text-gray-800">{horse.name}</span>
                  <HealthPill status={horse.healthStatus} />
                </button>
              ))}
          </div>
        </Modal>
      )}

      {selectedHorse && (
        <MedicalRecordModal
          horseId={selectedHorse}
          horseName={horses.data?.find((horse) => horse.id === selectedHorse)?.name ?? ''}
          onClose={() => setSelectedHorse('')}
          onDone={() => {
            setSelectedHorse('');
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ===== F3.5 — Khóa huấn luyện ===== */

export function TrainingLocks() {
  const currentUser = useStore((state) => state.currentUser);
  const isVet = can(currentUser, 'lock.edit');
  const { data, loading, reload } = useService(() => listTrainingLocks(), []);
  const horses = useService(() => listHorses(), []);
  const action = useAction();
  const [placeOpen, setPlaceOpen] = useState(false);
  const [form, setForm] = useState({ horseId: '', reason: '', expectedLiftDate: '' });
  const [liftTarget, setLiftTarget] = useState<string | null>(null);
  const [liftReason, setLiftReason] = useState('');

  const active = (data ?? []).filter((lock) => !lock.liftedAt);
  const history = (data ?? []).filter((lock) => lock.liftedAt);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Khóa huấn luyện"
        description="Khóa độc lập với trạng thái sức khỏe: đổi từ Chấn thương sang Cần theo dõi thì khóa vẫn giữ cho tới khi được gỡ."
        actions={
          isVet ? (
            <Button variant="danger" onClick={() => setPlaceOpen(true)}>
              <Lock size={16} /> Đặt khóa huấn luyện
            </Button>
          ) : undefined
        }
      />

      {action.error && <ErrorBox message={action.error} />}
      {loading && <Skeleton rows={3} />}

      <Card>
        <SectionTitle icon={<Lock size={16} className="text-red-500" />}>
          Khóa đang hiệu lực ({active.length})
        </SectionTitle>
        {active.length === 0 ? (
          <EmptyState title="Không có ngựa nào đang bị khóa huấn luyện" />
        ) : (
          <div className="space-y-3">
            {active.map((lock) => (
              <div key={lock.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-red-100 bg-red-50/50 p-4">
                <Avatar src={lock.horseAvatar} name={lock.horseName} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{lock.horseName}</p>
                  <p className="text-sm text-gray-600">{lock.reason}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Đặt {formatDate(lock.placedAt)} bởi {lock.placedByName}
                    {lock.expectedLiftDate ? ` · dự kiến gỡ ${formatDate(lock.expectedLiftDate)}` : ''}
                  </p>
                </div>
                {isVet && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setLiftTarget(lock.id);
                      setLiftReason('');
                    }}
                  >
                    <Unlock size={14} /> Gỡ khóa
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {history.length > 0 && (
        <Card>
          <SectionTitle>Lịch sử khóa đã gỡ</SectionTitle>
          <div className="space-y-1">
            {history.map((lock) => (
              <div key={lock.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{lock.horseName}</p>
                  <p className="text-xs text-gray-400">
                    {lock.reason} → gỡ {formatDate(lock.liftedAt)} bởi {lock.liftedByName}: {lock.liftReason}
                  </p>
                </div>
                <Pill tone="gray">Đã gỡ</Pill>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={placeOpen}
        onClose={() => setPlaceOpen(false)}
        title="Đặt khóa huấn luyện"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlaceOpen(false)}>
              Quay lại
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const done = await action.run(() => placeTrainingLock(form));
                if (done !== undefined) {
                  setPlaceOpen(false);
                  setForm({ horseId: '', reason: '', expectedLiftDate: '' });
                  reload();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang xử lý…' : 'Đặt khóa'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Ngựa" required>
            <Select value={form.horseId} onChange={(event) => setForm({ ...form, horseId: event.target.value })}>
              <option value="">Chọn ngựa</option>
              {horses.data
                ?.filter((horse) => horse.lifecycleStatus === 'ACTIVE' && !horse.isReference && !horse.locked)
                .map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    {horse.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Lý do" required error={action.field === 'reason' ? action.error : undefined}>
            <Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
          </Field>
          <Field label="Ngày dự kiến gỡ khóa">
            <Input
              type="date"
              value={form.expectedLiftDate}
              onChange={(event) => setForm({ ...form, expectedLiftDate: event.target.value })}
            />
          </Field>
          <ul className="space-y-1.5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <li>Buổi tập đã lên lịch bị hủy với nhóm lý do Chặn y tế.</li>
            <li>Buổi đang diễn ra bị dừng khẩn ngay lập tức.</li>
            <li>Ngựa không được đua, đăng ký chưa diễn ra bị hủy.</li>
          </ul>
          {action.error && !action.field && <ErrorBox message={action.error} />}
        </div>
      </Modal>

      <Modal
        open={liftTarget !== null}
        onClose={() => setLiftTarget(null)}
        title="Gỡ khóa huấn luyện"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLiftTarget(null)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() => liftTrainingLock(liftTarget!, liftReason));
                if (done !== undefined) {
                  setLiftTarget(null);
                  reload();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang gỡ…' : 'Gỡ khóa'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Buổi tập đã hủy không tự khôi phục. Huấn luyện viên khu sẽ nhận thông báo để sinh lại lịch.
          </p>
          <Field label="Lý do gỡ khóa" required error={action.field === 'reason' ? action.error : undefined}>
            <Textarea value={liftReason} onChange={(event) => setLiftReason(event.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ===== F3.6 — Lịch chăm sóc định kỳ ===== */

export function CareSchedules() {
  const currentUser = useStore((state) => state.currentUser);
  const isVet = can(currentUser, 'care.edit');
  const canMarkFarrier = can(currentUser, 'care.done.farrier');
  const [type, setType] = useState('');
  const { data, loading, reload } = useService(() => listCareSchedules({ type }), [type]);
  const horses = useService(() => listHorses(), []);
  const action = useAction();

  const [defaultOpen, setDefaultOpen] = useState(false);
  const [selectedHorses, setSelectedHorses] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    horseId: '',
    type: 'VACCINE' as CareScheduleType,
    name: '',
    dueDate: '',
    intervalDays: careInterval.VACCINE,
  });
  const [doneTarget, setDoneTarget] = useState<string | null>(null);
  const [doneForm, setDoneForm] = useState({ doneDate: toDateKey(now()), note: '', cost: '' });

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Lịch chăm sóc định kỳ"
        description="Tiêm phòng 180 ngày, tẩy giun 90 ngày, kiểm tra móng 42 ngày. Hệ thống nhắc trước hạn 7 ngày và khi quá hạn."
        actions={
          isVet ? (
            <>
              <Button variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus size={16} /> Thêm mục
              </Button>
              <Button onClick={() => setDefaultOpen(true)}>
                <Syringe size={16} /> Tạo lịch mặc định
              </Button>
            </>
          ) : undefined
        }
      />

      {action.error && <ErrorBox message={action.error} />}

      <Card>
        <Select value={type} onChange={(event) => setType(event.target.value)} className="sm:w-64">
          <option value="">Mọi loại</option>
          {Object.entries(careTypeLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Card>

      {loading && <Skeleton rows={5} />}
      {!loading && (data?.length ?? 0) === 0 && <EmptyState title="Chưa có mục lịch chăm sóc nào" />}

      <div className="space-y-2">
        {data?.map((item) => (
          <Card
            key={item.id}
            tone={item.overdue ? 'danger' : item.dueSoon ? 'warning' : 'default'}
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                  {item.horseName}
                  <span className="font-normal text-gray-500">· {careTypeLabel[item.type]}</span>
                  {item.name && <span className="font-normal text-gray-400">— {item.name}</span>}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {item.doneAt
                    ? `Đã làm ${formatDate(item.doneAt)} bởi ${item.doneByName}${item.cost ? ` · ${formatMoney(item.cost)}` : ''}`
                    : `Đến hạn ${formatDate(item.dueDate)} · chu kỳ ${item.intervalDays} ngày`}
                </p>
              </div>
              {item.doneAt ? (
                <Pill tone="green">Đã làm</Pill>
              ) : item.overdue ? (
                <Pill tone="red">Quá hạn</Pill>
              ) : item.dueSoon ? (
                <Pill tone="amber">Sắp đến hạn</Pill>
              ) : (
                <Pill tone="gray">Chưa tới hạn</Pill>
              )}
              {!item.doneAt && (isVet || (canMarkFarrier && item.type === 'FARRIER')) && (
                <Button
                  size="sm"
                  onClick={() => {
                    setDoneTarget(item.id);
                    setDoneForm({ doneDate: toDateKey(now()), note: '', cost: '' });
                  }}
                >
                  Đã làm
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={defaultOpen}
        onClose={() => setDefaultOpen(false)}
        title="Tạo lịch chăm sóc mặc định"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDefaultOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const created = await action.run(() => createDefaultCareSchedules(selectedHorses));
                if (created !== undefined) {
                  setDefaultOpen(false);
                  setSelectedHorses([]);
                  reload();
                }
              }}
              disabled={action.pending || selectedHorses.length === 0}
            >
              {action.pending ? 'Đang tạo…' : `Tạo cho ${selectedHorses.length} ngựa`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
            Tạo cùng lúc ba loại lịch với chu kỳ mặc định cho các ngựa được chọn. Mục nào đã có sẽ được bỏ qua.
          </p>
          <div className="max-h-72 space-y-1 overflow-y-auto custom-scrollbar">
            {horses.data
              ?.filter((horse) => !horse.isReference && horse.lifecycleStatus !== 'TRANSFERRED')
              .map((horse) => (
                <label key={horse.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-2.5 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedHorses.includes(horse.id)}
                    onChange={(event) =>
                      setSelectedHorses(
                        event.target.checked
                          ? [...selectedHorses, horse.id]
                          : selectedHorses.filter((id) => id !== horse.id),
                      )
                    }
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  <Avatar src={horse.avatar} name={horse.name} size={30} />
                  <span className="text-sm font-medium text-gray-700">{horse.name}</span>
                </label>
              ))}
          </div>
        </div>
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Thêm mục lịch chăm sóc"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() => createCareSchedule(addForm));
                if (done !== undefined) {
                  setAddOpen(false);
                  reload();
                }
              }}
              disabled={action.pending}
            >
              Lưu
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Ngựa" required>
            <Select value={addForm.horseId} onChange={(event) => setAddForm({ ...addForm, horseId: event.target.value })}>
              <option value="">Chọn ngựa</option>
              {horses.data
                ?.filter((horse) => !horse.isReference)
                .map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    {horse.name}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Loại" required>
              <Select
                value={addForm.type}
                onChange={(event) =>
                  setAddForm({
                    ...addForm,
                    type: event.target.value as CareScheduleType,
                    intervalDays: careInterval[event.target.value as CareScheduleType],
                  })
                }
              >
                {Object.entries(careTypeLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Chu kỳ (ngày)" required>
              <Input
                type="number"
                value={addForm.intervalDays}
                onChange={(event) => setAddForm({ ...addForm, intervalDays: Number(event.target.value) })}
              />
            </Field>
          </div>
          <Field label="Tên cụ thể" hint="Ví dụ tên vắc-xin">
            <Input value={addForm.name} onChange={(event) => setAddForm({ ...addForm, name: event.target.value })} />
          </Field>
          <Field label="Ngày đến hạn" required error={action.field === 'dueDate' ? action.error : undefined}>
            <Input type="date" value={addForm.dueDate} onChange={(event) => setAddForm({ ...addForm, dueDate: event.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={doneTarget !== null}
        onClose={() => setDoneTarget(null)}
        title="Đánh dấu đã làm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDoneTarget(null)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() =>
                  markCareDone(doneTarget!, {
                    doneDate: doneForm.doneDate,
                    note: doneForm.note,
                    cost: doneForm.cost ? Number(doneForm.cost) : undefined,
                  }),
                );
                if (done !== undefined) {
                  setDoneTarget(null);
                  reload();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang lưu…' : 'Xác nhận'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            Sau khi đánh dấu, hệ thống tự tạo mục kế tiếp với ngày đến hạn bằng ngày thực hiện cộng chu kỳ.
          </p>
          <Field label="Ngày thực hiện" required error={action.field === 'doneDate' ? action.error : undefined}>
            <Input
              type="date"
              max={toDateKey(now())}
              value={doneForm.doneDate}
              onChange={(event) => setDoneForm({ ...doneForm, doneDate: event.target.value })}
            />
          </Field>
          <Field label="Ghi chú">
            <Textarea value={doneForm.note} onChange={(event) => setDoneForm({ ...doneForm, note: event.target.value })} />
          </Field>
          <Field label="Chi phí" hint="Sinh một dòng chi phí loại Y tế cho ngựa">
            <Input type="number" value={doneForm.cost} onChange={(event) => setDoneForm({ ...doneForm, cost: event.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ===== Nhịp tim tối đa toàn đàn ===== */

export function MaxHeartRateList() {
  const navigate = useNavigate();
  const { data, loading } = useService(() => listHorses(), []);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Nhịp tim tối đa"
        description="Ngưỡng dùng cho cảnh báo khi ngựa đang tập. Giá trị mặc định của câu lạc bộ là 230 nhịp/phút."
      />
      {loading && <Skeleton rows={4} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {data
          ?.filter((horse) => !horse.isReference && horse.lifecycleStatus !== 'TRANSFERRED')
          .map((horse) => (
            <button key={horse.id} onClick={() => navigate(`/horses/${horse.id}?tab=training`)} className="text-left">
              <Card className="transition hover:border-emerald-100">
                <div className="flex items-center gap-3">
                  <Avatar src={horse.avatar} name={horse.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{horse.name}</p>
                    <p className="text-xs text-gray-400">
                      {horse.age ? `${horse.age} tuổi` : '—'} · {horse.zoneName ?? 'chưa xếp chuồng'}
                    </p>
                  </div>
                  <Stethoscope size={18} className="text-gray-300" />
                </div>
              </Card>
            </button>
          ))}
      </div>
    </div>
  );
}
