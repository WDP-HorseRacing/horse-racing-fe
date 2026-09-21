import { useRef, useState } from 'react';
import { ImagePlus, Star, Trash2 } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import { addPhoto, listPhotos, removePhoto, setAvatarPhoto } from '../../../services/horse.service';
import { useStore } from '../../../store/store';
import { can } from '../../../auth/permissions';
import { Button, Card, EmptyState, ErrorBox, Pill, Skeleton } from '../../../components/ui';
import { readImageFile } from '../../../lib/files';

export default function PhotosTab({ horseId }: { horseId: string }) {
  const currentUser = useStore((state) => state.currentUser);
  const canAdd = can(currentUser, 'photo.add');
  const canManage = can(currentUser, 'photo.manage');
  const { data, loading, reload } = useService(() => listPhotos(horseId), [horseId]);
  const action = useAction();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string>();

  const upload = async (file: File) => {
    setFileError(undefined);
    try {
      const src = await readImageFile(file);
      const done = await action.run(() => addPhoto(horseId, src, file.name));
      if (done !== undefined) reload();
    } catch (caught) {
      setFileError(caught instanceof Error ? caught.message : 'Không đọc được tệp ảnh');
    }
  };

  if (loading) return <Skeleton rows={3} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-light text-gray-500">
          Chỉ nhận JPEG, PNG hoặc WebP, tối đa 10 MB. Hệ thống kiểm tra nội dung thật của tệp, không tin phần mở rộng.
        </p>
        {canAdd && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = '';
              }}
            />
            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={action.pending}>
              <ImagePlus size={14} /> {action.pending ? 'Đang tải…' : 'Tải ảnh lên'}
            </Button>
          </>
        )}
      </div>

      {(fileError || action.error) && <ErrorBox message={fileError ?? action.error!} />}

      {(data?.length ?? 0) === 0 ? (
        <EmptyState title="Chưa có ảnh nào" hint="Tải ảnh đầu tiên cho hồ sơ ngựa này." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data?.map((photo) => (
            <Card key={photo.id} className="overflow-hidden p-0">
              <div className="aspect-4/3 w-full overflow-hidden bg-gray-50">
                <img src={photo.src} alt={photo.caption ?? 'Ảnh hồ sơ ngựa'} className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                {photo.isAvatar ? (
                  <Pill tone="green">Ảnh đại diện</Pill>
                ) : (
                  <span className="truncate text-xs text-gray-400">{photo.caption ?? 'Ảnh hồ sơ'}</span>
                )}
                {canManage && !photo.isAvatar && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      title="Đặt làm ảnh đại diện"
                      onClick={async () => {
                        const done = await action.run(() => setAvatarPhoto(photo.id));
                        if (done !== undefined) reload();
                      }}
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                    >
                      <Star size={14} />
                    </button>
                    <button
                      title="Gỡ ảnh"
                      onClick={async () => {
                        const done = await action.run(() => removePhoto(photo.id));
                        if (done !== undefined) reload();
                      }}
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
