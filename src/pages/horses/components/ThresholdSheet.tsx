// Đặt phiên bản ngưỡng nhịp tim, tốc độ mới cho ngựa (chỉ HLV trưởng của khu). Mỗi lần lưu là một phiên bản có khoảng hiệu lực,
// không ghi đè phiên bản cũ. Bên cạnh form là thước đứng ba vùng, kim trượt theo số vừa gõ (GSAP).
import { useEffect, useRef, useState } from 'react';
import { setThresholds } from '../../../api/performance';
import type { ThresholdLimits } from '../../../api/types';
import { Button, ErrorBox, Field, Input, Notice, Sheet, useToast } from '../../../components/ui';
import { DateTimePicker } from '../../../components/ui/DatePicker';
import { useAction } from '../../../hooks/useService';
import { gsap } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { Stepper } from '../../training/components/Stepper';

const toLocalInput = (date: Date) => {
  const shifted = new Date(date.getTime() + 7 * 3600_000);
  return shifted.toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => new Date(`${value}:00+07:00`).toISOString();

export default function ThresholdSheet({
  horseId,
  horseName,
  current,
  nextVersion,
  onClose,
  onSaved,
}: {
  horseId: string;
  horseName: string;
  current: ThresholdLimits;
  nextVersion: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(`Bộ ngưỡng ${nextVersion}`);
  const [warning, setWarning] = useState(current.heartRateWarningBpm);
  const [critical, setCritical] = useState(current.heartRateCriticalBpm);
  const [speed, setSpeed] = useState(current.maxSpeedMps);
  const [from, setFrom] = useState(toLocalInput(new Date()));
  const [to, setTo] = useState('');
  const save = useAction();

  const errors: string[] = [];
  if (!name.trim()) errors.push('Nhập tên bộ ngưỡng');
  if (warning >= critical) errors.push('Ngưỡng cảnh báo phải nhỏ hơn ngưỡng nguy hiểm');
  if (to && from && to <= from) errors.push('Hết hiệu lực phải sau lúc bắt đầu hiệu lực');

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Đặt ngưỡng cho ${horseName}`}
      description={`Tạo phiên bản ${nextVersion}. Phiên bản cũ vẫn giữ trong lịch sử.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={errors.length > 0 || save.pending}
            onClick={() =>
              void save.run(
                () =>
                  setThresholds(horseId, {
                    profileName: name.trim(),
                    effectiveFrom: fromLocalInput(from),
                    effectiveTo: to ? fromLocalInput(to) : undefined,
                    limits: { heartRateWarningBpm: warning, heartRateCriticalBpm: critical, maxSpeedMps: speed },
                  }),
                () => {
                  toast.push(`Đã lưu ngưỡng phiên bản ${nextVersion} cho ${horseName}`, 'success');
                  onSaved();
                },
              )
            }
          >
            {save.pending ? 'Đang lưu…' : 'Lưu phiên bản mới'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="min-w-0 flex-1 space-y-5">
          {save.error && <ErrorBox message={save.error} />}
          {errors.length > 0 && <ErrorBox message={errors.join('. ')} />}
          <Field label="Tên bộ ngưỡng" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Giai đoạn nước rút" />
          </Field>
          <Field label="Nhịp tim cảnh báo" hint="Vượt mức này là cảnh báo (màu hổ phách)">
            <Stepper value={warning} onChange={setWarning} min={1} max={300} step={5} suffix="bpm" label="ngưỡng cảnh báo" />
          </Field>
          <Field label="Nhịp tim nguy hiểm" hint="Vượt mức này là nguy hiểm: báo khẩn cho bác sĩ và HLV">
            <Stepper value={critical} onChange={setCritical} min={1} max={300} step={5} suffix="bpm" label="ngưỡng nguy hiểm" />
          </Field>
          <Field label="Tốc độ tối đa" hint="Vượt tốc độ này cũng là cảnh báo">
            <Stepper value={speed} onChange={setSpeed} min={1} max={30} suffix="m/s" label="tốc độ tối đa" />
          </Field>
          <Field label="Hiệu lực từ" required>
            <DateTimePicker value={from} onChange={setFrom} />
          </Field>
          <Field label="Hiệu lực đến" hint="Bỏ trống là không giới hạn">
            <DateTimePicker value={to} onChange={setTo} />
          </Field>
          <Notice tone="info">Mặc định câu lạc bộ: cảnh báo 220 bpm, nguy hiểm 240 bpm, tốc độ tối đa 18 m/s.</Notice>
        </div>
        <VerticalGauge warning={warning} critical={critical} />
      </div>
    </Sheet>
  );
}

/** Thước đứng ba vùng: xanh dưới ngưỡng cảnh báo, hổ phách tới ngưỡng nguy hiểm, đỏ phía trên. */
function VerticalGauge({ warning, critical }: { warning: number; critical: number }) {
  const max = Math.max(260, critical + 30);
  const min = 60;
  const pct = (value: number) => ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
  const warnRef = useRef<HTMLDivElement>(null);
  const critRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const apply = (node: HTMLDivElement | null, value: number) => {
      if (!node) return;
      if (prefersReducedMotion()) gsap.set(node, { bottom: `${pct(value)}%` });
      else gsap.to(node, { bottom: `${pct(value)}%`, duration: 0.45, ease: 'power3.out' });
    };
    apply(warnRef.current, warning);
    apply(critRef.current, critical);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warning, critical]);
  return (
    <div className="hidden w-24 shrink-0 sm:block">
      <div className="relative mx-auto h-80 w-10 overflow-visible">
        <div className="absolute inset-0 overflow-hidden rounded-full ring-1 ring-gray-200">
          <div className="absolute inset-x-0 bottom-0 bg-emerald-300 transition-all duration-500" style={{ height: `${pct(warning)}%` }} />
          <div className="absolute inset-x-0 bg-amber-300 transition-all duration-500" style={{ bottom: `${pct(warning)}%`, height: `${pct(critical) - pct(warning)}%` }} />
          <div className="absolute inset-x-0 top-0 bg-red-400 transition-all duration-500" style={{ height: `${100 - pct(critical)}%` }} />
        </div>
        <div ref={warnRef} className="absolute -right-14 flex translate-y-1/2 items-center gap-1" style={{ bottom: `${pct(warning)}%` }}>
          <span className="h-0.5 w-3 bg-amber-600" />
          <span className="font-mono text-xs font-semibold text-amber-800">{warning}</span>
        </div>
        <div ref={critRef} className="absolute -right-14 flex translate-y-1/2 items-center gap-1" style={{ bottom: `${pct(critical)}%` }}>
          <span className="h-0.5 w-3 bg-red-600" />
          <span className="font-mono text-xs font-semibold text-red-700">{critical}</span>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-gray-500">bpm</p>
    </div>
  );
}
