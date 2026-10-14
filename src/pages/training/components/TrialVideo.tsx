// Video lần chạy thử: ô chọn và tải video lên (HLV trưởng, lúc ghi thời gian hoặc gắn sau buổi) và nút xem video (mọi người xem được kết quả).
// Video tải thẳng lên kho lưu trữ qua link đã ký, có thanh tiến độ và hủy được. Link xem có hạn 15 phút: hết hạn thì tải lại danh sách.
import { useEffect, useRef, useState } from 'react';
import { Film, Play, RotateCcw, X } from 'lucide-react';
import { checkTrialVideo, uploadTrialVideo } from '../../../api/media';
import { updateTrialVideo } from '../../../api/training';
import { Button, Modal, cn } from '../../../components/ui';
import { useFileDrop } from '../../../hooks/useFileDrop';
import { useAction } from '../../../hooks/useService';
import { errorMessage } from '../../../lib/errors';
import { VIDEO_ACCEPT } from '../../../lib/files';

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB` : `${Math.ceil(bytes / 1024)} KB`);

export interface VideoUploadState {
  /** Đang tải lên: chưa ghi kết quả được. */
  uploading: boolean;
  /** Id tệp đã tải xong, gửi kèm khi ghi kết quả chạy thử. */
  mediaId?: string;
}

/**
 * Ô "Video lần chạy": chọn hoặc kéo thả tệp, kiểm định dạng và dung lượng, tải lên ngay và báo phần trăm.
 * Báo trạng thái ra ngoài qua `onChange` để hộp ghi thời gian khóa nút lưu khi đang tải.
 */
export function TrialVideoPicker({ onChange, disabled, optional = true }: { onChange: (state: VideoUploadState) => void; disabled?: boolean; optional?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  // Đóng hộp giữa chừng thì hủy lượt tải đang chạy.
  useEffect(() => () => abort.current?.abort(), []);

  const start = async (next: File) => {
    abort.current?.abort();
    setFile(next);
    setError(undefined);
    setProgress(0);
    try {
      await checkTrialVideo(next);
    } catch (caught) {
      setStatus('error');
      setError(errorMessage(caught));
      onChange({ uploading: false });
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setStatus('uploading');
    onChange({ uploading: true });
    try {
      const mediaId = await uploadTrialVideo(next, { onProgress: setProgress, signal: controller.signal });
      if (controller.signal.aborted) return;
      setStatus('done');
      onChange({ uploading: false, mediaId });
    } catch (caught) {
      if (controller.signal.aborted) return;
      setStatus('error');
      setError(errorMessage(caught));
      onChange({ uploading: false });
    }
  };

  const clear = () => {
    abort.current?.abort();
    abort.current = null;
    setFile(null);
    setStatus('idle');
    setError(undefined);
    setProgress(0);
    onChange({ uploading: false });
    if (input.current) input.current.value = '';
  };

  const { dragging, bind } = useFileDrop((dropped) => void start(dropped), { disabled: disabled || status === 'uploading' });

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-gray-600">
        Video lần chạy {optional && <span className="font-normal text-gray-400">(không bắt buộc)</span>}
      </p>
      <input ref={input} type="file" accept={VIDEO_ACCEPT} className="hidden" onChange={(event) => event.target.files?.[0] && void start(event.target.files[0])} />
      {!file ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          {...bind}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60',
            dragging ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50/60 hover:border-emerald-300 hover:bg-emerald-50/40',
          )}
        >
          <Film size={20} className="shrink-0 text-emerald-700" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-800">Chọn hoặc kéo video vào đây</span>
            <span className="block text-xs text-gray-500">MP4, MOV hoặc WebM, tối đa 200 MB. Chủ ngựa xem được video này.</span>
          </span>
        </button>
      ) : (
        <div className={cn('rounded-xl p-3 ring-1', status === 'error' ? 'bg-red-50/60 ring-red-200' : status === 'done' ? 'bg-emerald-50/60 ring-emerald-200' : 'bg-gray-50 ring-gray-200')}>
          <div className="flex items-center gap-3">
            <Film size={18} className={cn('shrink-0', status === 'error' ? 'text-red-600' : 'text-emerald-700')} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">
                {formatSize(file.size)}
                {status === 'uploading' && ` · đang tải ${progress}%`}
                {status === 'done' && ' · đã tải xong'}
              </p>
            </div>
            {status === 'error' && (
              <Button variant="inline" size="sm" onClick={() => void start(file)}>
                <RotateCcw size={13} /> Thử lại
              </Button>
            )}
            <Button variant="ghost" size="icon" title={status === 'uploading' ? 'Hủy tải video' : 'Bỏ video'} onClick={clear}>
              <X size={15} />
            </Button>
          </div>
          {status === 'uploading' && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-gray-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>
          )}
          {error && <p className="mt-1.5 text-xs font-medium text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}

/** Nút "Xem video" mở hộp phát video. Link hết hạn (quá 15 phút) thì gọi `onExpired` để nơi dùng tải lại danh sách. */
export function TrialVideoButton({
  url,
  title,
  onExpired,
  size = 'sm',
  label = 'Xem video',
}: {
  url: string | null | undefined;
  title: string;
  onExpired?: () => void;
  size?: 'sm' | 'icon';
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  if (!url) return null;
  return (
    <>
      {size === 'icon' ? (
        <Button variant="ghost" size="icon" title="Xem video lần chạy" onClick={() => setOpen(true)}>
          <Play size={14} />
        </Button>
      ) : (
        <Button variant="inline" size="sm" onClick={() => setOpen(true)}>
          <Play size={13} /> {label}
        </Button>
      )}
      {open && (
        <Modal
          open
          onClose={() => {
            setOpen(false);
            setBroken(false);
          }}
          title={title}
          width="max-w-3xl"
        >
          {broken ? (
            <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-600">
              <p>Link xem video đã hết hạn.</p>
              {onExpired && (
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    setOpen(false);
                    setBroken(false);
                    onExpired();
                  }}
                >
                  <RotateCcw size={14} /> Tải lại để xem
                </Button>
              )}
            </div>
          ) : (
            <video src={url} controls autoPlay playsInline className="max-h-[70vh] w-full rounded-xl bg-black" onError={() => setBroken(true)} />
          )}
        </Modal>
      )}
    </>
  );
}

/** HLV của lớp gắn hoặc đổi video cho một lần chạy đã ghi, kể cả sau khi buổi xong. */
export function TrialVideoAttachDialog({
  participantId,
  attemptNo,
  replacing,
  onClose,
  onDone,
}: {
  participantId: string;
  attemptNo: number;
  replacing: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [video, setVideo] = useState<VideoUploadState>({ uploading: false });
  const save = useAction();
  const submit = () => {
    if (!video.mediaId) return;
    void save.run(() => updateTrialVideo(participantId, attemptNo, video.mediaId ?? null), onDone);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={replacing ? `Đổi video lần chạy ${attemptNo}` : `Gắn video lần chạy ${attemptNo}`}
      description={replacing ? 'Video mới sẽ thay video cũ.' : undefined}
      dirty={!!video.mediaId || video.uploading}
      onSave={submit}
      saveLabel="Lưu"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={!video.mediaId || video.uploading || save.pending}>
            {save.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <TrialVideoPicker onChange={setVideo} optional={false} disabled={save.pending} />
      {save.error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{save.error}</p>}
    </Modal>
  );
}
