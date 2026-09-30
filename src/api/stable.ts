// Khu chuồng, ô chuồng, xếp ô và phân công Groom.
import { http } from './http';
import type {
  Barn,
  BarnListItem,
  BarnStatus,
  GroomAssignment,
  GroomWorkload,
  Stall,
  StallAssignment,
  StallStatus,
  StallType,
} from './types';

/* Khu */
export const listBarns = () => http.get<BarnListItem[]>('/barns');
export const getBarn = (id: string) => http.get<Barn>(`/barns/${id}`);
export const createBarn = (input: { name: string; description?: string; capacity?: number; status?: BarnStatus }) =>
  http.post<Barn>('/barns', input);
export const updateBarn = (
  id: string,
  input: { name?: string; description?: string; capacity?: number; status?: BarnStatus; headTrainerId?: string | null },
) => http.patch<Barn>(`/barns/${id}`, input);
export const deleteBarn = (id: string) => http.del<void>(`/barns/${id}`);

/* Ô */
export const listStalls = (query: { barnId?: string; status?: StallStatus; type?: StallType } = {}) =>
  http.get<Stall[]>('/stalls', query);
export const createStall = (input: { barnId: string; code: string; type?: StallType; description?: string; hasCamera?: boolean }) =>
  http.post<Stall>('/stalls', input);
export const updateStall = (
  id: string,
  input: { code?: string; type?: StallType; description?: string; hasCamera?: boolean; barnId?: string; status?: 'AVAILABLE' | 'MAINTENANCE' },
) => http.patch<Stall>(`/stalls/${id}`, input);
export const deleteStall = (id: string) => http.del<void>(`/stalls/${id}`);
export const listStallHistory = (id: string) => http.get<StallAssignment[]>(`/stalls/${id}/assignments`);

/* Xếp ô và Groom (HT phụ trách khu) */
export const placeHorse = (horseId: string, stallId: string, groomId: string) =>
  http.put<{ stallAssignment: StallAssignment; groomAssignment: GroomAssignment }>(`/horses/${horseId}/placement`, { stallId, groomId });
export const moveStall = (horseId: string, stallId: string) => http.put<StallAssignment>(`/horses/${horseId}/stall`, { stallId });
export const removeFromStall = (horseId: string) => http.del<StallAssignment>(`/horses/${horseId}/stall`);
export const assignGroom = (horseId: string, groomId: string) => http.put<GroomAssignment>(`/horses/${horseId}/groom`, { groomId });
export const listGroomHistory = (horseId: string) => http.get<GroomAssignment[]>(`/horses/${horseId}/grooms`);
export const listGroomWorkload = () => http.get<GroomWorkload[]>('/grooms/workload');
