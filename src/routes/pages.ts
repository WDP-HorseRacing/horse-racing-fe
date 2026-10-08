// Danh mục trang tải theo nhu cầu, kèm bảng đường dẫn → trang để tải trước khi rê chuột vào menu.
import { lazyPage, type LazyPage } from './lazyPage';

export const LandingPage = lazyPage(() => import('../pages/LandingPage'));
export const Dashboard = lazyPage(() => import('../pages/dashboard/Dashboard'));
export const Profile = lazyPage(() => import('../pages/Profile'));

export const HorseList = lazyPage(() => import('../pages/horses/HorseList'));
export const HorseForm = lazyPage(() => import('../pages/horses/HorseForm'));
export const HorseDetail = lazyPage(() => import('../pages/horses/HorseDetail'));
export const StableMap = lazyPage(() => import('../pages/stable/StableMap'));

export const SubjectsPage = lazyPage(() => import('../pages/training/subjects/SubjectsPage'));
export const PlanList = lazyPage(() => import('../pages/training/plans/PlanList'));
export const PlanEditor = lazyPage(() => import('../pages/training/plans/PlanEditor'));
export const PlanDetail = lazyPage(() => import('../pages/training/plans/PlanDetail'));
export const ClassList = lazyPage(() => import('../pages/training/classes/ClassList'));
export const ClassCreate = lazyPage(() => import('../pages/training/classes/ClassCreate'));
export const ClassDetail = lazyPage(() => import('../pages/training/classes/ClassDetail'));
export const SessionBoard = lazyPage(() => import('../pages/training/session/SessionBoard'));
export const ParticipantDetail = lazyPage(() => import('../pages/training/ParticipantDetail'));
export const TrainingToday = lazyPage(() => import('../pages/training/TrainingToday'));

export const MedicalBoard = lazyPage(() => import('../pages/medical/MedicalBoard'));
export const ExamRequests = lazyPage(() => import('../pages/medical/ExamRequests'));
export const CaseList = lazyPage(() => import('../pages/medical/CaseList'));
export const CaseDetail = lazyPage(() => import('../pages/medical/CaseDetail'));
export const PeriodicExams = lazyPage(() => import('../pages/medical/PeriodicExams'));
export const CareSchedules = lazyPage(() => import('../pages/medical/CareSchedules'));
export const CostReport = lazyPage(() => import('../pages/medical/CostReport'));
export const HorseMedical = lazyPage(() => import('../pages/medical/HorseMedical'));
export const VisitNew = lazyPage(() => import('../pages/medical/VisitNew'));
export const CaseClose = lazyPage(() => import('../pages/medical/CaseClose'));
export const CareNew = lazyPage(() => import('../pages/medical/CareNew'));

export const AdminUsers = lazyPage(() => import('../pages/admin/AdminPages').then((module) => ({ default: module.AdminUsers })));

/** Đường dẫn trong menu → trang (khớp tiền tố dài nhất). */
const ROUTES: [string, LazyPage][] = [
  ['/dashboard', Dashboard],
  ['/profile', Profile],
  ['/horses', HorseList],
  ['/stable', StableMap],
  ['/training/subjects', SubjectsPage],
  ['/training/plans', PlanList],
  ['/training/classes', ClassList],
  ['/training/today', TrainingToday],
  ['/medical/board', MedicalBoard],
  ['/medical/requests', ExamRequests],
  ['/medical/cases', CaseList],
  ['/medical/periodic', PeriodicExams],
  ['/medical/care', CareSchedules],
  ['/medical/costs', CostReport],
  ['/admin/users', AdminUsers],
];

export function preloadRoute(path: string) {
  const match = ROUTES.filter(([prefix]) => path === prefix || path.startsWith(`${prefix}/`)).sort((a, b) => b[0].length - a[0].length)[0];
  match?.[1].preload();
}
