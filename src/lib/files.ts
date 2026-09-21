// Kiểm tra tệp bằng byte đầu, không tin phần mở rộng.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const INLINE_LIMIT = 1024 * 1024;

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

/** Đọc ảnh và trả về nguồn hiển thị. Ảnh nhỏ lưu dạng data URL, ảnh lớn giữ bằng object URL. */
export async function readImageFile(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Ảnh vượt quá 10 MB');
  }
  const bytes = await magic(file);
  if (!isJpeg(bytes) && !isPng(bytes) && !isWebp(bytes)) {
    throw new Error('Tệp không phải ảnh JPEG, PNG hoặc WebP');
  }
  if (file.size <= INLINE_LIMIT) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Không đọc được tệp ảnh'));
      reader.readAsDataURL(file);
    });
  }
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
