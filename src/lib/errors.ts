/** Lỗi nghiệp vụ có thông báo tiếng Việt, hiển thị thẳng cho người dùng. */
export class AppError extends Error {
  field?: string;
  /** Lỗi theo từng ô nhập (tên ô trong body gửi đi → câu lỗi). Rỗng khi lỗi không gắn ô nào. */
  fieldErrors: Record<string, string> = {};
  /** Lỗi trùng (409) có thể kèm id bản ghi đang giữ giá trị đó, theo tên ô. Ví dụ số chip trùng: id con ngựa đang giữ số chip. */
  conflictIds: Record<string, string> = {};
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
  constructor(
    status: number,
    message: string,
    details: string[] | null = null,
    field?: string,
    fieldErrors: Record<string, string> = {},
    conflictIds: Record<string, string> = {},
  ) {
    super(message, field);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.fieldErrors = fieldErrors;
    this.conflictIds = conflictIds;
  }
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi';
}

/** Vài câu lỗi của backend còn thuật ngữ tiếng Anh (microchip) hoặc viết thường "groom": đổi khi hiển thị. */
export function humanizeMessage(message: string): string {
  return message.replace(/Microchip/g, 'Số chip').replace(/groom/g, 'Groom');
}

/**
 * Câu lỗi hiện ngay dưới ô: bỏ tên ô tiếng Anh ở đầu câu validate mặc định của BE
 * ("name tối đa 160 ký tự" thành "Tối đa 160 ký tự"). Câu nghiệp vụ tiếng Việt giữ nguyên.
 */
export function fieldMessage(field: string, message: string): string {
  if (!message.startsWith(`${field} `)) return message;
  const rest = message.slice(field.length + 1);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * Đoán ô nhập liên quan từ câu lỗi của backend. Chỉ dùng khi lỗi không kèm `errors` theo ô
 * (lỗi nghiệp vụ không gắn ô, ví dụ 409 dữ liệu vừa đổi).
 */
export function fieldFromMessage(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const text = message.toLowerCase();
  if (text.includes('số chip') || text.includes('microchip')) return 'microchipId';
  if (text.includes('ngày sinh') || text.includes('sinh trước')) return 'dateOfBirth';
  if (text.includes('ngựa cha') || /\bsire\b/.test(text)) return 'sireId';
  if (text.includes('ngựa mẹ') || /\bdam\b/.test(text)) return 'damId';
  if (text.includes('chủ mới')) return 'newOwnerId';
  if (text.includes('chủ sở hữu')) return 'ownerId';
  if (text.includes('khu chuồng') || text.includes('huấn luyện viên trưởng') || text.includes('head trainer')) return 'barnId';
  if (text.includes('video')) return 'videoMediaId';
  if (text.includes('ảnh') || text.includes('tệp')) return 'mediaId';
  return undefined;
}
