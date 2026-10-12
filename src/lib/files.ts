// Kiểm tra tệp bằng byte đầu, không tin phần mở rộng.
// Ảnh xem trước dùng object URL (blob:) trỏ vào tệp trên máy — không đổi ảnh sang chuỗi base64.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Video chạy thử tối đa 200 MB (khớp backend). */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

/** Định dạng ảnh được nhận (khớp backend: JPEG, PNG, WebP). Dùng cho thuộc tính accept của ô chọn tệp. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

/** Định dạng video chạy thử được nhận (khớp backend: MP4, WebM, QuickTime). */
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov';

async function magic(file: File, length = 12): Promise<Uint8Array> {
  const buffer = await file.slice(0, length).arrayBuffer();
  return new Uint8Array(buffer);
}

function isJpeg(bytes: Uint8Array) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array) {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function isWebp(bytes: Uint8Array) {
  const text = (start: number, end: number) =>
    String.fromCharCode(...Array.from(bytes.slice(start, end)));
  return text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP';
}

export async function getRealMimeType(file: File): Promise<string> {
  const bytes = await magic(file);
  if (isJpeg(bytes)) return 'image/jpeg';
  if (isPng(bytes)) return 'image/png';
  if (isWebp(bytes)) return 'image/webp';
  throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WebP');
}

/** Chặn tệp không phải ảnh JPEG/PNG/WebP thật (xét byte đầu) hoặc lớn hơn 10 MB. */
export async function validateImageFile(file: File): Promise<void> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Ảnh vượt quá 10 MB');
  }
  await getRealMimeType(file);
}

/**
 * Kiểm tra ảnh và trả về object URL để xem trước.
 * Người gọi thu hồi bằng URL.revokeObjectURL khi đổi ảnh hoặc rời trang (xem useObjectUrl).
 */
export async function readImageFile(file: File): Promise<string> {
  await validateImageFile(file);
  return URL.createObjectURL(file);
}

/**
 * Mime thật của video theo byte đầu, không tin phần mở rộng hay `file.type` (vd .m4v báo video/x-m4v mà backend không nhận).
 * MP4 và QuickTime cùng có hộp `ftyp`: brand `qt  ` là QuickTime, còn lại coi là MP4. WebM bắt đầu bằng mã EBML.
 */
export async function getVideoMimeType(file: File): Promise<string> {
  const bytes = await magic(file, 12);
  const text = (start: number, end: number) => String.fromCharCode(...Array.from(bytes.slice(start, end)));
  if (text(4, 8) === 'ftyp') return text(8, 12) === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
  throw new Error('Tệp không phải video MP4, MOV hoặc WebM');
}
