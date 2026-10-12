// Nút "Xem ảnh" trên yêu cầu khám nguồn "Groom báo" (hàng đợi của bác sĩ).
// Response yêu cầu khám chưa có incidentId (đã báo BE): bấm thì mới tải sự cố của ngựa đó và khớp theo id yêu cầu khám.
import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { listIncidents } from '../../../api/stable-care';
import type { ExamRequest } from '../../../api/types';
import { Lightbox } from '../../../components/Lightbox';
import { Button, useToast } from '../../../components/ui';
import { errorMessage } from '../../../lib/errors';

export function IncidentPhotoButton({ request, size = 'sm' }: { request: Pick<ExamRequest, 'id' | 'horseId' | 'horseName' | 'source'>; size?: 'sm' | 'icon' }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<{ src: string; caption: string } | null>(null);
  if (request.source !== 'GROOM_INCIDENT') return null;

  const open = async () => {
    setLoading(true);
    try {
      const incidents = await listIncidents({ horseId: request.horseId });
      const incident = incidents.find((item) => item.examRequest?.id === request.id);
      if (!incident) toast.push('Yêu cầu này không gắn sự cố nào nên không có ảnh (gửi trước khi có báo sự cố)', 'info');
      else if (!incident.photoUrl) toast.push('Groom không gửi kèm ảnh', 'info');
      else setPhoto({ src: incident.photoUrl, caption: incident.description });
    } catch (caught) {
      toast.push(errorMessage(caught), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {size === 'icon' ? (
        <Button variant="ghost" size="icon" title="Xem ảnh Groom chụp" disabled={loading} onClick={() => void open()}>
          <ImageIcon size={15} />
        </Button>
      ) : (
        <Button variant="inline" size="sm" disabled={loading} onClick={() => void open()}>
          <ImageIcon size={13} /> {loading ? 'Đang tải ảnh' : 'Xem ảnh'}
        </Button>
      )}
      <Lightbox open={!!photo} onClose={() => setPhoto(null)} images={photo ? [{ src: photo.src, alt: `Ảnh sự cố ${request.horseName}` }] : []} caption={photo?.caption} />
    </>
  );
}
