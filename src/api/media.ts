// Tải ảnh ngựa lên kho lưu trữ theo 3 bước: xin link → PUT tệp → xác nhận.
import { AppError } from '../lib/errors';
import { http } from './http';
import type { UploadRequest } from './types';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

/** Trả về mediaId để gắn vào hồ sơ ngựa (POST/PATCH /horses). */
export async function uploadHorsePhoto(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new AppError('Ảnh đại diện phải có định dạng JPEG, PNG hoặc WebP', 'mediaId');
  if (file.size > MAX_BYTES) throw new AppError('Ảnh đại diện không được vượt quá 10 MB', 'mediaId');

  const upload = await http.post<UploadRequest>('/media/upload-requests', {
    purpose: 'HORSE_PHOTO',
    fileName: file.name,
    mimeType: file.type,
    byteSize: file.size,
  });
  // Trình duyệt tự đặt Content-Length; chỉ cần gửi đúng Content-Type đã ký.
  const headers: Record<string, string> = {};
  Object.entries(upload.headers ?? {}).forEach(([key, value]) => {
    if (key.toLowerCase() !== 'content-length') headers[key] = value;
  });
  let response: Response;
  try {
    response = await fetch(upload.uploadUrl, { method: upload.method ?? 'PUT', headers, body: file });
  } catch {
    throw new AppError('Không tải được ảnh lên kho lưu trữ. Kiểm tra dịch vụ lưu trữ ảnh đang chạy.', 'mediaId');
  }
  if (!response.ok) throw new AppError('Kho lưu trữ từ chối tệp ảnh, vui lòng thử lại', 'mediaId');
  await http.post(`/media/${upload.assetId}/complete`);
  return upload.assetId;
}
