// Đường dẫn dùng chung cho App.tsx, menu và link trong thông báo — tránh lệch route.

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
  periodic: '/medical/periodic',
  locks: '/medical/locks',

  adminUsers: '/admin/users',
  adminPermissions: '/admin/permissions',
  adminAudit: '/admin/audit',
  adminSystem: '/admin/system',
};
