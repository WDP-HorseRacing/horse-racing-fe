// F4.4 — Groom báo sự cố tại chuồng: mọi ngựa đang ở CLB (ngựa mình phụ trách lên đầu), mô tả, một ảnh (tùy chọn), cờ Khẩn.
// Báo hộ ngựa người khác phụ trách thì Groom phụ trách và HLV khu cùng được báo.
// Không có trường phân loại: các nút gợi ý chèn đúng ví dụ của đề (Bỏ ăn, Đau bụng, Sốt, Móng bị xước) vào mô tả.
// Khẩn: BE tạo ngay yêu cầu khám khẩn và báo mọi bác sĩ. Thường: HLV khu nhận thông báo, tự xử lý hoặc chuyển bác sĩ.
import { useEffect, useState } from 'react';
import { reportIncident } from '../../../api/stable-care';
import type { HorseListItem, Incident } from '../../../api/types';
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
  onDirtyChange,
}: {
  /** Mở từ một ngựa: điền sẵn, không cho đổi. */
  horse?: { id: string; name: string };
  onDone?: (incident: Incident) => void;
  onCancel?: () => void;
  /** Báo cho hộp chứa biết đã nhập dở, để hỏi trước khi đóng. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const toast = useToast();
  const action = useAction();
  const options = useMedicalHorses('all', !horse);
  const mine = useMedicalHorses('myHorses', !horse);
  const [horseId, setHorseId] = useState(horse?.id ?? '');
  const [description, setDescription] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [photo, setPhoto] = useState<PhotoUploadState>({ uploading: false });
  const [resetKey, setResetKey] = useState(0);
  const [touched, setTouched] = useState(false);
  const text = description.trim();
  const dirty = text !== '' || urgent || !!photo.mediaId || photo.uploading || (!horse && horseId !== '');
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
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
        toast.push(`Đã báo sự cố ${incident.horseName}`, 'success');
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
  if (!horse && options.data?.length === 0) return <Notice tone="info">Câu lạc bộ chưa có ngựa nào.</Notice>;

  const mineIds = new Set((mine.data ?? []).map((item) => item.id));
  const option = (item: HorseListItem) => {
    const place = horsePlace(item);
    return (
      <option key={item.id} value={item.id}>
        {item.name}
        {place ? ` · ${place}` : ''}
        {item.healthStatus !== 'ELIGIBLE' ? ` · ${healthLabel[item.healthStatus]}` : ''}
      </option>
    );
  };
  const reportingForOther = !horse && !!horseId && !!mine.data && !mineIds.has(horseId);

  return (
    <div className="space-y-4">
      {!horse && (
        <Field
          label="Ngựa"
          required
          error={touched && !horseId ? 'Chọn ngựa' : undefined}
          hint={reportingForOther ? 'Bạn không phụ trách ngựa này: Groom phụ trách và HLV khu sẽ được báo.' : 'Báo được cho mọi ngựa đang ở câu lạc bộ, kể cả ngựa người khác phụ trách.'}
        >
          <Select value={horseId} onChange={(event) => setHorseId(event.target.value)}>
            <option value="">Chọn ngựa…</option>
            {/* Ô chọn tự làm không có nhóm: dùng dòng tắt làm tiêu đề nhóm. */}
            {mineIds.size > 0 && (
              <option value="__mine" disabled>
                Ngựa tôi phụ trách
              </option>
            )}
            {(options.data ?? []).filter((item) => mineIds.has(item.id)).map(option)}
            {mineIds.size > 0 && (
              <option value="__others" disabled>
                Ngựa khác trong câu lạc bộ
              </option>
            )}
            {(options.data ?? []).filter((item) => !mineIds.has(item.id)).map(option)}
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
          {urgent ? 'Báo ngay cho mọi bác sĩ.' : 'Báo cho HLV khu.'}
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
          {action.pending ? 'Đang gửi…' : photo.uploading ? 'Đang tải ảnh…' : 'Gửi'}
        </Button>
      </div>
    </div>
  );
}

export function IncidentReportDialog({ open, onClose, horse, onDone }: { open: boolean; onClose: () => void; horse?: { id: string; name: string }; onDone?: () => void }) {
  const [dirty, setDirty] = useState(false);
  if (!open) return null;
  return (
    <Modal open onClose={onClose} title={horse ? `Báo sự cố: ${horse.name}` : 'Báo sự cố'} description="Cần bác sĩ tới ngay thì chọn Khẩn." dirty={dirty}>
      <IncidentReportForm
        horse={horse}
        onCancel={onClose}
        onDirtyChange={setDirty}
        onDone={() => {
          onDone?.();
          onClose();
        }}
      />
    </Modal>
  );
}
