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
  /** Buổi khám cần sửa (mở form sửa thay vì ghi mới). */
  edit?: string;
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
  pastHorses: '/horses/past',
  pastHorse: (id: string) => `/horses/past/${id}`,
  stable: '/stable',
  /** Flow 4 */
  stableCare: (barnId?: string) => withQuery('/stable/care', { barn: barnId }),
  incidents: (horseId?: string) => withQuery('/stable/incidents', { horse: horseId }),
  supplies: (tab?: 'requests') => withQuery('/supplies', { tab }),

  subjects: '/training/subjects',
  plans: '/training/plans',
  planNew: '/training/plans/new',
  plan: (id: string) => `/training/plans/${id}`,
  planEdit: (id: string) => `/training/plans/${id}/edit`,
  classes: '/training/classes',
  classNew: (planId?: string) => withQuery('/training/classes/new', { planId }),
  class: (id: string, tab?: string) => `/training/classes/${id}${tab ? `?tab=${tab}` : ''}`,
  today: '/training/today',
  session: (id: string) => `/training/sessions/${id}`,
  /** Chi tiết một lượt tập. horseId để mở được ngay từ thông báo (BE không có API đọc một lượt). */
  participant: (id: string, horseId?: string) => withQuery(`/training/participants/${id}`, { horse: horseId }),

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
      edit: params.edit,
      back: params.back,
    }),
  periodic: '/medical/periodic',
  locks: '/medical/locks',
  careSchedules: '/medical/care',
  careNew: (horseId?: string, back?: string) => withQuery('/medical/care/new', { horseId, back }),
  /** Chi phí y tế nằm ở Báo cáo › Tài chính › Y tế (đường cũ /medical/costs chuyển hướng về đây). */
  costReport: withQuery('/reports', { tab: 'finance', view: 'medical' }),

  adminUsers: '/admin/users',
  adminAudit: '/admin/audit',
  adminFees: '/admin/fees',
  adminSystem: '/admin/system',

  reports: (tab?: 'finance', view?: 'horses' | 'medical') => withQuery('/reports', { tab, view }),
  /** Chi phí của một chủ ngựa (Quản lý CLB). */
  ownerCosts: (ownerId: string) => `/reports/owners/${ownerId}`,
  /** Chi phí của chính chủ ngựa đang đăng nhập. */
  myCosts: '/reports/my-costs',
};
