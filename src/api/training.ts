// Flow 2 — môn học, giáo án, lớp, buổi tập, lượt tập, chạy thử, đánh giá, bàn giao HLV trưởng.
import { isApiError } from '../lib/errors';
import { http } from './http';
import type {
  ClassPlan,
  ClassProgress,
  CreateClassInput,
  EnrollableHorse,
  Enrollment,
  Evaluation,
  HandoverResult,
  HorseTrainingClass,
  HorseTrainingSession,
  Page,
  Participant,
  SessionInput,
  TrainingClass,
  TrainingClassStatus,
  TrainingPlan,
  TrainingPlanInput,
  TrainingSession,
  TrainingSubject,
  TrainingSubjectInput,
  TrialResult,
  UpdateClassInput,
} from './types';

/* ===== Môn học (CM sửa, HT / VET / Groom xem) ===== */

export const listSubjects = () => http.get<TrainingSubject[]>('/training-subjects');
export const createSubject = (input: TrainingSubjectInput) => http.post<TrainingSubject>('/training-subjects', input);
/** Gửi `null` để xóa field tùy chọn (mô tả, mặt sân, thời gian mục tiêu). */
export const updateSubject = (id: string, input: Partial<TrainingSubjectInput>) => http.patch<TrainingSubject>(`/training-subjects/${id}`, input);
export const deleteSubject = (id: string) => http.del<void>(`/training-subjects/${id}`);

/* ===== Giáo án (HT của mình, CM xem tất cả) ===== */
// BE đã sắp giai đoạn theo thứ tự. Mỗi môn có số buổi tối thiểu mỗi tuần, không còn thứ cố định.

export const listPlans = () => http.get<TrainingPlan[]>('/training-plans');
export const getPlan = (id: string) => http.get<TrainingPlan>(`/training-plans/${id}`);
export const createPlan = (input: TrainingPlanInput) => http.post<TrainingPlan>('/training-plans', input);
/** Thay toàn bộ các giai đoạn của giáo án. Lớp đã tạo giữ bản giáo án đã chép lúc tạo lớp. */
export const replacePlan = (id: string, input: TrainingPlanInput) => http.put<TrainingPlan>(`/training-plans/${id}`, input);
export const deletePlan = (id: string) => http.del<void>(`/training-plans/${id}`);

/* ===== Lớp ===== */

/** BE tự lọc theo vai trò: CM, bác sĩ thấy tất cả, HT lớp mình, Groom lớp có lượt mình dắt, chủ ngựa lớp có ngựa mình. */
export const listClasses = () => http.get<TrainingClass[]>('/classes');
export const getClass = (id: string) => http.get<TrainingClass>(`/classes/${id}`);
/** Lớp tạo ra đang chạy luôn, chưa có buổi: HLV xếp buổi trên lịch tuần. */
export const createClass = (input: CreateClassInput) => http.post<TrainingClass>('/classes', input);
export const updateClass = (id: string, input: UpdateClassInput) => http.patch<TrainingClass>(`/classes/${id}`, input);
export const setClassStatus = (id: string, status: Exclude<TrainingClassStatus, 'ACTIVE'>, cancelReason?: string) =>
  http.patch<TrainingClass>(`/classes/${id}/status`, status === 'CANCELLED' ? { status, cancelReason } : { status });
/** Giáo án đã chép vào lớp, có khoảng ngày từng giai đoạn. Mọi vai trò xem được lớp đều đọc được. */
export const getClassPlan = (classId: string) => http.get<ClassPlan>(`/classes/${classId}/plan`);
/** Tiến độ xếp lịch theo tuần so với số buổi tối thiểu của giáo án. */
export const getClassProgress = (classId: string) => http.get<ClassProgress>(`/classes/${classId}/progress`);

/** Danh sách kèm tên và ảnh ngựa. */
export const listEnrollments = (classId: string) => http.get<Enrollment[]>(`/classes/${classId}/enrollments`);
/** Ngựa ghi danh được (HLV của lớp): đã loại ngựa đã ghi danh, trùng giờ, vượt giới hạn tập trong ngày. Lớp không chạy thì 409. */
export const listEnrollableHorses = (classId: string) => http.get<EnrollableHorse[]>(`/classes/${classId}/enrollable-horses`);
export const enrollHorse = (classId: string, horseId: string, enrolledAt?: string) =>
  http.post<Enrollment>(`/classes/${classId}/enrollments`, enrolledAt ? { horseId, enrolledAt } : { horseId });
export const leaveEnrollment = (id: string, input: { leftAt?: string; reason?: string }) =>
  http.patch<Enrollment>(`/enrollments/${id}/leave`, input);

/* ===== Buổi tập ===== */

export const listSessions = (classId: string) => http.get<TrainingSession[]>(`/classes/${classId}/sessions`);
export const getSession = (id: string) => http.get<TrainingSession>(`/training-sessions/${id}`);
/**
 * Buổi lưu xong là SCHEDULED, có hiệu lực ngay. BE trả 409 khi môn không thuộc giai đoạn chứa ngày đó,
 * khi trùng giờ, hoặc vượt giới hạn tập trong ngày (2 buổi, 1 buổi Nặng, cách nhau 3 giờ).
 */
export const addSession = (classId: string, input: SessionInput) => http.post<TrainingSession>(`/classes/${classId}/sessions`, input);
/** Thêm nhiều buổi một lần (lặp lại hằng tuần). Một buổi lỗi thì không lưu buổi nào, câu báo có tiền tố "Buổi N: ". */
export const addSessions = (classId: string, sessions: SessionInput[]) => http.post<TrainingSession[]>(`/classes/${classId}/sessions/bulk`, { sessions });
/**
 * Chỉ sửa được buổi đã lên lịch, chưa tới giờ, chưa có ngựa điểm danh (còn lại 409).
 * Loại buổi theo môn (không gửi `sessionType`). Mục tiêu chạy thử gửi `targetTimeMs` trên chính route này.
 */
export const updateSession = (id: string, input: Partial<Omit<SessionInput, 'sessionType'>>) => http.patch<TrainingSession>(`/training-sessions/${id}`, input);
export const cancelSession = (id: string, reason: string) => http.post<TrainingSession>(`/training-sessions/${id}/cancel`, { reason });

/* ===== Lượt tập ===== */

/** Danh sách kèm tên, ảnh ngựa và tên Groom. Các API ghi bên dưới trả lượt không có tên. */
export const listParticipants = (sessionId: string) => http.get<Participant[]>(`/training-sessions/${sessionId}/participants`);
export const assignParticipantGroom = (id: string, groomId: string | null) =>
  http.patch<Participant>(`/session-participants/${id}/groom`, { groomId });
export const checkInParticipant = (id: string) => http.post<Participant>(`/session-participants/${id}/check-in`);
/** Nhận lượt chờ điểm danh, có mặt hoặc sẵn sàng. */
export const markParticipantAbsent = (id: string, reason: string) => http.post<Participant>(`/session-participants/${id}/absent`, { reason });
export const readyParticipant = (id: string) => http.post<Participant>(`/session-participants/${id}/ready`);
/** Bắt đầu, hoàn thành, ghi kết quả chạy thử: chỉ HLV trưởng của lớp (Groom nhận 403). */
export const startParticipant = (id: string) => http.post<Participant>(`/session-participants/${id}/start`);
export const completeParticipant = (id: string) => http.post<Participant>(`/session-participants/${id}/complete`);
/** Dừng sớm lượt đang chạy (lý do bắt buộc). Kết thúc như hoàn thành, lượt cuối dừng thì buổi tự đóng. */
export const stopParticipant = (id: string, reason: string) => http.post<Participant>(`/session-participants/${id}/stop`, { reason });

export const listTrialResults = (participantId: string) => http.get<TrialResult[]>(`/session-participants/${participantId}/trial-results`);
/** `videoMediaId`: video do chính HLV tải lên (uploadTrialVideo). Ghi được khi buổi đang diễn ra hoặc đã xong, không giới hạn thời gian. */
export const recordTrialResult = (participantId: string, input: { attemptNo: number; elapsedMs: number; notes?: string; videoMediaId?: string }) =>
  http.post<TrialResult>(`/session-participants/${participantId}/trial-results`, input);
/**
 * Sửa kết quả chạy thử sau buổi: chỉ HLV trưởng của lớp, buổi chưa hủy, không giới hạn thời gian.
 * Đổi `elapsedMs` hoặc `notes` bắt buộc `reason`. Chỉ gắn, đổi, gỡ video thì không cần.
 */
export const updateTrialResult = (
  participantId: string,
  attemptNo: number,
  input: { elapsedMs?: number; notes?: string | null; reason?: string; videoMediaId?: string | null },
) => http.patch<TrialResult>(`/session-participants/${participantId}/trial-results/${attemptNo}`, input);
/** Gắn, đổi hoặc gỡ (null) video sau buổi. */
export const updateTrialVideo = (participantId: string, attemptNo: number, videoMediaId: string | null) =>
  updateTrialResult(participantId, attemptNo, { videoMediaId });

/** 404 khi lượt chưa có đánh giá: trả null. */
export const getEvaluation = async (participantId: string) => {
  try {
    return await http.get<Evaluation>(`/session-participants/${participantId}/evaluation`);
  } catch (error) {
    if (isApiError(error, 404)) return null;
    throw error;
  }
};
export const createEvaluation = (participantId: string, input: { score: number; comment?: string }) =>
  http.post<Evaluation>(`/session-participants/${participantId}/evaluation`, input);
/** Sửa đánh giá sau buổi, lý do bắt buộc. Chỉ HLV trưởng phụ trách lớp. */
export const updateEvaluation = (participantId: string, input: { score?: number; comment?: string | null; reason: string }) =>
  http.patch<Evaluation>(`/session-participants/${participantId}/evaluation`, input);

/* ===== Tab Huấn luyện của ngựa (CM, HT, bác sĩ, chủ ngựa) ===== */

export const listHorseClasses = (horseId: string) => http.get<HorseTrainingClass[]>(`/horses/${horseId}/training/classes`);
export const listHorseSessions = (horseId: string, query: { when?: 'upcoming' | 'history'; classId?: string; page?: number; limit?: number } = {}) =>
  http.get<Page<HorseTrainingSession>>(`/horses/${horseId}/training/sessions`, query);

/* ===== Bàn giao HLV trưởng (CM) ===== */

export const handOverHeadTrainer = (fromId: string, toHeadTrainerId: string) =>
  http.post<HandoverResult>(`/users/${fromId}/head-trainer-handover`, { toHeadTrainerId });

