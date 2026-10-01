// Ảnh lớn của ngựa ở hồ sơ (và bản nhỏ ở hồ sơ y tế). Bấm để xem ảnh lớn; CM rê chuột thấy "Đổi ảnh",
// hoặc kéo thả ảnh vào. Chưa có ảnh thì hiện họa tiết sọc cỏ. Link ảnh ký sẵn hết hạn (15 phút) thì lấy lại một lần.
import { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Maximize2 } from 'lucide-react';
import { IMAGE_ACCEPT } from '../../../lib/files';
import { useFileDrop } from '../../../hooks/useFileDrop';
import { Lightbox } from '../../../components/Lightbox';
import { TurfPlaceholder } from '../../../components/TurfPlaceholder';
import { cn } from '../../../components/ui';

export function HorseMedia({
  src,
  name,
  loading,
  canEdit,
  pending,
  onPick,
  onExpired,
  className = '',
}: {
  src?: string;
  name: string;
  /** Đang lấy link ảnh. */
  loading?: boolean;
  canEdit?: boolean;
  /** Đang tải ảnh mới lên. */
  pending?: boolean;
  onPick?: (file: File) => void;
  /** Ảnh lỗi (thường do link hết hạn): gọi để lấy link mới. */
  onExpired?: () => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState(false);
  const [state, setState] = useState<{ src?: string; status: 'loading' | 'loaded' | 'failed'; retried: boolean }>({ src, status: 'loading', retried: false });
  if (state.src !== src) setState((current) => ({ src, status: 'loading', retried: current.retried && !!src }));
  const status = state.status;
  const editable = canEdit && !!onPick;
  const { dragging, bind } = useFileDrop((file) => onPick?.(file), { disabled: !editable || pending });
  const showImage = !!src && status !== 'failed';

  return (
    <div
      {...bind}
      className={cn('group relative isolate overflow-hidden rounded-2xl bg-emerald-950/5', className)}
    >
      <TurfPlaceholder name={name} className="absolute inset-0" />
      {loading && !src && <div className="skeleton absolute inset-0 rounded-none" />}
      {showImage && (
        <img
          src={src}
          alt={name}
          decoding="async"
          onLoad={() => setState((current) => ({ ...current, status: 'loaded' }))}
          onError={() => {
            setState((current) => ({ ...current, status: 'failed' }));
            if (!state.retried) {
              setState((current) => ({ ...current, retried: true }));
              onExpired?.();
            }
          }}
          className={cn('absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]', status === 'loaded' ? 'opacity-100' : 'opacity-0')}
        />
      )}

      {/* Bấm vào ảnh để xem lớn */}
      {showImage && status === 'loaded' && (
        <button type="button" onClick={() => setZoom(true)} className="absolute inset-0 z-10 cursor-zoom-in" aria-label={`Xem ảnh lớn của ${name}`}>
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <Maximize2 size={12} /> Xem ảnh lớn
          </span>
        </button>
      )}

      {/* Chưa có ảnh */}
      {!src && !loading && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center p-4">
          {editable ? (
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-white/90 px-3.5 py-2 text-sm font-semibold text-emerald-900 shadow-[0_12px_28px_-16px_rgba(6,78,59,0.7)] ring-1 ring-emerald-900/10 backdrop-blur transition hover:bg-white"
            >
              <ImagePlus size={15} /> Thêm ảnh
            </button>
          ) : (
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-emerald-900/70 backdrop-blur">Chưa có ảnh</span>
          )}
        </div>
      )}

      {/* CM đổi ảnh */}
      {editable && src && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={pending}
          className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-800 opacity-0 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Camera size={13} /> Đổi ảnh
        </button>
      )}

      {/* Kéo thả hoặc đang tải lên */}
      {(dragging || pending) && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-emerald-950/55 text-sm font-semibold text-white backdrop-blur-[2px]">
          {pending ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={22} />}
          {pending ? 'Đang tải ảnh lên…' : 'Thả ảnh vào đây'}
        </div>
      )}

      {editable && (
        <input ref={input} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick?.(file);
          event.target.value = '';
        }} />
      )}
      {src && <Lightbox open={zoom} onClose={() => setZoom(false)} images={[{ src, alt: name }]} caption={name} />}
    </div>
  );
}
