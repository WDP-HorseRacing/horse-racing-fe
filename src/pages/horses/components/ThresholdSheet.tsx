// Đặt phiên bản ngưỡng nhịp tim, tốc độ mới cho ngựa (chỉ HLV trưởng của khu). Mỗi lần lưu là một phiên bản có khoảng hiệu lực,
// không ghi đè phiên bản cũ. Hộp giữa màn hình: trên cùng là thanh ba vùng nằm ngang, mốc trượt theo số vừa gõ (GSAP).
import { useEffect, useRef, useState } from 'react';
import { setThresholds } from '../../../api/performance';
import type { ThresholdLimits } from '../../../api/types';
import { Button, ErrorBox, Field, Input, Modal, Notice, useToast } from '../../../components/ui';
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
  if (to && from && to <= from) errors.push('Thời điểm kết thúc phải sau thời điểm bắt đầu');

  return (
    <Modal
      open
      width="max-w-2xl"
      onClose={onClose}
      title={`Đặt ngưỡng cho ${horseName}`}
      description="Ngưỡng cũ vẫn giữ trong lịch sử."
      dirty={warning !== current.heartRateWarningBpm || critical !== current.heartRateCriticalBpm || speed !== current.maxSpeedMps || to !== '' || name !== `Bộ ngưỡng ${nextVersion}`}
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
                  toast.push(`Đã lưu ngưỡng mới cho ${horseName}`, 'success');
                  onSaved();
                },
              )
            }
          >
            {save.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {save.error && <ErrorBox message={save.error} />}
        {errors.length > 0 && <ErrorBox message={errors.join('. ')} />}
        <ZoneBar warning={warning} critical={critical} />
        <Field label="Tên bộ ngưỡng" required>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Giai đoạn nước rút" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nhịp tim cảnh báo" hint="Vượt mức này là cảnh báo">
            <Stepper value={warning} onChange={setWarning} min={1} max={300} step={5} suffix="bpm" label="ngưỡng cảnh báo" />
          </Field>
          <Field label="Nhịp tim nguy hiểm" hint="Báo khẩn cho bác sĩ và HLV">
            <Stepper value={critical} onChange={setCritical} min={1} max={300} step={5} suffix="bpm" label="ngưỡng nguy hiểm" />
          </Field>
          <Field label="Tốc độ tối đa" hint="Vượt tốc độ này cũng là cảnh báo">
            <Stepper value={speed} onChange={setSpeed} min={1} max={30} suffix="m/s" label="tốc độ tối đa" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hiệu lực từ" required>
            <DateTimePicker value={from} onChange={setFrom} />
          </Field>
          <Field label="Hiệu lực đến" hint="Bỏ trống là không giới hạn">
            <DateTimePicker value={to} onChange={setTo} />
          </Field>
        </div>
        <Notice tone="info">Mặc định câu lạc bộ: cảnh báo 220 bpm, nguy hiểm 240 bpm, tốc độ tối đa 18 m/s.</Notice>
      </div>
    </Modal>
  );
}

/** Thanh ba vùng nằm ngang: xanh dưới ngưỡng cảnh báo, hổ phách tới ngưỡng nguy hiểm, đỏ phía trên. Mốc trượt theo số gõ. */
function ZoneBar({ warning, critical }: { warning: number; critical: number }) {
  const min = 60;
  const max = Math.max(260, critical + 30);
  const pct = (value: number) => ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
  const warnRef = useRef<HTMLDivElement>(null);
  const critRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const apply = (node: HTMLDivElement | null, value: number) => {
      if (!node) return;
      if (prefersReducedMotion()) gsap.set(node, { left: `${pct(value)}%` });
      else gsap.to(node, { left: `${pct(value)}%`, duration: 0.45, ease: 'power3.out' });
    };
    apply(warnRef.current, warning);
    apply(critRef.current, critical);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warning, critical]);
  const marker = 'absolute top-0 flex -translate-x-1/2 flex-col items-center';
  return (
    <div className="rounded-2xl bg-gray-50/80 px-4 pb-3 pt-2 ring-1 ring-gray-100">
      <div className="relative h-14">
        <div ref={warnRef} className={marker} style={{ left: `${pct(warning)}%` }}>
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-900">{warning}</span>
          <span className="h-3 w-0.5 bg-amber-600" />
        </div>
        <div ref={critRef} className={marker} style={{ left: `${pct(critical)}%` }}>
          <span className="rounded-md bg-red-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-red-800">{critical}</span>
          <span className="h-3 w-0.5 bg-red-600" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex h-4 overflow-hidden rounded-full ring-1 ring-gray-200">
          <div className="bg-emerald-300 transition-all duration-500" style={{ width: `${pct(warning)}%` }} />
          <div className="bg-amber-300 transition-all duration-500" style={{ width: `${pct(critical) - pct(warning)}%` }} />
          <div className="flex-1 bg-red-400" />
        </div>
      </div>
      <div className="mt-1 flex justify-between whitespace-nowrap font-mono text-[11px] text-gray-500">
        <span>{min} bpm</span>
        <span>{max} bpm</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="size-2 rounded-full bg-emerald-400" /> Bình thường
        </span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="size-2 rounded-full bg-amber-400" /> Cảnh báo trên {warning}
        </span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="size-2 rounded-full bg-red-500" /> Nguy hiểm trên {critical}
        </span>
      </div>
    </div>
  );
}
