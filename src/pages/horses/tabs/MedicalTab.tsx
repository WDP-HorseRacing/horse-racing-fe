import { useState } from 'react';
import { Activity, HeartPulse, Lock, Plus, Stethoscope, Syringe, Unlock } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import {
  addFollowUp,
  addInjuryUpdate,
  changeHealthStatus,
  createInjuryMark,
  getHealthTimeline,
  listCareSchedules,
  listInjuryMarks,
  listIsolationStalls,
  listMedicalRecords,
  listTrainingLocks,
  liftTrainingLock,
  placeTrainingLock,
  resolveInjuryMark,
  resolveMedicalRecord,
} from '../../../services/medical.service';
import { useStore } from '../../../store/store';
import { can } from '../../../auth/permissions';
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  Pill,
  SectionTitle,
  Select,
  Skeleton,
  Textarea,
} from '../../../components/ui';
import { HealthPill, SeverityPill } from '../../../components/ui/status';
import { HorseBodyMap, isLimbRegion, BODY_REGIONS } from '../../../components/HorseBodyMap';
import {
  bodyRegionLabel,
  careTypeLabel,
  healthLabel,
  medicalReasonLabel,
  medicalStatusLabel,
  severityLabel,
  sideLabel,
} from '../../../lib/labels';
import { formatDate, formatMoney, toDateKey } from '../../../lib/format';
import { now } from '../../../lib/clock';
import type { BodyRegion, BodySide, HealthStatus, Severity } from '../../../types/domain';

export default function MedicalTab({
  horseId,
  horseName,
  onChanged,
}: {
  horseId: string;
  horseName: string;
  onChanged: () => void;
}) {
  const currentUser = useStore((state) => state.currentUser);
  const isVet = can(currentUser, 'medical.edit');
  const isGroom = currentUser?.role === 'GROOM';

  const records = useService(() => listMedicalRecords({ horseId }), [horseId]);
  const marks = useService(() => listInjuryMarks(horseId), [horseId]);
  const locks = useService(() => listTrainingLocks(), []);
  const timeline = useService(() => getHealthTimeline(horseId), [horseId]);
  const care = useService(() => listCareSchedules({ horseId }), [horseId]);
  const stalls = useService(() => listIsolationStalls(), []);
  const action = useAction();

  const [statusOpen, setStatusOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [updateMarkId, setUpdateMarkId] = useState<string | null>(null);
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const [side, setSide] = useState<BodySide>('LEFT');

  const [statusForm, setStatusForm] = useState({ to: 'UNDER_OBSERVATION' as HealthStatus, reason: '', stallId: '' });
  const [lockForm, setLockForm] = useState({ reason: '', expectedLiftDate: '' });
  const [markForm, setMarkForm] = useState({
    region: '' as BodyRegion | '',
    description: '',
    severity: 'MODERATE' as Severity,
    detectedAt: toDateKey(now()),
  });
  const [updateForm, setUpdateForm] = useState({ severity: 'MILD' as Severity, note: '', date: toDateKey(now()) });
  const [followUpForm, setFollowUpForm] = useState({ note: '', cost: '', date: toDateKey(now()) });

  const horseLock = (locks.data ?? []).find((lock) => lock.horseId === horseId && !lock.liftedAt);
  const refreshAll = () => {
    records.reload();
    marks.reload();
    locks.reload();
    timeline.reload();
    onChanged();
  };

  if (records.loading) return <Skeleton rows={4} />;

  return (
    <div className="space-y-5">
      {isVet && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setStatusOpen(true)}>
            <HeartPulse size={14} /> Đổi trạng thái sức khỏe
          </Button>
          {horseLock ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const reason = window.prompt('Lý do gỡ khóa huấn luyện:');
                if (!reason) return;
                const done = await action.run(() => liftTrainingLock(horseLock.id, reason));
                if (done !== undefined) refreshAll();
              }}
            >
              <Unlock size={14} /> Gỡ khóa huấn luyện
            </Button>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setLockOpen(true)}>
              <Lock size={14} /> Đặt khóa huấn luyện
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setMarkOpen(true)}>
            <Plus size={14} /> Đánh dấu chấn thương
          </Button>
        </div>
      )}

      {action.error && <ErrorBox message={action.error} />}

      {/* Hồ sơ khám */}
      <Card>
        <SectionTitle icon={<Stethoscope size={16} className="text-emerald-600" />}>Hồ sơ khám bệnh</SectionTitle>
        {(records.data?.length ?? 0) === 0 ? (
          <EmptyState title="Chưa có hồ sơ khám nào" />
        ) : (
          <div className="space-y-3">
            {records.data?.map((record) => (
              <div key={record.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{formatDate(record.examDate)}</span>
                    <Pill tone="gray">{medicalReasonLabel[record.reason]}</Pill>
                    <Pill tone={record.status === 'IN_TREATMENT' ? 'amber' : 'green'}>
                      {medicalStatusLabel[record.status]}
                    </Pill>
                    {record.severity && <SeverityPill severity={record.severity} />}
                  </div>
                  <span className="text-xs text-gray-400">{record.createdByName}</span>
                </div>

                {record.restricted ? (
                  <p className="mt-3 rounded-lg bg-white p-3 text-sm text-gray-500">
                    Chi tiết y tế chỉ hiển thị cho bác sĩ, quản lý, chủ ngựa và huấn luyện viên của khu.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      <span className="text-gray-400">Chẩn đoán: </span>
                      <span className="font-medium text-gray-800">{record.diagnosis}</span>
                    </p>
                    <p className="text-gray-600">
                      <span className="text-gray-400">Triệu chứng: </span>
                      {record.symptoms}
                    </p>
                    {record.treatmentPlan && (
                      <p className="text-gray-600">
                        <span className="text-gray-400">Hướng điều trị: </span>
                        {record.treatmentPlan}
                      </p>
                    )}
                    {(record.prescriptions?.length ?? 0) > 0 && (
                      <div className="rounded-lg bg-white p-3">
                        <p className="mb-1.5 text-xs font-semibold text-gray-400">Đơn thuốc</p>
                        {record.prescriptions?.map((item, index) => (
                          <p key={index} className="text-sm text-gray-700">
                            {item.drug} — {item.dosage} × {item.days} ngày
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {record.careInstruction && (
                  <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                    <p className="mb-0.5 text-xs font-semibold text-emerald-600">Chỉ dẫn cho nhân viên chăm sóc</p>
                    {record.careInstruction}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
                  {record.recheckDate && <span>Tái khám: {formatDate(record.recheckDate)}</span>}
                  {record.noRaceUntil && <span>Không được đua tới: {formatDate(record.noRaceUntil)}</span>}
                  {record.cost !== undefined && <span>Chi phí: {formatMoney(record.cost)}</span>}
                </div>

                {record.followUps.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-gray-200/60 pt-3">
                    <p className="text-xs font-semibold text-gray-400">Ghi chú theo dõi</p>
                    {record.followUps.map((item) => (
                      <p key={item.id} className="text-sm text-gray-600">
                        <span className="text-gray-400">{formatDate(item.date)} · </span>
                        {item.note}
                        {item.cost ? <span className="text-gray-400"> · {formatMoney(item.cost)}</span> : null}
                      </p>
                    ))}
                  </div>
                )}

                {isVet && record.status === 'IN_TREATMENT' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setFollowUpId(record.id)}>
                      Thêm ghi chú theo dõi
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const done = await action.run(() => resolveMedicalRecord(record.id));
                        if (done !== undefined) refreshAll();
                      }}
                    >
                      Đánh dấu đã khỏi
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Bản đồ chấn thương */}
      {!isGroom && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle icon={<Activity size={16} className="text-emerald-600" />}>Bản đồ chấn thương</SectionTitle>
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 text-xs font-semibold">
              {(['LEFT', 'RIGHT'] as BodySide[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setSide(value)}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    side === value ? 'bg-emerald-600 text-white' : 'text-gray-400'
                  }`}
                >
                  Bên {sideLabel[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <HorseBodyMap
              marks={(marks.data ?? []).map((mark) => ({
                id: mark.id,
                region: mark.region,
                side: mark.side,
                severity: mark.severity,
                resolved: !!mark.resolvedAt,
              }))}
              side={side}
              readOnly
            />

            <div className="space-y-2">
              {(marks.data?.length ?? 0) === 0 && (
                <EmptyState title="Chưa đánh dấu chấn thương nào" />
              )}
              {marks.data?.map((mark) => (
                <div key={mark.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {bodyRegionLabel[mark.region]}
                      {mark.side && isLimbRegion(mark.region) ? ` ${sideLabel[mark.side]}` : ''}
                    </span>
                    {mark.resolvedAt ? <Pill tone="gray">Đã hồi phục</Pill> : <SeverityPill severity={mark.severity} />}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{mark.description}</p>
                  <p className="mt-1 text-xs text-gray-400">Phát hiện {formatDate(mark.detectedAt)}</p>

                  {mark.updates.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-gray-200/60 pt-2">
                      {mark.updates.map((update) => (
                        <p key={update.id} className="text-xs text-gray-500">
                          {formatDate(update.date)} · {severityLabel[update.severity]} — {update.note}
                        </p>
                      ))}
                    </div>
                  )}

                  {isVet && !mark.resolvedAt && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setUpdateMarkId(mark.id)}>
                        Thêm cập nhật
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const done = await action.run(() => resolveInjuryMark(mark.id));
                          if (done !== undefined) refreshAll();
                        }}
                      >
                        Đã hồi phục
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Lịch chăm sóc định kỳ */}
      <Card>
        <SectionTitle icon={<Syringe size={16} className="text-emerald-600" />}>Lịch chăm sóc định kỳ</SectionTitle>
        {(care.data?.length ?? 0) === 0 ? (
          <EmptyState title="Chưa có lịch chăm sóc" />
        ) : (
          <div className="space-y-1">
            {care.data?.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {careTypeLabel[item.type]}
                    {item.name ? ` — ${item.name}` : ''}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.doneAt ? `Đã làm ${formatDate(item.doneAt)}` : `Đến hạn ${formatDate(item.dueDate)}`}
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
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Dòng thời gian trạng thái */}
      <Card>
        <SectionTitle>Dòng thời gian trạng thái sức khỏe</SectionTitle>
        {(timeline.data?.length ?? 0) === 0 ? (
          <EmptyState title="Chưa có thay đổi trạng thái nào" />
        ) : (
          <div className="space-y-0">
            {timeline.data?.map((item, index) => (
              <div key={item.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-emerald-600" />
                  {index < (timeline.data?.length ?? 0) - 1 && <div className="min-h-12 w-px flex-1 bg-emerald-100" />}
                </div>
                <div className="pb-5">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <HealthPill status={item.fromStatus} />
                    <span className="text-gray-400">→</span>
                    <HealthPill status={item.toStatus} />
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{item.reason}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatDate(item.changedAt)} · {item.changedByName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Đổi trạng thái sức khỏe */}
      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title={`Đổi trạng thái sức khỏe — ${horseName}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const cancelled = await action.run(() =>
                  changeHealthStatus({
                    horseId,
                    to: statusForm.to,
                    reason: statusForm.reason,
                    isolationStallId: statusForm.stallId || undefined,
                  }),
                );
                if (cancelled !== undefined) {
                  setStatusOpen(false);
                  setStatusForm({ ...statusForm, reason: '' });
                  refreshAll();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang lưu…' : 'Lưu trạng thái'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Trạng thái mới" required>
            <Select
              value={statusForm.to}
              onChange={(event) => setStatusForm({ ...statusForm, to: event.target.value as HealthStatus })}
            >
              {Object.entries(healthLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          {statusForm.to === 'QUARANTINED' && (
            <Field
              label="Ô cách ly"
              required
              hint="Ngựa cách ly bắt buộc phải ở ô loại cách ly. Hệ thống chuyển chuồng cùng lúc với đổi trạng thái."
              error={action.field === 'isolationStallId' ? action.error : undefined}
            >
              <Select value={statusForm.stallId} onChange={(event) => setStatusForm({ ...statusForm, stallId: event.target.value })}>
                <option value="">Chọn ô cách ly còn trống</option>
                {stalls.data?.map((stall) => (
                  <option key={stall.id} value={stall.id}>
                    {stall.code}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Lý do" required error={action.field === 'reason' ? action.error : undefined}>
            <Textarea
              value={statusForm.reason}
              onChange={(event) => setStatusForm({ ...statusForm, reason: event.target.value })}
            />
          </Field>

          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Buổi tập đã lên lịch vượt mức cho phép mới sẽ bị hủy với nhóm lý do <strong>Chặn y tế</strong>. Huấn luyện
            viên khu và nhân viên chăm sóc được báo ngay.
          </div>
          {action.error && !action.field && <ErrorBox message={action.error} />}
        </div>
      </Modal>

      {/* Đặt khóa huấn luyện */}
      <Modal
        open={lockOpen}
        onClose={() => setLockOpen(false)}
        title={`Đặt khóa huấn luyện — ${horseName}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLockOpen(false)}>
              Quay lại
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const cancelled = await action.run(() => placeTrainingLock({ horseId, ...lockForm }));
                if (cancelled !== undefined) {
                  setLockOpen(false);
                  setLockForm({ reason: '', expectedLiftDate: '' });
                  refreshAll();
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
          <Field label="Lý do khóa" required error={action.field === 'reason' ? action.error : undefined}>
            <Textarea value={lockForm.reason} onChange={(event) => setLockForm({ ...lockForm, reason: event.target.value })} />
          </Field>
          <Field label="Ngày dự kiến gỡ khóa">
            <Input
              type="date"
              value={lockForm.expectedLiftDate}
              onChange={(event) => setLockForm({ ...lockForm, expectedLiftDate: event.target.value })}
            />
          </Field>
          <ul className="space-y-1.5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <li>Buổi tập đã lên lịch bị hủy với nhóm lý do Chặn y tế.</li>
            <li>Buổi đang diễn ra bị dừng khẩn ngay lập tức.</li>
            <li>Không sinh và không thêm được buổi tập mới cho tới khi gỡ khóa.</li>
            <li>Ngựa không được đua, đăng ký thi đấu chưa diễn ra bị hủy.</li>
            <li>Khóa không hủy giáo án — gỡ khóa xong huấn luyện viên sinh lại lịch.</li>
          </ul>
          {action.error && !action.field && <ErrorBox message={action.error} />}
        </div>
      </Modal>

      {/* Đánh dấu chấn thương */}
      <Modal
        open={markOpen}
        onClose={() => setMarkOpen(false)}
        title="Đánh dấu chấn thương"
        width="max-w-3xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMarkOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                if (!markForm.region) return;
                const done = await action.run(() =>
                  createInjuryMark({
                    horseId,
                    region: markForm.region as BodyRegion,
                    side: isLimbRegion(markForm.region as BodyRegion) ? side : undefined,
                    description: markForm.description,
                    severity: markForm.severity,
                    detectedAt: markForm.detectedAt,
                  }),
                );
                if (done) {
                  setMarkOpen(false);
                  setMarkForm({ ...markForm, region: '', description: '' });
                  refreshAll();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang lưu…' : 'Lưu điểm đánh dấu'}
            </Button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-gray-500">Bấm vào vùng bị thương trên mô hình.</p>
            <HorseBodyMap
              marks={(marks.data ?? []).map((mark) => ({
                id: mark.id,
                region: mark.region,
                side: mark.side,
                severity: mark.severity,
                resolved: !!mark.resolvedAt,
              }))}
              selected={markForm.region || undefined}
              side={side}
              onSelect={(region) => setMarkForm({ ...markForm, region })}
            />
          </div>
          <div className="space-y-4">
            <Field label="Vùng cơ thể" required error={action.field === 'region' ? action.error : undefined}>
              <Select
                value={markForm.region}
                onChange={(event) => setMarkForm({ ...markForm, region: event.target.value as BodyRegion })}
              >
                <option value="">Chọn trên mô hình hoặc tại đây</option>
                {BODY_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {bodyRegionLabel[region]}
                  </option>
                ))}
              </Select>
            </Field>
            {markForm.region && isLimbRegion(markForm.region as BodyRegion) && (
              <Field label="Bên">
                <Select value={side} onChange={(event) => setSide(event.target.value as BodySide)}>
                  <option value="LEFT">Bên trái</option>
                  <option value="RIGHT">Bên phải</option>
                </Select>
              </Field>
            )}
            <Field label="Mức độ" required>
              <Select
                value={markForm.severity}
                onChange={(event) => setMarkForm({ ...markForm, severity: event.target.value as Severity })}
              >
                {Object.entries(severityLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ngày phát hiện" required>
              <Input
                type="date"
                value={markForm.detectedAt}
                onChange={(event) => setMarkForm({ ...markForm, detectedAt: event.target.value })}
              />
            </Field>
            <Field label="Mô tả" required error={action.field === 'description' ? action.error : undefined}>
              <Textarea
                value={markForm.description}
                onChange={(event) => setMarkForm({ ...markForm, description: event.target.value })}
              />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Cập nhật diễn biến */}
      <Modal
        open={updateMarkId !== null}
        onClose={() => setUpdateMarkId(null)}
        title="Thêm cập nhật phục hồi"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUpdateMarkId(null)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() => addInjuryUpdate(updateMarkId!, updateForm));
                if (done !== undefined) {
                  setUpdateMarkId(null);
                  setUpdateForm({ ...updateForm, note: '' });
                  refreshAll();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Ngày" required>
            <Input type="date" value={updateForm.date} onChange={(event) => setUpdateForm({ ...updateForm, date: event.target.value })} />
          </Field>
          <Field label="Mức độ hiện tại" required>
            <Select
              value={updateForm.severity}
              onChange={(event) => setUpdateForm({ ...updateForm, severity: event.target.value as Severity })}
            >
              {Object.entries(severityLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú" required error={action.field === 'note' ? action.error : undefined}>
            <Textarea value={updateForm.note} onChange={(event) => setUpdateForm({ ...updateForm, note: event.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* Ghi chú theo dõi */}
      <Modal
        open={followUpId !== null}
        onClose={() => setFollowUpId(null)}
        title="Thêm ghi chú theo dõi"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFollowUpId(null)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() =>
                  addFollowUp(followUpId!, {
                    date: followUpForm.date,
                    note: followUpForm.note,
                    cost: followUpForm.cost ? Number(followUpForm.cost) : undefined,
                  }),
                );
                if (done !== undefined) {
                  setFollowUpId(null);
                  setFollowUpForm({ note: '', cost: '', date: toDateKey(now()) });
                  refreshAll();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Ngày" required>
            <Input
              type="date"
              value={followUpForm.date}
              onChange={(event) => setFollowUpForm({ ...followUpForm, date: event.target.value })}
            />
          </Field>
          <Field label="Nội dung theo dõi" required error={action.field === 'note' ? action.error : undefined}>
            <Textarea value={followUpForm.note} onChange={(event) => setFollowUpForm({ ...followUpForm, note: event.target.value })} />
          </Field>
          <Field label="Chi phí (không bắt buộc)" hint="Số tiền nhập ở đây sinh một dòng chi phí loại Y tế cho ngựa">
            <Input
              type="number"
              value={followUpForm.cost}
              onChange={(event) => setFollowUpForm({ ...followUpForm, cost: event.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
