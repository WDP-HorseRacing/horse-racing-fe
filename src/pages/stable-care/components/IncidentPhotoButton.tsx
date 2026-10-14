// Nút "Xem ảnh" trên yêu cầu khám nguồn "Groom báo" (hàng đợi của bác sĩ).
// Yêu cầu khám có `incidentId` của sự cố sinh ra nó: bấm thì mới tải sự cố đó để lấy ảnh. Không gắn sự cố thì không hiện nút.
import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getIncident } from '../../../api/stable-care';
import type { ExamRequest } from '../../../api/types';
import { Lightbox } from '../../../components/Lightbox';
import { Button, useToast } from '../../../components/ui';
import { errorMessage } from '../../../lib/errors';

export function IncidentPhotoButton({ request, size = 'sm' }: { request: Pick<ExamRequest, 'horseName' | 'source' | 'incidentId'>; size?: 'sm' | 'icon' }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<{ src: string; caption: string } | null>(null);
  const incidentId = request.incidentId;
  if (request.source !== 'GROOM_INCIDENT' || !incidentId) return null;

  const open = async () => {
    setLoading(true);
    try {
      const incident = await getIncident(incidentId);
      if (!incident.photoUrl) toast.push('Sự cố này không có ảnh', 'info');
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
