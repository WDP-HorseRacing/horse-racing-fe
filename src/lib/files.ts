// Kiểm tra tệp bằng byte đầu, không tin phần mở rộng.
// Ảnh xem trước dùng object URL (blob:) trỏ vào tệp trên máy — không đổi ảnh sang chuỗi base64.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

/** Định dạng ảnh được nhận (khớp backend: JPEG, PNG, WebP). Dùng cho thuộc tính accept của ô chọn tệp. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

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

/** Chặn tệp không phải ảnh JPEG/PNG/WebP thật (xét byte đầu) hoặc lớn hơn 10 MB. */
export async function validateImageFile(file: File): Promise<void> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Ảnh vượt quá 10 MB');
  }
  const bytes = await magic(file);
  if (!isJpeg(bytes) && !isPng(bytes) && !isWebp(bytes)) {
    throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WebP');
  }
}

/**
 * Kiểm tra ảnh và trả về object URL để xem trước.
 * Người gọi thu hồi bằng URL.revokeObjectURL khi đổi ảnh hoặc rời trang (xem useObjectUrl).
 */
export async function readImageFile(file: File): Promise<string> {
  await validateImageFile(file);
  return URL.createObjectURL(file);
}

/** Kiểm tra video chạy thử. Tệp chỉ tồn tại trong phiên làm việc cho tới khi có nơi lưu trữ. */
export async function readVideoFile(file: File): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('Video vượt quá 40 MB');
  }
  const bytes = await magic(file, 12);
  const text = (start: number, end: number) => String.fromCharCode(...Array.from(bytes.slice(start, end)));
  const isMp4 = text(4, 8) === 'ftyp';
  const isWebm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (!isMp4 && !isWebm) {
    throw new Error('Tệp không phải video MP4, MOV hoặc WebM');
  }
  return URL.createObjectURL(file);
}
