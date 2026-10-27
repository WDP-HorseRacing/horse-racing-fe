// Tải tệp lên kho lưu trữ theo 3 bước: xin link → PUT tệp → xác nhận. Dùng cho ảnh ngựa, video chạy thử, ảnh sự cố.
import { AppError } from '../lib/errors';
import { MAX_VIDEO_BYTES, getRealMimeType, getVideoMimeType } from '../lib/files';
import { http } from './http';
import type { UploadRequest } from './types';

type MediaPurpose = 'HORSE_PHOTO' | 'TRIAL_VIDEO' | 'INCIDENT_PHOTO';

interface UploadOptions {
  /** Phần trăm đã tải (0 đến 100). */
  onProgress?: (percent: number) => void;
  /** Hủy giữa chừng. */
  signal?: AbortSignal;
  /** Ô lỗi để gắn câu báo (xem fieldFromMessage). */
  field: string;
  /** Câu báo khi không gửi được tệp tới kho lưu trữ. */
  networkMessage: string;
}

/** PUT tệp lên link đã ký bằng XHR để có tiến độ và hủy được (fetch không báo tiến độ tải lên). */
function putFile(upload: UploadRequest, file: File, mimeType: string, options: UploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method ?? 'PUT', upload.uploadUrl);
    // Link ký kèm Content-Type: gửi đúng giá trị BE trả trong headers, lệch thì kho trả 403.
    // Content-Length do trình duyệt tự đặt từ File (khớp byteSize đã khai).
    const headers = Object.entries(upload.headers ?? {});
    const signedType = headers.find(([key]) => key.toLowerCase() === 'content-type')?.[1];
    xhr.setRequestHeader('Content-Type', signedType ?? mimeType);
    headers.forEach(([key, value]) => {
      const name = key.toLowerCase();
      if (name !== 'content-length' && name !== 'content-type') xhr.setRequestHeader(key, value);
    });
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new AppError('Kho lưu trữ từ chối tệp, vui lòng thử lại', options.field)));
    xhr.onerror = () => reject(new AppError(options.networkMessage, options.field));
    xhr.onabort = () => reject(new AppError('Đã hủy tải tệp lên', options.field));
    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

async function uploadMedia(file: File, purpose: MediaPurpose, mimeType: string, options: UploadOptions): Promise<string> {
  const upload = await http.post<UploadRequest>('/media/upload-requests', { purpose, fileName: file.name, mimeType, byteSize: file.size });
  if (options.signal?.aborted) throw new AppError('Đã hủy tải tệp lên', options.field);
  await putFile(upload, file, mimeType, options);
  await http.post(`/media/${upload.assetId}/complete`);
  options.onProgress?.(100);
  return upload.assetId;
}

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** Trả về mediaId để gắn vào hồ sơ ngựa (POST/PATCH /horses). */
export async function uploadHorsePhoto(file: File): Promise<string> {
  const mimeType = await getRealMimeType(file).catch(() => {
    throw new AppError('Ảnh đại diện phải có định dạng JPEG, PNG hoặc WebP', 'mediaId');
  });
  if (!PHOTO_TYPES.includes(mimeType)) throw new AppError('Ảnh đại diện phải có định dạng JPEG, PNG hoặc WebP', 'mediaId');
  if (file.size > PHOTO_MAX_BYTES) throw new AppError('Ảnh đại diện không được vượt quá 10 MB', 'mediaId');
  return uploadMedia(file, 'HORSE_PHOTO', mimeType, {
    field: 'mediaId',
    networkMessage: 'Chưa tải được ảnh lên, vui lòng thử lại',
  });
}

/** Kiểm định dạng (theo nội dung tệp) và dung lượng video chạy thử. Trả về mime để khai báo khi tải lên. */
export async function checkTrialVideo(file: File): Promise<string> {
  const mimeType = await getVideoMimeType(file).catch(() => {
    throw new AppError('Video chạy thử phải có định dạng MP4, WebM hoặc QuickTime', 'videoMediaId');
  });
  if (file.size === 0) throw new AppError('Tệp video rỗng', 'videoMediaId');
  if (file.size > MAX_VIDEO_BYTES) throw new AppError('Video chạy thử không được vượt quá 200 MB', 'videoMediaId');
  return mimeType;
}

/** Tải video chạy thử (chỉ HLV trưởng), trả về videoMediaId để gắn khi ghi kết quả chạy thử. */
export async function uploadTrialVideo(file: File, options: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {}): Promise<string> {
  const mimeType = await checkTrialVideo(file);
  return uploadMedia(file, 'TRIAL_VIDEO', mimeType, {
    ...options,
    field: 'videoMediaId',
    networkMessage: 'Chưa tải được video lên, vui lòng kiểm tra mạng rồi thử lại',
  });
}

/** Kiểm ảnh sự cố theo nội dung tệp. Trả về mime để khai báo khi tải lên. */
export async function checkIncidentPhoto(file: File): Promise<string> {
  const mimeType = await getRealMimeType(file).catch(() => {
    throw new AppError('Ảnh sự cố phải có định dạng JPEG, PNG hoặc WebP', 'photoMediaId');
  });
  if (!PHOTO_TYPES.includes(mimeType)) throw new AppError('Ảnh sự cố phải có định dạng JPEG, PNG hoặc WebP', 'photoMediaId');
  if (file.size === 0) throw new AppError('Tệp ảnh rỗng', 'photoMediaId');
  if (file.size > PHOTO_MAX_BYTES) throw new AppError('Ảnh sự cố không được vượt quá 10 MB', 'photoMediaId');
  return mimeType;
}

/** Tải ảnh sự cố (chỉ Groom), trả về photoMediaId để gắn khi báo sự cố. Mỗi ảnh gắn cho một sự cố. */
export async function uploadIncidentPhoto(file: File, options: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {}): Promise<string> {
  const mimeType = await checkIncidentPhoto(file);
  return uploadMedia(file, 'INCIDENT_PHOTO', mimeType, {
    ...options,
    field: 'photoMediaId',
    networkMessage: 'Chưa tải được ảnh lên, vui lòng kiểm tra mạng rồi thử lại',
  });
}
