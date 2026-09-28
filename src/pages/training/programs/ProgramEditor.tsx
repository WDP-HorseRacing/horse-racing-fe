import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Info, Plus, Save, Trash2, X } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import {
  createProgram,
  getProgram,
  listSubjectOptions,
  PROGRAM_LIMITS,
  programWarnings,
  summarizeProgram,
  updateProgram,
  validateProgramDraft,
  type SubjectOption,
} from '../../../services/training.service';
import {
  Button,
  Card,
  cn,
  ErrorBox,
  Field,
  Input,
  NotFound,
  Notice,
  PageHeader,
  SectionTitle,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '../../../components/ui';
import { IntensityPill, intensityDot } from '../../../components/ui/status';
import { intensityLabel, surfaceLabel, workoutLabel } from '../../../lib/labels';
import { links } from '../../../lib/links';
import type { ProgramPhase } from '../../../types/domain';
import { useStore } from '../../../store/store';
import { can } from '../../../auth/permissions';
import { PhaseTimeline } from '../setup-components/PhaseTimeline';
import { Stepper } from '../setup-components/Stepper';
import { phaseTone, volumeLabel, workoutLine } from '../setup-components/helpers';

interface ItemDraft {
  key: number;
  subjectId: string;
  sessionsPerWeek: number;
}

interface PhaseDraft {
  key: number;
  name: string;
  weeks: number;
  items: ItemDraft[];
}

let keySeed = 0;
const nextKey = () => (keySeed += 1);

function toDraftPhases(phases: ProgramPhase[]): PhaseDraft[] {
  return phases.map((phase) => ({
    key: nextKey(),
    name: phase.name,
    weeks: phase.weeks,
    items: phase.items.map((item) => ({ key: nextKey(), subjectId: item.subjectId, sessionsPerWeek: item.sessionsPerWeek })),
  }));
}

function toPhases(drafts: PhaseDraft[]): ProgramPhase[] {
  return drafts.map((phase) => ({
    name: phase.name,
    weeks: phase.weeks,
    items: phase.items.map((item) => ({ subjectId: item.subjectId, sessionsPerWeek: item.sessionsPerWeek })),
  }));
}

export default function ProgramEditor() {
  const { id } = useParams();
  const editing = !!id;
  const currentUser = useStore((state) => state.currentUser);
  const subjects = useService(() => listSubjectOptions(), []);
  const existing = useService(() => (id ? getProgram(id) : Promise.resolve(undefined)), [id]);

  if (subjects.loading || existing.loading) return <Skeleton rows={8} />;
  if (existing.error) return <NotFound message={existing.error} />;
  if (subjects.error) return <ErrorBox message={subjects.error} />;
  if ((editing && existing.data && !existing.data.canManage) || !can(currentUser, 'program.manage')) {
    return <NotFound message="Bạn chỉ có quyền xem giáo án. Soạn và sửa giáo án là việc của huấn luyện viên trưởng." />;
  }
  return (
    <EditorForm
      key={id ?? 'new'}
      programId={id}
      subjects={subjects.data ?? []}
      initial={
        existing.data
          ? { name: existing.data.name, description: existing.data.description ?? '', phases: existing.data.draft.phases }
          : undefined
      }
      openClassCount={existing.data?.openClassCount ?? 0}
    />
  );
}

function EditorForm({
  programId,
  subjects,
  initial,
  openClassCount,
}: {
  programId?: string;
  subjects: SubjectOption[];
  initial?: { name: string; description: string; phases: ProgramPhase[] };
  openClassCount: number;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const action = useAction();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [phases, setPhases] = useState<PhaseDraft[]>(() =>
    initial
      ? toDraftPhases(initial.phases)
      : [{ key: nextKey(), name: 'Nền tảng', weeks: 2, items: [{ key: nextKey(), subjectId: '', sessionsPerWeek: 2 }] }],
  );
  const [touched, setTouched] = useState(false);
  const lastPhaseRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const draftPhases = toPhases(phases);
  const draft = { name, description, phases: draftPhases };
  const summary = summarizeProgram(draftPhases, subjects);
  const warnings = programWarnings(draft, subjects);
  const issues = validateProgramDraft(draft, subjects);
  const blocking = issues.length > 0;

  const updatePhase = (key: number, patch: Partial<PhaseDraft>) =>
    setPhases((current) => current.map((phase) => (phase.key === key ? { ...phase, ...patch } : phase)));
  const updateItem = (phaseKey: number, itemKey: number, patch: Partial<ItemDraft>) =>
    setPhases((current) =>
      current.map((phase) =>
        phase.key === phaseKey
          ? { ...phase, items: phase.items.map((item) => (item.key === itemKey ? { ...item, ...patch } : item)) }
          : phase,
      ),
    );
  const movePhase = (index: number, delta: number) =>
    setPhases((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const submit = async () => {
    setTouched(true);
    if (blocking) return;
    const input = { name, description, phases: draftPhases };
    const saved = await action.run(() => (programId ? updateProgram(programId, input) : createProgram(input)));
    if (saved) {
      toast.push(programId ? 'Đã lưu giáo án' : 'Đã tạo giáo án', 'success');
      navigate(links.program(saved));
    }
  };

  const phaseIssues = (index: number) => (touched ? issues.filter((issue) => issue.field === `phase-${index}`) : []);

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <Link
            to={programId ? links.program(programId) : links.programs}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 transition hover:text-gray-700"
          >
            <ArrowLeft size={15} /> {programId ? 'Về giáo án' : 'Danh sách giáo án'}
          </Link>
        }
        title={programId ? `Sửa giáo án "${initial?.name}"` : 'Soạn giáo án mới'}
        description="Giáo án là khuôn mẫu không ngày, không gắn ngựa. Xếp môn học vào từng giai đoạn kèm số buổi mỗi tuần; ngày cụ thể chỉ sinh ra khi mở lớp."
        actions={
          <Button onClick={submit} disabled={action.pending || (touched && blocking)}>
            <Save size={16} /> {action.pending ? 'Đang lưu…' : programId ? 'Lưu giáo án' : 'Tạo giáo án'}
          </Button>
        }
      />

      {action.error && <ErrorBox message={action.error} />}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7 xl:col-span-8">
          <Card>
            <div className="grid gap-4 xl:grid-cols-5">
              <Field
                label="Tên giáo án"
                required
                className="xl:col-span-2"
                error={touched ? issues.find((issue) => issue.field === 'name')?.message : undefined}
              >
                <Input value={name} maxLength={80} placeholder="Ví dụ: Tăng tốc 1600 m" onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Mô tả" className="xl:col-span-3">
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Mục tiêu, đối tượng ngựa phù hợp…"
                  className="min-h-[46px]"
                  rows={2}
                />
              </Field>
            </div>
          </Card>

          {phases.map((phase, index) => {
            const phaseSummary = summary.phases[index];
            const perWeek = phase.items.reduce((sum, item) => sum + (item.sessionsPerWeek || 0), 0);
            const errors = phaseIssues(index);
            return (
              <div key={phase.key} ref={index === phases.length - 1 ? lastPhaseRef : undefined}>
                <Card className={cn('relative overflow-hidden', errors.length > 0 && 'ring-red-200')}>
                  <span className={cn('absolute inset-y-0 left-0 w-1.5', phaseTone(index).split(' ')[0])} />
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label={`Giai đoạn ${index + 1}`} className="min-w-[200px] flex-1">
                      <Input
                        value={phase.name}
                        placeholder="Tên giai đoạn"
                        onChange={(event) => updatePhase(phase.key, { name: event.target.value })}
                      />
                    </Field>
                    <Field label="Số tuần">
                      <Stepper
                        label="số tuần"
                        value={phase.weeks}
                        min={PROGRAM_LIMITS.minWeeks}
                        max={PROGRAM_LIMITS.maxWeeks}
                        onChange={(weeks) => updatePhase(phase.key, { weeks })}
                      />
                    </Field>
                    <div className="flex gap-1 pb-1">
                      <Button size="icon" variant="ghost" title="Đưa lên" disabled={index === 0} onClick={() => movePhase(index, -1)}>
                        <ArrowUp size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Đưa xuống"
                        disabled={index === phases.length - 1}
                        onClick={() => movePhase(index, 1)}
                      >
                        <ArrowDown size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Xóa giai đoạn"
                        disabled={phases.length <= 1}
                        onClick={() => setPhases((current) => current.filter((item) => item.key !== phase.key))}
                        className="hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    <p className="px-1 text-xs font-medium text-gray-400">Môn học và số buổi mỗi tuần</p>
                    {phase.items.map((item) => {
                      const subject = byId.get(item.subjectId);
                      return (
                        <div key={item.key} className="flex flex-wrap items-start gap-3 rounded-xl bg-emerald-50/40 p-2.5">
                          <div className="min-w-[220px] flex-1">
                            <Select
                              aria-label="Môn học"
                              value={item.subjectId}
                              onChange={(event) => updateItem(phase.key, item.key, { subjectId: event.target.value })}
                              className="bg-white"
                            >
                              <option value="">Chọn môn học…</option>
                              {subjects.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.name} — {intensityLabel[option.intensity]} · {workoutLine(option.distanceM, option.repetitions)}
                                </option>
                              ))}
                            </Select>
                            {subject && (
                              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-gray-500">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className={cn('h-2 w-2 rounded-full', intensityDot[subject.intensity])} />
                                  {intensityLabel[subject.intensity]}
                                </span>
                                <span>{workoutLabel[subject.workoutType]}</span>
                                <span>Sân {surfaceLabel[subject.surface].toLowerCase()}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Stepper
                              size="sm"
                              label="số buổi mỗi tuần"
                              value={item.sessionsPerWeek}
                              min={1}
                              max={7}
                              suffix="buổi/tuần"
                              onChange={(sessionsPerWeek) => updateItem(phase.key, item.key, { sessionsPerWeek })}
                            />
                          </div>
                          <div className="flex items-center self-center">
                            <button
                              type="button"
                              aria-label="Bỏ dòng môn học"
                              disabled={phase.items.length <= 1}
                              onClick={() =>
                                updatePhase(phase.key, { items: phase.items.filter((entry) => entry.key !== item.key) })
                              }
                              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() =>
                        updatePhase(phase.key, { items: [...phase.items, { key: nextKey(), subjectId: '', sessionsPerWeek: 1 }] })
                      }
                    >
                      <Plus size={14} /> Thêm môn
                    </Button>
                    <span
                      className={cn(
                        'text-sm tabular-nums',
                        perWeek > 7 ? 'font-semibold text-red-600' : perWeek === 7 ? 'text-amber-700' : 'text-gray-500',
                      )}
                    >
                      {perWeek}/7 buổi mỗi tuần
                      {phaseSummary && phaseSummary.weeklyVolumeM > 0 && ` · ${volumeLabel(phaseSummary.weeklyVolumeM)}/tuần`}
                    </span>
                  </div>

                  {errors.length > 0 && (
                    <ul className="mt-3 space-y-1 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                      {errors.map((issue) => (
                        <li key={issue.message}>{issue.message}</li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            );
          })}

          <button
            type="button"
            disabled={phases.length >= PROGRAM_LIMITS.maxPhases}
            onClick={() => {
              setPhases((current) => [
                ...current,
                { key: nextKey(), name: '', weeks: 2, items: [{ key: nextKey(), subjectId: '', sessionsPerWeek: 1 }] },
              ]);
              window.setTimeout(() => lastPhaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-900/10 py-5 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={16} />
            {phases.length >= PROGRAM_LIMITS.maxPhases
              ? `Đã đủ ${PROGRAM_LIMITS.maxPhases} giai đoạn`
              : `Thêm giai đoạn (${phases.length}/${PROGRAM_LIMITS.maxPhases})`}
          </button>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-5 xl:col-span-4">
          <Card>
            <SectionTitle>Xem nhanh giáo án</SectionTitle>
            <PhaseTimeline phases={summary.phases} size="lg" showRuler />
            <dl className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-light text-gray-400">Tổng thời lượng</dt>
                <dd
                  className={cn(
                    'text-2xl font-bold tabular-nums',
                    summary.totalWeeks > PROGRAM_LIMITS.maxTotalWeeks ? 'text-red-600' : 'text-gray-900',
                  )}
                >
                  {summary.totalWeeks}
                  <span className="ml-1 text-sm font-medium text-gray-400">/ {PROGRAM_LIMITS.maxTotalWeeks} tuần</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-light text-gray-400">Tổng số buổi</dt>
                <dd className="text-2xl font-bold text-gray-900 tabular-nums">{summary.totalSessions}</dd>
              </div>
              <div>
                <dt className="text-xs font-light text-gray-400">Cường độ cao nhất</dt>
                <dd className="mt-1">{summary.maxIntensity ? <IntensityPill intensity={summary.maxIntensity} /> : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-light text-gray-400">Khối lượng đỉnh</dt>
                <dd className="font-semibold text-gray-900 tabular-nums">{volumeLabel(summary.peakWeeklyVolumeM)}/tuần</dd>
              </div>
            </dl>

            <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">
              {summary.phases.map((phase, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', phaseTone(index).split(' ')[0])} />
                  <span className="min-w-0 flex-1 truncate text-gray-700">{phase.name || `Giai đoạn ${index + 1}`}</span>
                  <span className="text-xs text-gray-500 tabular-nums">
                    {phase.sessionsPerWeek} buổi/tuần · {volumeLabel(phase.weeklyVolumeM)}
                  </span>
                  {phase.maxIntensity && (
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', intensityDot[phase.maxIntensity])} title={intensityLabel[phase.maxIntensity]} />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {programId && (
            <Notice tone="info" icon={<Info size={16} />}>
              Sửa giáo án không làm đổi buổi đã sinh của các lớp đang chạy
              {openClassCount > 0 ? ` (${openClassCount} lớp đang dùng)` : ''}. Thay đổi chỉ áp dụng cho lớp mở sau này.
            </Notice>
          )}

          {warnings.length > 0 && (
            <div className="space-y-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 shadow-amber ring-1 ring-amber-100">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={15} /> Cảnh báo — vẫn lưu được
              </p>
              <ul className="space-y-1.5">
                {warnings.map((warning) => (
                  <li key={warning} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {touched && blocking && (
            <div className="space-y-2 rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-100">
              <p className="font-semibold">Cần sửa trước khi lưu</p>
              <ul className="space-y-1">
                {issues.map((issue) => (
                  <li key={issue.message} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-red-500" />
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!touched && (
            <p className="px-1 text-xs font-light text-gray-400">
              Tối đa {PROGRAM_LIMITS.maxPhases} giai đoạn, mỗi giai đoạn 1–{PROGRAM_LIMITS.maxWeeks} tuần, tổng không quá{' '}
              {PROGRAM_LIMITS.maxTotalWeeks} tuần. Mỗi tuần tối đa 7 buổi vì lớp học dùng một khung giờ cố định.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
