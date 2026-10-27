// Ô "Ảnh thực tế" của báo sự cố: chọn, chụp hoặc kéo thả một ảnh, kiểm định dạng theo nội dung tệp, tải lên ngay và báo phần trăm.
// Trên điện thoại, ô chọn tệp mở luôn camera hoặc thư viện ảnh. Ảnh chỉ Groom tải được (BE chặn vai trò khác).
import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, X } from 'lucide-react';
import { checkIncidentPhoto, uploadIncidentPhoto } from '../../../api/media';
import { Button, cn } from '../../../components/ui';
import { useFileDrop } from '../../../hooks/useFileDrop';
import { errorMessage } from '../../../lib/errors';

export interface PhotoUploadState {
  uploading: boolean;
  mediaId?: string;
  /** Đã chọn ảnh nhưng kiểm hoặc tải lên lỗi: gửi lúc này sẽ không kèm ảnh. */
  failed?: boolean;
}

const ACCEPT = 'image/jpeg,image/png,image/webp';

export function IncidentPhotoPicker({ onChange, disabled, resetKey }: { onChange: (state: PhotoUploadState) => void; disabled?: boolean; resetKey?: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const clear = () => {
    abort.current?.abort();
    abort.current = null;
    setFile(null);
    setPreview(undefined);
    setStatus('idle');
    setError(undefined);
    setProgress(0);
    onChange({ uploading: false });
    if (input.current) input.current.value = '';
  };

  // Gửi báo cáo xong thì nơi dùng đổi resetKey để làm trống ô.
  const [seenKey, setSeenKey] = useState(resetKey);
  if (resetKey !== seenKey) {
    setSeenKey(resetKey);
    setFile(null);
    setPreview(undefined);
    setStatus('idle');
    setError(undefined);
    setProgress(0);
  }

  const start = async (next: File) => {
    abort.current?.abort();
    setFile(next);
    setError(undefined);
    setProgress(0);
    try {
      await checkIncidentPhoto(next);
    } catch (caught) {
      setPreview(undefined);
      setStatus('error');
      setError(errorMessage(caught));
      onChange({ uploading: false, failed: true });
      return;
    }
    setPreview(URL.createObjectURL(next));
    const controller = new AbortController();
    abort.current = controller;
    setStatus('uploading');
    onChange({ uploading: true });
    try {
      const mediaId = await uploadIncidentPhoto(next, { onProgress: setProgress, signal: controller.signal });
      if (controller.signal.aborted) return;
      setStatus('done');
      onChange({ uploading: false, mediaId });
    } catch (caught) {
      if (controller.signal.aborted) return;
      setStatus('error');
      setError(errorMessage(caught));
      onChange({ uploading: false, failed: true });
    }
  };

  const { dragging, bind } = useFileDrop((dropped) => void start(dropped), { disabled: disabled || status === 'uploading' });

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-gray-600">
        Ảnh <span className="font-normal text-gray-400">(tùy chọn)</span>
      </p>
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(event) => event.target.files?.[0] && void start(event.target.files[0])} />
      {!file ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          {...bind}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60',
            dragging ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50/60 hover:border-emerald-300 hover:bg-emerald-50/40',
          )}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 ring-1 ring-emerald-100">
            <Camera size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-800">Chụp hoặc chọn ảnh</span>
            <span className="block text-xs text-gray-500">JPEG, PNG, WebP, tối đa 10 MB</span>
          </span>
        </button>
      ) : (
        <div className={cn('flex items-center gap-3 rounded-xl p-2.5 ring-1', status === 'error' ? 'bg-red-50/60 ring-red-200' : status === 'done' ? 'bg-emerald-50/60 ring-emerald-200' : 'bg-gray-50 ring-gray-200')}>
          {preview ? (
            <img src={preview} alt="Ảnh sự cố" className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-black/5" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white text-red-500 ring-1 ring-red-100">
              <Camera size={20} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{file.name}</p>
            <p className="text-xs text-gray-500">
              {status === 'uploading' ? `Đang tải ${progress}%` : status === 'done' ? 'Đã tải xong' : status === 'error' ? 'Chưa tải được' : ''}
            </p>
            {status === 'uploading' && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-gray-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-200" style={{ width: `${progress}%` }} />
              </div>
            )}
            {error && <p className="mt-1 text-xs font-medium text-red-700">{error}</p>}
          </div>
          {status === 'error' && preview && (
            <Button variant="inline" size="sm" onClick={() => void start(file)}>
              <RotateCcw size={13} /> Thử lại
            </Button>
          )}
          <Button variant="ghost" size="icon" title={status === 'uploading' ? 'Hủy tải ảnh' : 'Bỏ ảnh'} onClick={clear} disabled={disabled}>
            <X size={15} />
          </Button>
        </div>
      )}
    </div>
  );
}
