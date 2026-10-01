// Flow 1 — hồ sơ ngựa, xếp khu, vòng đời, chỉ số cơ thể.
import { fetchAll, http, type Query } from './http';
import type {
  BarnPreview,
  CreateHorseInput,
  CreatedMeasurement,
  DeletionPreview,
  Eligibility,
  HorseBase,
  HorseDetail,
  HorseListItem,
  HorseListQuery,
  HorsePermissions,
  LifecyclePreview,
  LifecycleStatus,
  Measurement,
  MeasurementType,
  Page,
  Pedigree,
  RestorePreview,
  UpdateHorseInput,
} from './types';

const q = (query: HorseListQuery) => query as Query;

export const listHorses = (query: HorseListQuery = {}) => http.get<Page<HorseListItem>>('/horses', q(query));
/** Mọi ngựa khớp bộ lọc (gộp các trang). Dùng cho sơ đồ chuồng, ô chọn ngựa. */
export const listAllHorses = (query: Omit<HorseListQuery, 'page' | 'limit'> = {}) => fetchAll<HorseListItem>('/horses', q(query));
/** Chỉ đếm số ngựa khớp bộ lọc. */
export const countHorses = async (query: Omit<HorseListQuery, 'page' | 'limit'> = {}) =>
  (await http.get<Page<HorseListItem>>('/horses', q({ ...query, page: 1, limit: 1 }))).meta.total;

export const getHorse = (id: string) => http.get<HorseDetail>(`/horses/${id}`);
export const getPermissions = (id: string) => http.get<HorsePermissions>(`/horses/${id}/permissions`);
export const getEligibility = (id: string) => http.get<Eligibility & { horseId: string }>(`/horses/${id}/eligibility`);
export const getPedigree = (id: string) => http.get<Pedigree>(`/horses/${id}/pedigree`);
export const getPhotoUrl = (id: string) => http.get<{ url: string }>(`/horses/${id}/photo-url`);

export const createHorse = (input: CreateHorseInput) => http.post<HorseBase>('/horses', input);
export const updateHorse = (id: string, input: UpdateHorseInput) => http.patch<HorseBase>(`/horses/${id}`, input);

/* Xếp khu (CM) */
export const previewBarn = (id: string, barnId: string) => http.get<BarnPreview>(`/horses/${id}/barn-preview`, { barnId });
export const assignBarn = (id: string, barnId: string, reason?: string) =>
  http.put<HorseBase>(`/horses/${id}/barn`, reason ? { barnId, reason } : { barnId });

/* Vòng đời, xóa, khôi phục (CM) */
export const previewLifecycle = (id: string, lifecycleStatus: LifecycleStatus) =>
  http.get<LifecyclePreview>(`/horses/${id}/lifecycle-status/preview`, { lifecycleStatus });
export const changeLifecycle = (id: string, lifecycleStatus: LifecycleStatus, reason: string) =>
  http.patch<HorseBase>(`/horses/${id}/lifecycle-status`, { lifecycleStatus, reason });
export const previewDeletion = (id: string) => http.get<DeletionPreview>(`/horses/${id}/deletion-preview`);
export const deleteHorse = (id: string, reason: string) => http.del<void>(`/horses/${id}`, { reason });
export const previewRestore = (id: string) => http.get<RestorePreview>(`/horses/${id}/restore-preview`);
export const restoreHorse = (id: string, reason: string) => http.post<HorseBase>(`/horses/${id}/restore`, { reason });

/* Chỉ số cơ thể */
export const listMeasurements = (id: string, query: { type?: MeasurementType; from?: string; to?: string; page?: number; limit?: number } = {}) =>
  http.get<Page<Measurement>>(`/horses/${id}/measurements`, query);
export const addMeasurements = (
  id: string,
  input: { values: { type: MeasurementType; value: number }[]; measuredAt?: string; confirmAbnormal?: boolean },
) => http.post<CreatedMeasurement[]>(`/horses/${id}/measurements`, input);
export const deleteMeasurement = (horseId: string, measurementId: string, reason: string) =>
  http.del<void>(`/horses/${horseId}/measurements/${measurementId}`, { reason });
