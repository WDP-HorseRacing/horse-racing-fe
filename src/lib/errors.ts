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

/**
 * Câu lỗi Flow 2 (huấn luyện) của backend còn lẫn mã trạng thái tiếng Anh: đổi cả câu sang tiếng Việt.
 * Khóa là câu gốc của BE (khớp nguyên văn, hoặc khớp phần đầu với câu có số đi kèm).
 */
const TRAINING_MESSAGES: [RegExp, string | ((match: RegExpMatchArray) => string)][] = [
  [/^Chỉ class DRAFT mới được kích hoạt$/, 'Chỉ lớp nháp mới kích hoạt được'],
  [/^Chỉ class ACTIVE mới được hoàn thành$/, 'Chỉ lớp đang chạy mới hoàn thành được'],
  [/^Class vẫn còn session chưa kết thúc$/, 'Lớp còn buổi tập chưa kết thúc, chưa hoàn thành lớp được'],
  [/^Class đã ở trạng thái kết thúc$/, 'Lớp đã kết thúc, không thay đổi được nữa'],
  [/^Không thể chuyển class về trạng thái DRAFT$/, 'Lớp không quay về nháp được'],
  [/^Phải phân công head trainer trước khi kích hoạt class$/, 'Lớp chưa có huấn luyện viên trưởng phụ trách'],
  [/^Không thể hủy class khi còn participant ONGOING$/, 'Còn ngựa đang chạy, chưa hủy lớp được'],
  [/^Chỉ class ACTIVE mới nhận thêm horse$/, 'Lớp phải đang chạy mới ghi danh ngựa được. Hãy kích hoạt lớp trước'],
  [/^Khoảng enrollment của Horse bị chồng lấn$/, 'Ngựa đã có trong lớp ở khoảng thời gian này'],
  [/^enrolledAt phải nằm trong thời gian class$/, 'Ngày ghi danh phải nằm trong thời gian của lớp'],
  [/^leftAt phải nằm trong thời gian class$/, 'Ngày rời lớp phải nằm trong thời gian của lớp'],
  [/^leftAt không hợp lệ$/, 'Ngày rời lớp không hợp lệ'],
  [/^Enrollment đã rời class$/, 'Ngựa đã rời lớp'],
  [/^Không tìm thấy horse enrollment$/, 'Không tìm thấy lượt ghi danh'],
  [/^Sức chứa mới không được nhỏ hơn số horse đang enroll \((\d+)\)$/, (m) => `Sĩ số tối đa không được nhỏ hơn số ngựa đang học (${m[1]})`],
  [/^Khoảng ngày mới không bao phủ các session hiện có$/, 'Ngày mới làm một số buổi tập nằm ngoài thời gian của lớp'],
  [/^Khoảng ngày mới không bao phủ các enrollment hiện có$/, 'Ngày mới làm một số lượt ghi danh nằm ngoài thời gian của lớp'],
  [/^Chỉ buổi tập DRAFT mới được publish$/, 'Buổi này đã được công bố'],
  [/^Chỉ được sửa buổi tập đang DRAFT$/, 'Chỉ sửa được buổi còn nháp'],
  [/^Class không còn ACTIVE$/, 'Lớp chưa kích hoạt hoặc đã kết thúc'],
  [/^Session TIME_TRIAL phải có cấu hình Time Trial trước khi publish$/, 'Buổi chạy thử chưa có cấu hình chạy thử'],
  [/^Session không ở trạng thái thực thi$/, 'Buổi tập chưa công bố hoặc đã kết thúc'],
  [/^Chỉ participant PLANNED mới được check-in$/, 'Lượt này đã điểm danh rồi'],
  [/^Participant phải PRESENT trước khi READY$/, 'Cần điểm danh trước khi báo sẵn sàng'],
  [/^Participant phải READY trước khi bắt đầu$/, 'Cần báo sẵn sàng trước khi bắt đầu'],
  [/^Ngựa đang có participant ONGOING khác$/, 'Ngựa đang chạy ở một buổi khác'],
  [/^Lớp chưa ACTIVE$/, 'Lớp chưa kích hoạt'],
  [/^Session chưa IN_PROGRESS$/, 'Buổi tập chưa bắt đầu hoặc đã kết thúc'],
  [/^Session không phải TIME_TRIAL$/, 'Buổi này không phải buổi chạy thử'],
  [/^Participant không được ghi Trial Result$/, 'Chỉ ghi kết quả khi ngựa đang chạy hoặc vừa chạy xong'],
  [/^Session chưa có cấu hình Time Trial$/, 'Buổi chưa có cấu hình chạy thử'],
  [/^Session đã có cấu hình Time Trial$/, 'Buổi đã có cấu hình chạy thử'],
  [/^Attempt đã tồn tại$/, 'Lần chạy này đã có kết quả'],
  [/^Participant đã có Evaluation$/, 'Lượt này đã được đánh giá'],
  [/^Participant chưa có Evaluation$/, 'Lượt này chưa được đánh giá'],
  [/^Không thể hủy session đang có participant ONGOING$/, 'Còn ngựa đang chạy, chưa hủy buổi được'],
  [/^Không tìm thấy training class$/, 'Không tìm thấy lớp huấn luyện'],
  [/^Không tìm thấy participant$/, 'Không tìm thấy lượt tập'],
  [/^Bạn không được assign participant này$/, 'Bạn không phụ trách lượt tập này'],
  [/^Bạn không được assign participant nào$/, 'Bạn không phụ trách lượt tập nào'],
  [/^Bạn không được thao tác participant này$/, 'Bạn không được thao tác lượt tập này'],
  [/^Không có quyền quản lý training class$/, 'Bạn không quản lý lớp huấn luyện này'],
  [/^Class thuộc head trainer khác$/, 'Lớp thuộc huấn luyện viên trưởng khác'],
  [/^Ngựa đang ONGOING, không thể tạo TrainingLock$/, 'Ngựa đang chạy, chưa khóa huấn luyện được'],
  [/^startDate phải nhỏ hơn hoặc bằng endDate$/, 'Ngày bắt đầu phải trước ngày kết thúc'],
  [/^from phải nhỏ hơn hoặc bằng to$/, 'Ngày bắt đầu khoảng phải trước ngày kết thúc khoảng'],
  [/^Không tìm thấy video media$/, 'Không tìm thấy video'],
];

/** Vài câu lỗi của backend còn lẫn thuật ngữ tiếng Anh (sire, dam, microchip) — đổi sang tiếng Việt khi hiển thị. */
export function humanizeMessage(message: string): string {
  for (const [pattern, replacement] of TRAINING_MESSAGES) {
    const match = message.match(pattern);
    if (match) return typeof replacement === 'string' ? replacement : replacement(match);
  }
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
