// Flow 3 — y tế: dashboard, khám định kỳ, buổi khám, yêu cầu khám, bệnh án,
// sức khỏe, khóa huấn luyện, lịch chăm sóc, báo cáo chi phí.
import { http } from './http';
import type {
  CareInstructions,
  CareSchedule,
  CareStatus,
  CareTaskType,
  CheckupDueStatus,
  CheckupItem,
  CloseCaseInput,
  ClosePreview,
  CostReport,
  ExamRequest,
  ExamRequestStatus,
  HealthChangeResult,
  HealthHistoryItem,
  HealthStatus,
  InjuryTimelineItem,
  MedicalCase,
  MedicalCaseDetail,
  MedicalCaseList,
  MedicalDashboard,
  MedicalRecord,
  Page,
  StandaloneVisitInput,
  TrainingLock,
  VisitInputBase,
} from './types';

/* Bảng điều khiển và khám định kỳ */
export const getMedicalDashboard = (query: { barnId?: string; healthStatus?: HealthStatus } = {}) =>
  http.get<MedicalDashboard>('/medical/dashboard', query);
export const listCheckups = (query: { status?: CheckupDueStatus; barnId?: string } = {}) =>
  http.get<CheckupItem[]>('/medical/checkups', query);
export const setCheckupAppointment = (horseId: string, scheduledAt: string, reason?: string) =>
  http.put<{ id: string; horseId: string; scheduledAt: string }>(`/horses/${horseId}/checkup-appointment`, reason ? { scheduledAt, reason } : { scheduledAt });

/* Buổi khám */
export const listHorseRecords = (horseId: string) => http.get<MedicalRecord[]>(`/horses/${horseId}/medical-records`);
export const getRecord = (id: string) => http.get<MedicalRecord>(`/medical-records/${id}`);
export const createStandaloneVisit = (horseId: string, input: StandaloneVisitInput) =>
  http.post<MedicalRecord>(`/horses/${horseId}/medical-records`, input);
export const createFollowUpVisit = (caseId: string, input: VisitInputBase) =>
  http.post<MedicalRecord>(`/medical-cases/${caseId}/visits`, input);
export const voidRecord = (id: string, reason: string) => http.post<MedicalRecord>(`/medical-records/${id}/void`, { reason });

/* Bệnh án */
export const listHorseCases = (horseId: string, status?: MedicalCase['status']) =>
  http.get<MedicalCaseList>(`/horses/${horseId}/medical-cases`, { status });
export const getCase = (id: string) => http.get<MedicalCaseDetail>(`/medical-cases/${id}`);
export const getClosePreview = (id: string) => http.get<ClosePreview>(`/medical-cases/${id}/close-preview`);
export const closeCase = (id: string, input: CloseCaseInput) => http.post<MedicalCase>(`/medical-cases/${id}/close`, input);
export const adjustCaseCost = (id: string, totalCost: number, reason: string) =>
  http.patch<MedicalCase>(`/medical-cases/${id}/cost`, { totalCost, reason });
export const getCostReport = (query: { from: string; to: string; barnId?: string; ownerId?: string }) =>
  http.get<CostReport>('/medical/cost-report', query);

/* Yêu cầu khám */
export const listExamRequests = (query: { status?: ExamRequestStatus; urgent?: boolean; page?: number; limit?: number } = {}) =>
  http.get<Page<ExamRequest>>('/exam-requests', query);
export const listHorseExamRequests = (horseId: string) => http.get<ExamRequest[]>(`/horses/${horseId}/exam-requests`);
export const createExamRequest = (horseId: string, description: string, urgent: boolean) =>
  http.post<ExamRequest>(`/horses/${horseId}/exam-requests`, { description, urgent });
export const changeRequestUrgency = (id: string, urgent: boolean, reason: string) =>
  http.patch<ExamRequest>(`/exam-requests/${id}`, { urgent, reason });
export const dismissExamRequest = (id: string, reason: string) => http.post<ExamRequest>(`/exam-requests/${id}/dismiss`, { reason });

/* Sức khỏe, chấn thương, ghi chú chăm sóc */
export const changeHealthStatus = (horseId: string, healthStatus: HealthStatus, reason: string) =>
  http.patch<HealthChangeResult>(`/horses/${horseId}/health-status`, { healthStatus, reason });
export const getHealthHistory = (horseId: string) => http.get<HealthHistoryItem[]>(`/horses/${horseId}/health-history`);
export const getInjuries = (horseId: string) => http.get<InjuryTimelineItem[]>(`/horses/${horseId}/injuries`);
export const getCareInstructions = (horseId: string) => http.get<CareInstructions>(`/horses/${horseId}/care-instructions`);

/* Khóa huấn luyện */
export const listHorseLocks = (horseId: string) => http.get<TrainingLock[]>(`/horses/${horseId}/training-locks`);
export const placeLock = (horseId: string, reason: string, lockEnd?: string) =>
  http.post<TrainingLock>(`/horses/${horseId}/training-locks`, lockEnd ? { reason, lockEnd } : { reason });
export const releaseLock = (id: string, conclusion: string) => http.post<TrainingLock>(`/training-locks/${id}/release`, { conclusion });

/* Lịch chăm sóc (tiêm phòng, tẩy giun, kiểm tra móng) */
export const listCareSchedules = (horseId: string) => http.get<CareSchedule[]>(`/horses/${horseId}/care-schedules`);
export const createCareSchedule = (horseId: string, input: { type: CareTaskType; dueAt: string; assignedTo?: string; notes?: string }) =>
  http.post<CareSchedule>(`/horses/${horseId}/care-schedules`, input);
export const updateCareSchedule = (
  id: string,
  input: { dueAt?: string; assignedTo?: string | null; notes?: string | null; reason?: string },
) => http.patch<CareSchedule>(`/care-schedules/${id}`, input);
export const completeCareSchedule = (id: string, nextDueAt?: string) =>
  http.post<{ completed: CareSchedule; next: CareSchedule | null }>(`/care-schedules/${id}/complete`, nextDueAt ? { nextDueAt } : {});
export const cancelCareSchedule = (id: string, reason: string) => http.post<CareSchedule>(`/care-schedules/${id}/cancel`, { reason });

export type { CareStatus };
