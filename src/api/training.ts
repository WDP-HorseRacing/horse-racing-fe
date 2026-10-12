// Flow 2 — môn học, giáo án, lớp, buổi tập, lượt tập, chạy thử, đánh giá, bàn giao HLV trưởng.
// Số BE trả dạng chuỗi (cự ly và thời gian của chạy thử) được đổi sang number ngay ở đây.
import { isApiError } from '../lib/errors';
import { http } from './http';
import type {
  ClassSessionInput,
  CreateClassInput,
  Enrollment,
  Evaluation,
  HandoverResult,
  HorseTrainingClass,
  HorseTrainingSession,
  Page,
  Participant,
  PublishedSession,
  SchedulePreview,
  ScheduleInput,
  SessionInput,
  TimeTrial,
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

const num = (value: unknown): number => (value === null || value === undefined || value === '' ? 0 : Number(value));
const numOrNull = (value: unknown): number | null => (value === null || value === undefined || value === '' ? null : Number(value));

const toTimeTrial = (row: TimeTrial): TimeTrial => ({ ...row, distanceM: num(row.distanceM), targetTimeMs: numOrNull(row.targetTimeMs) });
const toTrial = (row: TrialResult): TrialResult => ({ ...row, elapsedMs: num(row.elapsedMs) });
const toHorseSession = (row: HorseTrainingSession): HorseTrainingSession => ({
  ...row,
  trialResults: row.trialResults.map((trial) => ({ ...trial, elapsedMs: num(trial.elapsedMs) })),
});

/* ===== Môn học (CM sửa, HT / VET / Groom xem) ===== */

export const listSubjects = () => http.get<TrainingSubject[]>('/training-subjects');
export const createSubject = (input: TrainingSubjectInput) => http.post<TrainingSubject>('/training-subjects', input);
/** Gửi `null` để xóa field tùy chọn (mô tả, mặt sân, thời gian mục tiêu). */
export const updateSubject = (id: string, input: Partial<TrainingSubjectInput>) => http.patch<TrainingSubject>(`/training-subjects/${id}`, input);
export const deleteSubject = (id: string) => http.del<void>(`/training-subjects/${id}`);

/* ===== Giáo án (HT của mình, CM xem tất cả) ===== */
// BE đã sắp giai đoạn theo thứ tự, thứ trong tuần tăng dần.

export const listPlans = () => http.get<TrainingPlan[]>('/training-plans');
export const getPlan = (id: string) => http.get<TrainingPlan>(`/training-plans/${id}`);
export const createPlan = (input: TrainingPlanInput) => http.post<TrainingPlan>('/training-plans', input);
/** Thay toàn bộ các giai đoạn của giáo án. Lớp đã tạo từ giáo án giữ nguyên buổi tập. */
export const replacePlan = (id: string, input: TrainingPlanInput) => http.put<TrainingPlan>(`/training-plans/${id}`, input);
export const deletePlan = (id: string) => http.del<void>(`/training-plans/${id}`);

/* ===== Lớp ===== */

/** BE tự lọc theo vai trò: CM, bác sĩ thấy tất cả, HT lớp mình, Groom lớp có lượt mình dắt, chủ ngựa lớp có ngựa mình. */
export const listClasses = () => http.get<TrainingClass[]>('/classes');
export const getClass = (id: string) => http.get<TrainingClass>(`/classes/${id}`);
/** Mỗi ngày có môn theo giáo án sinh một buổi. Không lưu gì. */
export const previewSchedule = (input: ScheduleInput) => http.post<SchedulePreview>('/classes/schedule-preview', input);
export const createClass = (input: CreateClassInput) => http.post<TrainingClass>('/classes', input);
export const updateClass = (id: string, input: UpdateClassInput) => http.patch<TrainingClass>(`/classes/${id}`, input);
export const setClassStatus = (id: string, status: Exclude<TrainingClassStatus, 'DRAFT'>, cancelReason?: string) =>
  http.patch<TrainingClass>(`/classes/${id}/status`, status === 'CANCELLED' ? { status, cancelReason } : { status });

/** Danh sách kèm tên và ảnh ngựa. */
export const listEnrollments = (classId: string) => http.get<Enrollment[]>(`/classes/${classId}/enrollments`);
export const enrollHorse = (classId: string, horseId: string, enrolledAt?: string) =>
  http.post<Enrollment>(`/classes/${classId}/enrollments`, enrolledAt ? { horseId, enrolledAt } : { horseId });
export const leaveEnrollment = (id: string, input: { leftAt?: string; reason?: string }) =>
  http.patch<Enrollment>(`/enrollments/${id}/leave`, input);

/* ===== Buổi tập ===== */

export const listSessions = (classId: string) => http.get<TrainingSession[]>(`/classes/${classId}/sessions`);
export const getSession = (id: string) => http.get<TrainingSession>(`/training-sessions/${id}`);
/** BE chặn 409 khi trùng giờ với buổi khác của lớp, hoặc với lịch ở lớp khác của ngựa đang học lớp này. */
export const addSession = (classId: string, input: SessionInput) => http.post<TrainingSession>(`/classes/${classId}/sessions`, input);
export const updateSession = (id: string, input: Partial<Omit<SessionInput, 'targetTimeMs'>>) => http.patch<TrainingSession>(`/training-sessions/${id}`, input);
/** Ngựa trùng giờ với lớp khác không được tạo lượt, nằm trong `skippedHorses`. */
export const publishSession = (id: string) => http.post<PublishedSession>(`/training-sessions/${id}/publish`);
/** Công bố một lần mọi buổi nháp của lớp, hoặc chỉ buổi có ngày (lịch CLB) trong khoảng from đến to. */
export const publishSessions = (classId: string, range: { from?: string; to?: string } = {}) =>
  http.post<PublishedSession[]>(`/classes/${classId}/sessions/publish`, range);
export const cancelSession = (id: string, reason: string) => http.post<TrainingSession>(`/training-sessions/${id}/cancel`, { reason });

/** Chỉ dùng khi sửa buổi thường thành buổi chạy thử. Thêm buổi chạy thử thì gửi targetTimeMs cùng addSession. */
export const createTimeTrial = async (sessionId: string, input: { distanceM: number; targetTimeMs?: number; notes?: string }) =>
  toTimeTrial(await http.post<TimeTrial>(`/training-sessions/${sessionId}/time-trial`, input));
export const getTimeTrial = async (sessionId: string) => toTimeTrial(await http.get<TimeTrial>(`/training-sessions/${sessionId}/time-trial`));
export const updateTimeTrial = async (sessionId: string, input: { distanceM?: number; targetTimeMs?: number | null; notes?: string | null }) =>
  toTimeTrial(await http.patch<TimeTrial>(`/training-sessions/${sessionId}/time-trial`, input));

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

export const listTrialResults = async (participantId: string) =>
  (await http.get<TrialResult[]>(`/session-participants/${participantId}/trial-results`)).map(toTrial);
/** `videoMediaId`: video do chính HLV tải lên (uploadTrialVideo). Chỉ ghi được khi buổi đang diễn ra. */
export const recordTrialResult = async (participantId: string, input: { attemptNo: number; elapsedMs: number; notes?: string; videoMediaId?: string }) =>
  toTrial(await http.post<TrialResult>(`/session-participants/${participantId}/trial-results`, input));
/** Gắn, đổi hoặc gỡ (null) video sau buổi. Chỉ HLV trưởng của lớp, trong 7 ngày sau giờ kết thúc dự kiến, buổi chưa hủy. */
export const updateTrialVideo = async (participantId: string, attemptNo: number, videoMediaId: string | null) =>
  toTrial(await http.patch<TrialResult>(`/session-participants/${participantId}/trial-results/${attemptNo}`, { videoMediaId }));

/** 404 khi lượt chưa có đánh giá: trả null. */
export const getEvaluation = async (participantId: string) => {
  try {
    return await http.get<Evaluation>(`/session-participants/${participantId}/evaluation`);
  } catch (error) {
    if (isApiError(error, 404)) return null;
    throw error;
  }
};
/** Lưu một lần, BE không cho sửa. */
export const createEvaluation = (participantId: string, input: { score: number; comment?: string }) =>
  http.post<Evaluation>(`/session-participants/${participantId}/evaluation`, input);

/* ===== Tab Huấn luyện của ngựa (CM, HT, bác sĩ, chủ ngựa) ===== */

export const listHorseClasses = (horseId: string) => http.get<HorseTrainingClass[]>(`/horses/${horseId}/training/classes`);
export const listHorseSessions = async (
  horseId: string,
  query: { when?: 'upcoming' | 'history'; classId?: string; page?: number; limit?: number } = {},
) => {
  const page = await http.get<Page<HorseTrainingSession>>(`/horses/${horseId}/training/sessions`, query);
  return { ...page, items: page.items.map(toHorseSession) };
};

/* ===== Bàn giao HLV trưởng (CM) ===== */

export const handOverHeadTrainer = (fromId: string, toHeadTrainerId: string) =>
  http.post<HandoverResult>(`/users/${fromId}/head-trainer-handover`, { toHeadTrainerId });

export type { ClassSessionInput };
