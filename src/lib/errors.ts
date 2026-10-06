/** Lỗi nghiệp vụ có thông báo tiếng Việt, hiển thị thẳng cho người dùng. */
export class AppError extends Error {
  field?: string;
  /** Lỗi theo từng ô nhập (tên ô trong body gửi đi → câu lỗi). Rỗng khi lỗi không gắn ô nào. */
  fieldErrors: Record<string, string> = {};
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'AppError';
    this.field = field;
  }
}

/** Lỗi trả về từ API: giữ mã HTTP để màn hình phân biệt không tìm thấy / không có quyền. */
export class ApiError extends AppError {
  status: number;
  details: string[] | null;
  constructor(status: number, message: string, details: string[] | null = null, field?: string, fieldErrors: Record<string, string> = {}) {
    super(message, field);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.fieldErrors = fieldErrors;
  }
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi';
}

/** Vài câu lỗi của backend còn lẫn thuật ngữ tiếng Anh (sire, dam, microchip) — đổi sang tiếng Việt khi hiển thị. */
export function humanizeMessage(message: string): string {
  return message
    .replace(/\bSire\b/g, 'Ngựa cha')
    .replace(/\bDam\b/g, 'Ngựa mẹ')
    .replace(/\bsire\b/g, 'cha')
    .replace(/\bdam\b/g, 'mẹ')
    .replace(/\bMicrochip\b/g, 'Số chip')
    .replace(/\bgroom\b/g, 'Groom');
}

/**
 * Đoán ô nhập liên quan từ câu lỗi của backend. Chỉ dùng khi lỗi không kèm `errors` theo ô
 * (lỗi 409, hoặc backend cũ chưa trả tên ô).
 */
export function fieldFromMessage(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const text = message.toLowerCase();
  if (text.includes('số chip') || text.includes('microchip')) return 'microchipId';
  if (text.includes('ngày mất')) return 'dateOfDeath';
  if (text.includes('ngày sinh') || text.includes('sinh trước')) return 'dateOfBirth';
  if (text.includes('ngựa cha') || /\bsire\b/.test(text)) return 'sireId';
  if (text.includes('ngựa mẹ') || /\bdam\b/.test(text)) return 'damId';
  if (text.includes('chủ mới')) return 'newOwnerId';
  if (text.includes('chủ sở hữu')) return 'ownerId';
  if (text.includes('khu chuồng') || text.includes('huấn luyện viên trưởng') || text.includes('head trainer')) return 'barnId';
  if (text.includes('ảnh') || text.includes('tệp')) return 'mediaId';
  return undefined;
}
