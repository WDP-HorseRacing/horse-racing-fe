// Chọn ảnh đại diện: JPEG/PNG/WebP ≤ 10 MB, kiểm tra bằng byte đầu của tệp.
// Chỉ chọn và xem trước — tệp được tải lên kho lưu trữ khi người dùng bấm lưu hồ sơ.
import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { IMAGE_ACCEPT, readImageFile } from '../../../lib/files';
import { Avatar, Button, cn } from '../../../components/ui';

export default function AvatarPicker({
  preview,
  name,
  onPick,
  onClear,
  disabled,
  size = 96,
  className = '',
}: {
  /** Ảnh đang hiển thị: link ảnh hiện tại hoặc ảnh vừa chọn. */
  preview?: string;
  name: string;
  onPick: (file: File, preview: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  size?: number;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setError(undefined);
    setBusy(true);
    try {
      onPick(file, await readImageFile(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không đọc được ảnh');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <Avatar src={preview} name={name || '?'} size={size} className="rounded-2xl" />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="soft" disabled={disabled || busy} onClick={() => input.current?.click()}>
            <ImagePlus size={14} /> {preview ? 'Đổi ảnh' : 'Tải ảnh lên'}
          </Button>
          {preview && onClear && (
            <Button size="sm" variant="ghost" disabled={disabled || busy} onClick={onClear}>
              <Trash2 size={14} /> Gỡ ảnh
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500">JPG, PNG hoặc WebP, tối đa 10 MB</p>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => pick(event.target.files?.[0])}
      />
    </div>
  );
}
