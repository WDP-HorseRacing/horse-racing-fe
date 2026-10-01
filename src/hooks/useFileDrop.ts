// Kéo thả một tệp vào một vùng: trả về cờ đang kéo và các handler gắn vào phần tử.
import { useRef, useState, type DragEvent } from 'react';

export function useFileDrop(onFile: (file: File) => void, { disabled = false }: { disabled?: boolean } = {}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const hasFile = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
  const bind = {
    onDragEnter: (event: DragEvent) => {
      if (disabled || !hasFile(event)) return;
      event.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (event: DragEvent) => {
      if (disabled || !hasFile(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (event: DragEvent) => {
      if (disabled || !hasFile(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (event: DragEvent) => {
      if (disabled) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
  };
  return { dragging, bind };
}
