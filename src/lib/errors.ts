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
  return shortenClashList(message.replace(/\bMicrochip\b/g, 'Số chip').replace(/\bgroom\b/g, 'Groom'));
}

/** Số mục trùng giờ giữ lại trong câu báo; phần còn lại gộp thành "và N lượt trùng khác". */
const CLASH_KEEP = 2;
/** "08:30 ngày 10/10/2026" thành "08:30 10/10". */
const shortClubTime = (text: string) => text.replace(/(\d{2}:\d{2}) ngày (\d{2}\/\d{2})\/\d{4}/g, '$1 $2');

const GROOM_CLASH_HEAD = 'Người dắt bị trùng giờ: ';
const GROOM_MOVE_HEAD = 'Groom mới đang dắt lượt trùng giờ: ';

/**
 * BE liệt kê mọi cặp lượt trùng giờ của Groom trong một câu (mỗi tuần của lớp một cặp), nên câu rất dài.
 * Rút còn vài cặp đầu, viết gọn từng cặp, phần sau gộp thành "và N lượt trùng khác".
 */
export function shortenClashList(message: string): string {
  const head = message.startsWith(GROOM_CLASH_HEAD) ? GROOM_CLASH_HEAD : message.startsWith(GROOM_MOVE_HEAD) ? GROOM_MOVE_HEAD : undefined;
  if (!head) return message;
  const tailAt = message.lastIndexOf('. ');
  const body = message.slice(head.length, tailAt > head.length ? tailAt : undefined);
  const items = body.split('; ').map((item) =>
    shortClubTime(item)
      .replace(/^ngựa (.+?) ở buổi (".+?") lúc (.+?) trùng lượt ngựa (.+?) ở buổi (".+?") lúc .+$/, '$1 ở buổi $2 lúc $3 trùng với $4 (buổi $5)')
      .replace(/^buổi (".+?") lúc (.+?) trùng lượt ngựa (.+?) ở buổi (".+?") lúc .+$/, 'buổi $1 lúc $2 trùng với $3 (buổi $4)'),
  );
  const shown = items.slice(0, CLASH_KEEP).join('; ');
  const more = items.length > CLASH_KEEP ? ` và ${items.length - CLASH_KEEP} lượt trùng khác` : '';
  const title = head === GROOM_CLASH_HEAD ? 'Groom phụ trách đang dắt ngựa khác cùng giờ' : 'Groom mới đang dắt ngựa khác cùng giờ';
  const advice = head === GROOM_CLASH_HEAD ? 'Đổi giờ buổi, hoặc đổi Groom dắt ở lượt kia trước.' : 'Đổi Groom dắt ở các lượt kia trước khi đổi Groom.';
  return `${title}: ${shown}${more}. ${advice}`;
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
