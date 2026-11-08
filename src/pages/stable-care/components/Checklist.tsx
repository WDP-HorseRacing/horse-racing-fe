// F4.1 — Checklist chăm sóc hằng ngày của một ngựa.
// Groom tải ảnh bằng chứng để hoàn tất việc; ghi chú có thể cập nhật riêng. Ngày đã qua thì chỉ xem.
import { useEffect, useRef, useState } from 'react';
import { Camera, Check, MessageSquarePlus } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { updateChecklistItem } from '../../../api/stable-care';
import { uploadChecklistEvidence } from '../../../api/media';
import type { ChecklistItem, ChecklistStatus, DailyChecklist } from '../../../api/types';
import { Lightbox } from '../../../components/Lightbox';
import { Pill, cn, useToast } from '../../../components/ui';
import { errorMessage } from '../../../lib/errors';
import { formatTime } from '../../../lib/format';
import { checklistStatusText } from '../../../lib/stable-labels';

const STATUS_TONE: Record<ChecklistStatus, 'gray' | 'amber' | 'green' | 'red'> = { PENDING: 'gray', IN_PROGRESS: 'amber', COMPLETED: 'green', INCOMPLETE: 'red', CANCELLED: 'gray' };

export function ChecklistPill({ status }: { status: ChecklistStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{checklistStatusText[status]}</Pill>;
}

export function ChecklistItems({
  checklist,
  editable,
  onChanged,
  large = false,
}: {
  checklist: DailyChecklist;
  /** Groom được giao, checklist của hôm nay. */
  editable: boolean;
  onChanged: (checklist: DailyChecklist) => void;
  /** Hàng thao tác lớn cho điện thoại (màn Việc hôm nay). */
  large?: boolean;
}) {
  const toast = useToast();
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [noting, setNoting] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const save = async (item: ChecklistItem, input: { evidenceMediaId?: string; note?: string | null }): Promise<boolean> => {
    setPending((current) => ({ ...current, [item.id]: true }));
    try {
      onChanged(await updateChecklistItem(item.id, input));
      return true;
    } catch (caught) {
      toast.push(errorMessage(caught), 'error');
      return false;
    } finally {
      setPending((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }
  };

  const saveNote = (item: ChecklistItem) => {
    const text = draft.trim().slice(0, 200);
    setNoting(null);
    if (text === (item.note ?? '')) return;
    void save(item, { note: text || null });
  };

  return (
    <>
      {editable && (
        <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 ring-1 ring-emerald-200/80">
          Chọn ảnh JPEG, PNG hoặc WebP (tối đa 10 MB) để tự hoàn tất việc. Có thể thay ảnh đã gắn bằng ảnh mới.
        </p>
      )}
      <ul className={cn('space-y-1.5', large && 'space-y-2')}>
        {checklist.items.map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            busy={!!pending[item.id]}
            editable={editable}
            large={large}
            noting={noting === item.id}
            onCompleteWithEvidence={(evidenceMediaId) => save(item, { evidenceMediaId })}
            onStartNote={() => {
              setDraft(item.note ?? '');
              setNoting(item.id);
            }}
            onSaveNote={() => saveNote(item)}
            onDraftChange={setDraft}
            draft={draft}
            onCancelNote={() => setNoting(null)}
          />
        ))}
      </ul>
    </>
  );
}

function ChecklistItemRow({
  item,
  busy,
  editable,
  large,
  noting,
  onCompleteWithEvidence,
  onStartNote,
  onSaveNote,
  onDraftChange,
  draft,
  onCancelNote,
}: {
  item: ChecklistItem;
  busy: boolean;
  editable: boolean;
  large: boolean;
  noting: boolean;
  onCompleteWithEvidence: (evidenceMediaId: string) => Promise<boolean>;
  onStartNote: () => void;
  onSaveNote: () => void;
  onDraftChange: (value: string) => void;
  draft: string;
  onCancelNote: () => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const previewVersion = useRef(0);
  const mounted = useRef(true);
  const [preview, setPreview] = useState<string>();
  const [selectedFile, setSelectedFile] = useState<File>();
  const [photoName, setPhotoName] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string>();
  const [uploadedMediaId, setUploadedMediaId] = useState<string>();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      previewVersion.current += 1;
    };
  }, []);

  const makeLowResolutionPreview = async (file: File, version: number) => {
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.25,
        maxWidthOrHeight: 1200,
        initialQuality: 0.55,
        useWebWorker: true,
      });
      const nextPreview = URL.createObjectURL(compressed);
      if (!mounted.current || previewVersion.current !== version) {
        URL.revokeObjectURL(nextPreview);
        return;
      }
      setPreview(nextPreview);
    } catch {
      // Keep the selected file preview if compression is unavailable in this browser.
    } finally {
      if (mounted.current && previewVersion.current === version) setPreviewBusy(false);
    }
  };

  const linkEvidence = async (evidenceMediaId: string) => {
    setLinking(true);
    setUploadError(undefined);
    const saved = await onCompleteWithEvidence(evidenceMediaId);
    setLinking(false);
    if (saved) {
      setUploadedMediaId(undefined);
      setSelectedFile(undefined);
      setUploadError(undefined);
    } else {
      setUploadError('Ảnh đã tải lên nhưng chưa gắn vào việc. Hãy thử lưu lại.');
    }
    return saved;
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(undefined);
    try {
      const evidenceMediaId = await uploadChecklistEvidence(file, { onProgress: setUploadProgress });
      setUploadedMediaId(evidenceMediaId);
      await linkEvidence(evidenceMediaId);
    } catch (caught) {
      const message = errorMessage(caught);
      setUploadError(message);
      toast.push(message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const selectPhoto = (file: File) => {
    const version = ++previewVersion.current;
    setSelectedFile(file);
    setPhotoName(file.name);
    setPreview(URL.createObjectURL(file));
    setPreviewBusy(true);
    setUploadError(undefined);
    setUploadedMediaId(undefined);
    void makeLowResolutionPreview(file, version);
    void uploadFile(file);
  };

  const openPhotoPicker = () => input.current?.click();
  const retry = () => {
    if (uploadedMediaId) void linkEvidence(uploadedMediaId);
    else if (selectedFile) void uploadFile(selectedFile);
  };
  const imageSrc = selectedFile ? preview ?? item.evidenceImageUrl : item.evidenceImageUrl ?? preview;
  const hasImage = !!imageSrc;
  const photoActionBusy = uploading || linking || busy;
  const photoStatus = uploading
    ? `Đang tải ảnh ${uploadProgress}%`
    : linking || busy
      ? 'Đang gắn ảnh vào việc'
      : previewBusy
        ? 'Đang tạo ảnh xem trước'
        : uploadedMediaId
          ? 'Ảnh đã tải lên, chưa gắn'
          : uploadError ?? (item.evidenceMediaId || item.evidenceImageUrl ? 'Ảnh bằng chứng đã lưu' : 'Ảnh đã chọn');

  return (
    <li className={cn('rounded-xl ring-1 transition', item.done ? 'bg-emerald-50/70 ring-emerald-100' : 'bg-white ring-gray-200/80')}>
      <div className={cn('flex items-center gap-3', large ? 'px-3 py-3' : 'px-3 py-2')}>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) selectPhoto(file);
          }}
        />
        <button
          type="button"
          role="checkbox"
          aria-checked={item.done}
          aria-label={item.done ? `Đã hoàn tất: ${item.name}` : `Chọn ảnh để hoàn tất: ${item.name}`}
          disabled={!editable || item.done || photoActionBusy}
          onClick={openPhotoPicker}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg ring-2 transition disabled:cursor-default',
            large ? 'h-9 w-9' : 'h-6 w-6',
            item.done ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-transparent ring-gray-300',
            editable && !item.done && 'hover:ring-emerald-500',
            busy && 'opacity-60',
          )}
        >
          <Check size={large ? 20 : 15} strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('font-medium', large ? 'text-base' : 'text-sm', item.done ? 'text-emerald-900' : 'text-gray-900')}>{item.name}</p>
          {item.doneAt && item.done && (
            <p className="text-xs text-gray-500">
              {formatTime(item.doneAt)}
              {item.doer ? ` · ${item.doer.fullName}` : ''}
            </p>
          )}
        </div>
        {editable && !noting && (
          <button
            type="button"
            onClick={onStartNote}
            title={item.note ? 'Sửa ghi chú' : 'Thêm ghi chú'}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <MessageSquarePlus size={16} />
          </button>
        )}
      </div>
      {(editable || hasImage) && (
        <div className={cn('flex items-center gap-3 px-3 pb-2.5', large && 'pb-3')}>
          {hasImage ? (
            <>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label={`Xem ảnh bằng chứng: ${item.name}`}
                className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-emerald-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <img src={imageSrc} alt="" className="h-full w-full object-cover" />
              </button>
              <span className="min-w-0 flex-1 truncate text-xs text-gray-600">{photoStatus}{photoName ? ` · ${photoName}` : ''}</span>
            </>
          ) : (
            <span className="min-w-0 flex-1 text-xs text-gray-500">{item.done ? 'Đã hoàn tất · chưa có ảnh bằng chứng' : 'Cần ảnh để đánh dấu hoàn tất'}</span>
          )}
          {uploadedMediaId && !photoActionBusy && (
            <button type="button" onClick={retry} className="shrink-0 text-xs font-semibold text-emerald-800 hover:text-emerald-950">
              Thử lưu lại
            </button>
          )}
          {uploadError && selectedFile && !uploadedMediaId && !photoActionBusy && (
            <button type="button" onClick={retry} className="shrink-0 text-xs font-semibold text-emerald-800 hover:text-emerald-950">
              Tải lại
            </button>
          )}
          {editable && (
            <button
              type="button"
              disabled={photoActionBusy || !!uploadedMediaId}
              onClick={openPhotoPicker}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              <Camera size={14} /> {hasImage ? 'Đổi ảnh' : 'Chụp ảnh'}
            </button>
          )}
        </div>
      )}
      {noting ? (
        <div className="px-3 pb-2.5">
          <input
            autoFocus
            value={draft}
            maxLength={200}
            onChange={(event) => onDraftChange(event.target.value)}
            onBlur={onSaveNote}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSaveNote();
              if (event.key === 'Escape') onCancelNote();
            }}
            placeholder="Ghi chú ngắn, Enter để lưu"
            className="h-9 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      ) : (
        item.note && <p className="px-3 pb-2 text-xs text-gray-600">{item.note}</p>
      )}
      <Lightbox
        open={lightboxOpen && !!imageSrc}
        onClose={() => setLightboxOpen(false)}
        images={imageSrc ? [{ src: imageSrc, alt: `Ảnh bằng chứng: ${item.name}` }] : []}
        caption="Ảnh bằng chứng"
      />
    </li>
  );
}
