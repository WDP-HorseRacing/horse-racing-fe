// Xem ảnh lớn trên nền tối. Sẵn sàng cho nhiều ảnh (mũi tên trái/phải), hiện BE chỉ có một ảnh mỗi ngựa.
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from './ui';

export interface LightboxImage {
  src: string;
  alt: string;
}

export function Lightbox({ open, onClose, images, initialIndex = 0, caption }: { open: boolean; onClose: () => void; images: LightboxImage[]; initialIndex?: number; caption?: string }) {
  const [index, setIndex] = useState(initialIndex);
  const [shownFor, setShownFor] = useState(open);
  if (open !== shownFor) {
    setShownFor(open);
    if (open) setIndex(initialIndex);
  }
  const many = images.length > 1;
  const go = (delta: number) => setIndex((current) => (current + delta + images.length) % images.length);

  useEffect(() => {
    if (!open || !many) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, many, images.length]);

  const image = images[index];
  const arrow = 'absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20';
  return (
    <Dialog.Root open={open && !!image} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-[70] bg-emerald-950/85 backdrop-blur-sm" />
        <Dialog.Content aria-describedby={undefined} className="anim-dialog fixed inset-0 z-[70] flex flex-col items-center justify-center p-4 outline-none sm:p-10">
          <Dialog.Title className="sr-only">{image?.alt ?? 'Ảnh'}</Dialog.Title>
          {image && <img src={image.src} alt={image.alt} className="max-h-[82dvh] max-w-full rounded-2xl object-contain shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)]" />}
          {(caption || many) && (
            <p className="mt-4 text-sm font-medium text-white/85">
              {caption}
              {many && <span className="ml-2 tabular-nums text-white/55">{index + 1}/{images.length}</span>}
            </p>
          )}
          {many && (
            <>
              <button type="button" onClick={() => go(-1)} className={cn(arrow, 'left-4')} aria-label="Ảnh trước">
                <ChevronLeft size={20} />
              </button>
              <button type="button" onClick={() => go(1)} className={cn(arrow, 'right-4')} aria-label="Ảnh sau">
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <Dialog.Close className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20" aria-label="Đóng">
            <X size={18} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
