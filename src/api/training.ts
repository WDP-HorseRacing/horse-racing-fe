// Flow 2 — môn học, giáo án, lớp, buổi tập, lượt tập, chạy thử, đánh giá, bàn giao HLV trưởng.
// Số BE trả dạng chuỗi (cự ly chạy thử, thời gian) được đổi sang number ngay ở đây.
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

const toSubject = (row: TrainingSubject): TrainingSubject => ({
  ...row,
  plannedDistanceM: num(row.plannedDistanceM),
  targetTimeMs: numOrNull(row.targetTimeMs),
});
const toPlan = (row: TrainingPlan): TrainingPlan => ({
  ...row,
  subjects: [...row.subjects].sort((a, b) => a.position - b.position).map((item) => ({ ...item, subject: toSubject(item.subject) })),
});
const toSession = (row: TrainingSession): TrainingSession => ({ ...row, plannedDistanceM: num(row.plannedDistanceM) });
const toTimeTrial = (row: TimeTrial): TimeTrial => ({ ...row, distanceM: num(row.distanceM), targetTimeMs: numOrNull(row.targetTimeMs) });
const toTrial = (row: TrialResult): TrialResult => ({ ...row, elapsedMs: num(row.elapsedMs) });
const toHorseSession = (row: HorseTrainingSession): HorseTrainingSession => ({
  ...row,
  trialResults: row.trialResults.map((trial) => ({ ...trial, elapsedMs: num(trial.elapsedMs) })),
});

/* ===== Môn học (CM sửa, HT / VET / Groom xem) ===== */

export const listSubjects = async () => (await http.get<TrainingSubject[]>('/training-subjects')).map(toSubject);
export const createSubject = async (input: TrainingSubjectInput) => toSubject(await http.post<TrainingSubject>('/training-subjects', input));
/** Gửi `null` để xóa field tùy chọn (mô tả, mặt sân, thời gian mục tiêu). */
export const updateSubject = async (id: string, input: Partial<TrainingSubjectInput>) =>
  toSubject(await http.patch<TrainingSubject>(`/training-subjects/${id}`, input));
export const deleteSubject = (id: string) => http.del<void>(`/training-subjects/${id}`);

/* ===== Giáo án (HT của mình, CM xem tất cả) ===== */

export const listPlans = async () => (await http.get<TrainingPlan[]>('/training-plans')).map(toPlan);
export const getPlan = async (id: string) => toPlan(await http.get<TrainingPlan>(`/training-plans/${id}`));
export const createPlan = async (input: TrainingPlanInput) => toPlan(await http.post<TrainingPlan>('/training-plans', input));
/** Thay toàn bộ danh sách môn của giáo án. */
export const replacePlan = async (id: string, input: TrainingPlanInput) => toPlan(await http.put<TrainingPlan>(`/training-plans/${id}`, input));
export const deletePlan = (id: string) => http.del<void>(`/training-plans/${id}`);

/* ===== Lớp ===== */

/** BE tự lọc theo vai trò: CM, bác sĩ thấy tất cả, HT lớp mình, Groom lớp có lượt mình dắt, chủ ngựa lớp có ngựa mình. */
export const listClasses = () => http.get<TrainingClass[]>('/classes');
export const getClass = (id: string) => http.get<TrainingClass>(`/classes/${id}`);
export const previewSchedule = async (input: ScheduleInput) => {
  const preview = await http.post<SchedulePreview>('/classes/schedule-preview', input);
  return {
    ...preview,
    sessions: preview.sessions.map((session) => ({
      ...session,
      plannedDistanceM: num(session.plannedDistanceM),
      targetTimeMs: numOrNull(session.targetTimeMs),
    })),
  };
};
export const createClass = (input: CreateClassInput) => http.post<TrainingClass>('/classes', input);
export const updateClass = (id: string, input: UpdateClassInput) => http.patch<TrainingClass>(`/classes/${id}`, input);
export const setClassStatus = (id: string, status: Exclude<TrainingClassStatus, 'DRAFT'>, cancelReason?: string) =>
  http.patch<TrainingClass>(`/classes/${id}/status`, status === 'CANCELLED' ? { status, cancelReason } : { status });

export const listEnrollments = (classId: string) => http.get<Enrollment[]>(`/classes/${classId}/enrollments`);
export const enrollHorse = (classId: string, horseId: string, enrolledAt?: string) =>
  http.post<Enrollment>(`/classes/${classId}/enrollments`, enrolledAt ? { horseId, enrolledAt } : { horseId });
export const leaveEnrollment = (id: string, input: { leftAt?: string; reason?: string }) =>
  http.patch<Enrollment>(`/enrollments/${id}/leave`, input);

/* ===== Buổi tập ===== */

export const listSessions = async (classId: string) => (await http.get<TrainingSession[]>(`/classes/${classId}/sessions`)).map(toSession);
export const getSession = async (id: string) => toSession(await http.get<TrainingSession>(`/training-sessions/${id}`));
export const addSession = async (classId: string, input: SessionInput) =>
  toSession(await http.post<TrainingSession>(`/classes/${classId}/sessions`, input));
export const updateSession = async (id: string, input: Partial<SessionInput>) =>
  toSession(await http.patch<TrainingSession>(`/training-sessions/${id}`, input));
export const publishSession = async (id: string) => toSession(await http.post<TrainingSession>(`/training-sessions/${id}/publish`));
/** Công bố một lần mọi buổi nháp của lớp, hoặc chỉ buổi có ngày (lịch CLB) trong khoảng from đến to. */
export const publishSessions = async (classId: string, range: { from?: string; to?: string } = {}) =>
  (await http.post<TrainingSession[]>(`/classes/${classId}/sessions/publish`, range)).map(toSession);
export const cancelSession = async (id: string, reason: string) =>
  toSession(await http.post<TrainingSession>(`/training-sessions/${id}/cancel`, { reason }));

/** Buổi chạy thử thêm lẻ (không qua tạo lớp) chưa có cấu hình chạy thử: phải tạo thì mới công bố được. */
export const createTimeTrial = async (sessionId: string, input: { distanceM: number; targetTimeMs?: number; notes?: string }) =>
  toTimeTrial(await http.post<TimeTrial>(`/training-sessions/${sessionId}/time-trial`, input));
export const getTimeTrial = async (sessionId: string) => toTimeTrial(await http.get<TimeTrial>(`/training-sessions/${sessionId}/time-trial`));
export const updateTimeTrial = async (sessionId: string, input: { distanceM?: number; targetTimeMs?: number | null; notes?: string | null }) =>
  toTimeTrial(await http.patch<TimeTrial>(`/training-sessions/${sessionId}/time-trial`, input));

/* ===== Lượt tập ===== */

export const listParticipants = (sessionId: string) => http.get<Participant[]>(`/training-sessions/${sessionId}/participants`);
export const assignParticipantGroom = (id: string, groomId: string | null) =>
  http.patch<Participant>(`/session-participants/${id}/groom`, { groomId });
export const checkInParticipant = (id: string) => http.post<Participant>(`/session-participants/${id}/check-in`);
export const markParticipantAbsent = (id: string, reason: string) => http.post<Participant>(`/session-participants/${id}/absent`, { reason });
export const readyParticipant = (id: string) => http.post<Participant>(`/session-participants/${id}/ready`);
export const startParticipant = (id: string) => http.post<Participant>(`/session-participants/${id}/start`);
export const completeParticipant = (id: string) => http.post<Participant>(`/session-participants/${id}/complete`);

export const listTrialResults = async (participantId: string) =>
  (await http.get<TrialResult[]>(`/session-participants/${participantId}/trial-results`)).map(toTrial);
export const recordTrialResult = async (participantId: string, input: { attemptNo: number; elapsedMs: number; notes?: string }) =>
  toTrial(await http.post<TrialResult>(`/session-participants/${participantId}/trial-results`, input));

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
