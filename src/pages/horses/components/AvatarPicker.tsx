// Chọn ảnh đại diện: JPEG/PNG/WebP ≤ 10 MB, kiểm tra bằng byte đầu của tệp.
import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { readImageFile } from '../../../lib/files';
import { Avatar, Button, cn } from '../../../components/ui';

export default function AvatarPicker({
  value,
  name,
  onChange,
  disabled,
  size = 96,
  className = '',
}: {
  value?: string;
  name: string;
  onChange: (value: string | undefined) => void;
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
      onChange(await readImageFile(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không đọc được ảnh');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <Avatar src={value} name={name || '?'} size={size} className="rounded-2xl" />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="soft" disabled={disabled || busy} onClick={() => input.current?.click()}>
            <ImagePlus size={14} /> {value ? 'Đổi ảnh' : 'Tải ảnh lên'}
          </Button>
          {value && (
            <Button size="sm" variant="ghost" disabled={disabled || busy} onClick={() => onChange(undefined)}>
              <Trash2 size={14} /> Gỡ ảnh
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500">JPEG, PNG hoặc WebP, tối đa 10 MB</p>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => pick(event.target.files?.[0])}
      />
    </div>
  );
}
