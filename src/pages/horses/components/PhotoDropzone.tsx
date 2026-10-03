// Ô ảnh lớn ở thẻ hồ sơ khi thêm / sửa ngựa: bấm hoặc kéo thả ảnh vào để chọn, có ảnh thì tên và số chip
// nằm trên ảnh. Chỉ chọn và xem trước — tệp được tải lên khi bấm lưu hồ sơ.
import { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { IMAGE_ACCEPT, getRealMimeType } from '../../../lib/files';
import { useFileDrop } from '../../../hooks/useFileDrop';
import { TurfPlaceholder } from '../../../components/TurfPlaceholder';
import { cn } from '../../../components/ui';

export function PhotoDropzone({
  preview,
  name,
  chip,
  onPick,
  onClear,
  disabled,
  error,
}: {
  preview?: string;
  name: string;
  chip?: string;
  onPick: (file: File, preview: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [readError, setReadError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setReadError(undefined);
    setBusy(true);
    try {
      await getRealMimeType(file); // Check magic number first
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.4, // Max size around 400kb
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      const processedFile = new File([compressed], file.name, { type: compressed.type });
      onPick(processedFile, URL.createObjectURL(processedFile));
    } catch (caught) {
      setReadError(caught instanceof Error ? caught.message : 'Không đọc được ảnh');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const { dragging, bind } = useFileDrop((file) => void pick(file), { disabled: disabled || busy });
  const message = readError ?? error;

  return (
    <div data-field="mediaId" data-invalid={message ? 'true' : undefined}>
      <button
        type="button"
        {...bind}
        onClick={() => input.current?.click()}
        disabled={disabled || busy}
        aria-label={preview ? 'Đổi ảnh ngựa' : 'Thêm ảnh ngựa'}
        className={cn(
          'group relative block aspect-[4/3] w-full overflow-hidden text-left outline-none transition focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-emerald-500/40 disabled:cursor-default',
          dragging && 'ring-4 ring-inset ring-emerald-500',
        )}
      >
        {preview ? (
          <img src={preview} alt={name || 'Ảnh ngựa'} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
        ) : (
          <TurfPlaceholder name={name || undefined} className="absolute inset-0" />
        )}
        <span className={cn('absolute inset-0 bg-linear-to-t transition', preview ? 'from-emerald-950/80 via-emerald-950/10 to-transparent' : 'from-emerald-950/45 via-transparent to-transparent')} />

        {!preview && !disabled && (
          <span className="absolute inset-x-0 top-5 flex flex-col items-center gap-1.5 text-center">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/90 px-3.5 py-2 text-sm font-semibold text-emerald-900 shadow-[0_12px_28px_-16px_rgba(6,78,59,0.7)] ring-1 ring-emerald-900/10 transition group-hover:bg-white">
              <ImagePlus size={15} /> Bấm hoặc kéo ảnh vào đây
            </span>
            <span className="text-[11px] font-medium text-emerald-950/60">JPG, PNG hoặc WebP, tối đa 10 MB</span>
          </span>
        )}
        {preview && !disabled && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-800 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
            <Camera size={13} /> Đổi ảnh
          </span>
        )}

        <span className="absolute inset-x-0 bottom-0 p-5">
          <span className="block truncate text-2xl font-bold tracking-tight text-white drop-shadow-sm">{name.trim() || 'Ngựa chưa đặt tên'}</span>
          <span className="block truncate font-mono text-xs text-white/75">{chip?.trim() || 'Chưa có số chip'}</span>
        </span>

        {dragging && (
          <span className="absolute inset-0 flex items-center justify-center bg-emerald-950/55 text-sm font-semibold text-white backdrop-blur-[2px]">
            <ImagePlus size={18} className="mr-2" /> Thả ảnh vào đây
          </span>
        )}
      </button>
      <input ref={input} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(event) => pick(event.target.files?.[0])} />
      {(preview && onClear && !disabled) || message ? (
        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          {message ? <p className="text-xs font-medium text-red-600">{message}</p> : <span />}
          {preview && onClear && !disabled && (
            <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-red-600">
              <Trash2 size={12} /> Gỡ ảnh
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
