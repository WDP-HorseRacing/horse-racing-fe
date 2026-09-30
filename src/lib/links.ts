// Đường dẫn dùng chung cho App.tsx, menu và link trong thông báo — tránh lệch route.

/** Tham số mở trang Ghi buổi khám. `back`: trang quay về khi hủy / sau khi lưu. */
export interface VisitParams {
  horseId?: string;
  caseId?: string;
  kind?: 'ROUTINE' | 'REQUEST';
  requestIds?: string[];
  conclusion?: 'NORMAL' | 'ISSUE';
  /** Buổi khám đã hủy cần ghi lại. */
  replaces?: string;
  back?: string;
}

/** Chỉ nhận đường dẫn nội bộ (một dấu / ở đầu) từ tham số URL — chặn chuyển hướng ra trang ngoài. */
export function safeInternalPath(value: string | null | undefined): string | undefined {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : undefined;
}

function withQuery(path: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

export const links = {
  dashboard: '/dashboard',
  profile: '/profile',

  horses: '/horses',
  horseNew: '/horses/new',
  horse: (id: string, tab?: string) => `/horses/${id}${tab ? `?tab=${tab}` : ''}`,
  horseEdit: (id: string) => `/horses/${id}/edit`,
  stable: '/stable',
  zones: '/stable/zones',

  subjects: '/training/subjects',
  programs: '/training/programs',
  programNew: '/training/programs/new',
  program: (id: string) => `/training/programs/${id}`,
  classes: '/training/classes',
  classNew: '/training/classes/new',
  class: (id: string, tab?: string) => `/training/classes/${id}${tab ? `?tab=${tab}` : ''}`,
  schedule: '/training/schedule',
  today: '/training/today',
  session: (id: string) => `/training/sessions/${id}`,
  live: '/training/live',
  review: '/training/review',
  progress: '/training/progress',
  heartRate: '/training/heart-rate',

  medicalBoard: '/medical/board',
  requests: '/medical/requests',
  cases: '/medical/cases',
  case: (id: string) => `/medical/cases/${id}`,
  caseClose: (id: string, back?: string) => withQuery(`/medical/cases/${id}/close`, { back }),
  /** Hồ sơ y tế của một con ngựa (màn riêng của Flow 3). */
  horseMedical: (id: string) => `/medical/horses/${id}`,
  visitNew: (params: VisitParams = {}) =>
    withQuery('/medical/visits/new', {
      horseId: params.horseId,
      caseId: params.caseId,
      kind: params.kind,
      requestIds: params.requestIds?.join(','),
      conclusion: params.conclusion,
      replaces: params.replaces,
      back: params.back,
    }),
  periodic: '/medical/periodic',
  locks: '/medical/locks',
  careSchedules: '/medical/care',
  careNew: (horseId?: string, back?: string) => withQuery('/medical/care/new', { horseId, back }),
  costReport: '/medical/costs',

  adminUsers: '/admin/users',
  adminPermissions: '/admin/permissions',
  adminAudit: '/admin/audit',
  adminSystem: '/admin/system',
};
