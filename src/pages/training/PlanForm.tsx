import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { createPlan, listSlots, planWarnings, type WorkoutTemplateInput } from '../../services/training.service';
import { listHorses } from '../../services/horse.service';
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  PageHeader,
  Reveal,
  SectionTitle,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { WeekGrid } from '../../components/WeekGrid';
import { distanceLabel } from '../../lib/labels';
import { toDateKey, addDays } from '../../lib/format';
import { now } from '../../lib/clock';

interface PhaseDraft {
  name: string;
  goal: string;
  weeks: number;
  template: WorkoutTemplateInput[];
}

export default function PlanForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const horses = useService(() => listHorses(), []);
  const slots = useService(() => listSlots(), []);
  const action = useAction();

  const [form, setForm] = useState({
    horseId: params.get('horseId') ?? '',
    name: '',
    goal: '',
    targetDistanceM: '',
    startDate: toDateKey(addDays(now(), 1)),
  });
  const [phases, setPhases] = useState<PhaseDraft[]>([
    { name: 'Giai đoạn 1', goal: '', weeks: 4, template: [] },
  ]);
  const [activePhase, setActivePhase] = useState(0);

  if (horses.loading || slots.loading) return <Skeleton rows={6} />;

  const trainable = horses.data?.filter((horse) => horse.lifecycleStatus === 'ACTIVE' && !horse.isReference) ?? [];
  const selectedHorse = trainable.find((horse) => horse.id === form.horseId);
  const phase = phases[activePhase];
  const warnings = planWarnings(phase?.template ?? []);
  const totalWeeks = phases.reduce((sum, item) => sum + item.weeks, 0);

  const preferenceWarning =
    selectedHorse?.distancePreference &&
    form.targetDistanceM &&
    ((Number(form.targetDistanceM) < 1400 && selectedHorse.distancePreference !== 'SPRINTER') ||
      (Number(form.targetDistanceM) > 1800 && selectedHorse.distancePreference !== 'STAYER') ||
      (Number(form.targetDistanceM) >= 1400 &&
        Number(form.targetDistanceM) <= 1800 &&
        selectedHorse.distancePreference !== 'MILER'));

  const submit = async () => {
    const planId = await action.run(() =>
      createPlan({
        horseId: form.horseId,
        name: form.name,
        goal: form.goal,
        targetDistanceM: form.targetDistanceM ? Number(form.targetDistanceM) : undefined,
        startDate: form.startDate,
        phases,
      }),
    );
    if (planId) navigate(`/training/plans/${planId}`);
  };

  const fieldError = (field: string) => (action.field === field ? action.error : undefined);

  return (
    <Reveal className="space-y-6 pb-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-gray-600"
      >
        <ArrowLeft size={16} /> Quay lại
      </button>

      <div data-reveal>
        <PageHeader
          title="Lập giáo án huấn luyện"
          description="Ngày bắt đầu và kết thúc của giáo án tự tính từ số tuần của các giai đoạn. Tối đa 6 giai đoạn và 52 tuần."
        />
      </div>

      {action.error && !action.field && <ErrorBox message={action.error} />}

      <div data-reveal>
        <Card>
          <SectionTitle>Thông tin giáo án</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ngựa" required error={fieldError('horseId')}>
              <Select value={form.horseId} onChange={(event) => setForm({ ...form, horseId: event.target.value })}>
                <option value="">Chọn ngựa</option>
                {trainable.map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    {horse.name} — {horse.zoneName ?? 'chưa xếp chuồng'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tên giáo án" required error={fieldError('name')}>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Ví dụ: Chuẩn bị Cúp Mùa Thu"
              />
            </Field>
            <Field label="Mục tiêu giáo án" className="sm:col-span-2">
              <Textarea value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })} />
            </Field>
            <Field
              label="Cự ly mục tiêu (m)"
              hint={
                selectedHorse?.distancePreference
                  ? `Sở trường của ngựa: ${distanceLabel[selectedHorse.distancePreference]}`
                  : 'Là cự ly của giải định đua'
              }
            >
              <Input
                type="number"
                value={form.targetDistanceM}
                onChange={(event) => setForm({ ...form, targetDistanceM: event.target.value })}
              />
            </Field>
            <Field
              label="Ngày bắt đầu"
              required
              error={fieldError('startDate')}
              hint="Giáo án mới không được bắt đầu ở quá khứ"
            >
              <Input
                type="date"
                min={toDateKey(now())}
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            </Field>
          </div>

          {(preferenceWarning || (selectedHorse && !selectedHorse.trainAllowed)) && (
            <div className="mt-4 space-y-2">
              {preferenceWarning && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  Cự ly mục tiêu lệch với sở trường cự ly của ngựa. Đây chỉ là cảnh báo, vẫn lưu được.
                </div>
              )}
              {selectedHorse && !selectedHorse.trainAllowed && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  Ngựa đang bị chặn tập ({selectedHorse.trainReason}). Vẫn lập được giáo án để chuẩn bị kế hoạch quay
                  lại; việc chặn sẽ xảy ra khi sinh buổi tập và khi bấm bắt đầu.
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <div data-reveal>
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>Các giai đoạn ({totalWeeks} tuần)</SectionTitle>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setPhases([...phases, { name: `Giai đoạn ${phases.length + 1}`, goal: '', weeks: 4, template: [] }]);
                setActivePhase(phases.length);
              }}
              disabled={phases.length >= 6}
            >
              <Plus size={14} /> Thêm giai đoạn
            </Button>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {phases.map((item, index) => (
              <button
                key={index}
                onClick={() => setActivePhase(index)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activePhase === index
                    ? 'bg-emerald-600 text-white'
                    : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {item.name} · {item.weeks} tuần
              </button>
            ))}
          </div>

          {phase && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Tên giai đoạn" required>
                  <Input
                    value={phase.name}
                    onChange={(event) =>
                      setPhases(phases.map((item, index) => (index === activePhase ? { ...item, name: event.target.value } : item)))
                    }
                  />
                </Field>
                <Field label="Số tuần" required hint="1–12 tuần">
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={phase.weeks}
                    onChange={(event) =>
                      setPhases(
                        phases.map((item, index) =>
                          index === activePhase ? { ...item, weeks: Number(event.target.value) } : item,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Mục tiêu giai đoạn">
                  <Input
                    value={phase.goal}
                    onChange={(event) =>
                      setPhases(phases.map((item, index) => (index === activePhase ? { ...item, goal: event.target.value } : item)))
                    }
                  />
                </Field>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-600">Tuần mẫu của giai đoạn</p>
                <WeekGrid
                  value={phase.template}
                  slots={slots.data ?? []}
                  onChange={(next) =>
                    setPhases(phases.map((item, index) => (index === activePhase ? { ...item, template: next } : item)))
                  }
                />
              </div>

              {warnings.length > 0 && (
                <div className="space-y-2">
                  {warnings.map((warning) => (
                    <div key={warning} className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      {warning} — đây là cảnh báo, không chặn lưu.
                    </div>
                  ))}
                </div>
              )}

              {fieldError('template') && <ErrorBox message={fieldError('template')!} />}
              {fieldError('phases') && <ErrorBox message={fieldError('phases')!} />}

              {phases.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPhases(phases.filter((_, index) => index !== activePhase));
                    setActivePhase(0);
                  }}
                >
                  <Trash2 size={14} /> Xóa giai đoạn này
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-3" data-reveal>
        <Button onClick={submit} disabled={action.pending}>
          <Save size={16} /> {action.pending ? 'Đang lưu…' : 'Lưu giáo án'}
        </Button>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Hủy
        </Button>
      </div>
    </Reveal>
  );
}
