// F4.4 — Groom báo sự cố tại chuồng: ngựa đang phụ trách, mô tả, một ảnh thực tế, cờ Khẩn.
// Không có trường phân loại: các nút gợi ý chèn đúng ví dụ của đề (Bỏ ăn, Đau bụng, Sốt, Móng bị xước) vào mô tả.
// Khẩn: BE tạo ngay yêu cầu khám khẩn và báo mọi bác sĩ. Thường: HLV khu nhận thông báo, tự xử lý hoặc chuyển bác sĩ.
import { useState } from 'react';
import { reportIncident } from '../../../api/stable-care';
import type { Incident } from '../../../api/types';
import { Button, Dot, ErrorBox, Field, Modal, Notice, Select, Skeleton, Textarea, cn, useToast } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';
import { healthLabel } from '../../../lib/labels';
import { INCIDENT_HINTS, textError } from '../../../lib/stable-labels';
import { horsePlace, useMedicalHorses } from '../../medical/components/horses';
import { IncidentPhotoPicker, type PhotoUploadState } from './IncidentPhotoPicker';

const MAX_DESCRIPTION = 2000;

export function IncidentReportForm({
  horse,
  onDone,
  onCancel,
}: {
  /** Mở từ một ngựa: điền sẵn, không cho đổi. */
  horse?: { id: string; name: string };
  onDone?: (incident: Incident) => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const options = useMedicalHorses('myHorses', !horse);
  const [horseId, setHorseId] = useState(horse?.id ?? '');
  const [description, setDescription] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [photo, setPhoto] = useState<PhotoUploadState>({ uploading: false });
  const [resetKey, setResetKey] = useState(0);
  const [touched, setTouched] = useState(false);
  const picked = horse ?? (horseId ? options.byId.get(horseId) : undefined);
  const text = description.trim();
  const descriptionError = touched ? textError(description, { label: 'Mô tả', max: MAX_DESCRIPTION }) : undefined;

  const addHint = (hint: string) =>
    setDescription((current) => {
      const base = current.trim().replace(/[.,]$/, '');
      if (base.toLowerCase().includes(hint.toLowerCase())) return current;
      return base ? `${base}, ${hint.toLowerCase()}` : hint;
    });

  const submit = () => {
    setTouched(true);
    if (!horseId || textError(description, { label: 'Mô tả', max: MAX_DESCRIPTION }) || photo.uploading) return;
    void action.run(
      () => reportIncident({ horseId, description: text, urgent, ...(photo.mediaId ? { photoMediaId: photo.mediaId } : {}) }),
      (incident) => {
        toast.push(urgent ? `Đã báo sự cố khẩn cho ${incident.horseName}, bác sĩ đã nhận thông báo` : `Đã báo sự cố cho ${incident.horseName}, HLV khu đã nhận thông báo`, 'success');
        setDescription('');
        setUrgent(false);
        setPhoto({ uploading: false });
        setResetKey((key) => key + 1);
        setTouched(false);
        if (!horse) setHorseId('');
        onDone?.(incident);
      },
    );
  };

  if (!horse && options.loading && !options.data) return <Skeleton rows={4} />;
  if (!horse && options.error) return <ErrorBox message={options.error} />;
  if (!horse && options.data?.length === 0) return <Notice tone="info">Bạn chưa được phân công chăm sóc ngựa nào, nên chưa báo sự cố được.</Notice>;

  return (
    <div className="space-y-4">
      {!horse && (
        <Field label="Ngựa" required hint="Ngựa bạn đang được phân công chăm sóc" error={touched && !horseId ? 'Chọn ngựa' : undefined}>
          <Select value={horseId} onChange={(event) => setHorseId(event.target.value)}>
            <option value="">Chọn ngựa…</option>
            {options.data?.map((item) => {
              const place = horsePlace(item);
              return (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {place ? ` · ${place}` : ''}
                  {item.healthStatus !== 'ELIGIBLE' ? ` · ${healthLabel[item.healthStatus]}` : ''}
                </option>
              );
            })}
          </Select>
        </Field>
      )}

      <div>
        <Field
          label="Tình trạng"
          required
          error={descriptionError}
          counter={
            <span className={cn('tabular-nums', text.length > MAX_DESCRIPTION && 'font-medium text-red-600')}>
              {text.length}/{MAX_DESCRIPTION}
            </span>
          }
        >
          <Textarea
            rows={4}
            value={description}
            maxLength={MAX_DESCRIPTION + 200}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ví dụ: Bỏ ăn bữa sáng, móng trước trái bị xước nhẹ, không chảy máu"
          />
        </Field>
        {/* Nút gợi ý nằm ngoài Field (Field là thẻ label, bấm chữ nhãn sẽ kích nút đầu tiên). */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {INCIDENT_HINTS.map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => addHint(hint)}
              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:bg-emerald-50 hover:text-emerald-800 hover:ring-emerald-200"
            >
              + {hint}
            </button>
          ))}
        </div>
      </div>

      <IncidentPhotoPicker onChange={setPhoto} disabled={action.pending} resetKey={resetKey} />

      <div>
        <span className="mb-1.5 block text-sm font-medium text-gray-600">Mức độ</span>
        <div className="grid grid-cols-2 gap-2">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setUrgent(value)}
              aria-pressed={urgent === value}
              className={cn(
                'flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 transition',
                urgent === value ? (value ? 'ring-2 ring-red-500' : 'ring-2 ring-emerald-700') : 'ring-1 ring-gray-200 hover:ring-gray-300',
              )}
            >
              <Dot tone={urgent === value && value ? 'danger' : 'neutral'} />
              {value ? 'Khẩn' : 'Bình thường'}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          {urgent ? 'Tạo ngay yêu cầu khám khẩn, mọi bác sĩ nhận thông báo.' : 'HLV khu nhận thông báo, tự xử lý hoặc chuyển bác sĩ.'}
        </p>
      </div>

      {action.error && <ErrorBox message={action.error} />}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Hủy
          </Button>
        )}
        <Button variant={urgent ? 'danger' : 'primary'} onClick={submit} disabled={action.pending || photo.uploading}>
          {action.pending ? 'Đang gửi…' : photo.uploading ? 'Chờ tải ảnh xong' : picked ? `Báo sự cố ${picked.name}` : 'Báo sự cố'}
        </Button>
      </div>
    </div>
  );
}

export function IncidentReportDialog({ open, onClose, horse, onDone }: { open: boolean; onClose: () => void; horse?: { id: string; name: string }; onDone?: () => void }) {
  if (!open) return null;
  return (
    <Modal open onClose={onClose} title={horse ? `Báo sự cố: ${horse.name}` : 'Báo sự cố'} description="Mô tả những gì bạn thấy và chụp ảnh nếu được. Chọn Khẩn nếu cần bác sĩ tới ngay.">
      <IncidentReportForm
        horse={horse}
        onCancel={onClose}
        onDone={() => {
          onDone?.();
          onClose();
        }}
      />
    </Modal>
  );
}
