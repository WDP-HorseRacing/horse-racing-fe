import { Suspense, useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { Navigate, Outlet, Route, useLocation } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { useStore } from './store/store';
import { FEATURES } from './config/features';

import { Login } from './pages/Login';
import AuthCallback from './pages/AuthCallback';




import { NotFound } from './components/ui';
import { BootScreen, PageSkeleton } from './components/skeletons';
import {
  LandingPage,
  Dashboard,
  Profile,
  HorseList,
  HorseForm,
  HorseDetail,
  StableMap,
  SubjectsPage,
  PlanList,
  PlanEditor,
  PlanDetail,
  ClassList,
  ClassCreate,
  ClassDetail,
  SessionBoard,
  ParticipantDetail,
  TrainingToday,
  MedicalBoard,
  ExamRequests,
  CaseList,
  CaseDetail,
  PeriodicExams,
  CareSchedules,
  CostReport,
  HorseMedical,
  VisitNew,
  CaseClose,
  CareNew,
  AdminUsers,
} from './routes/pages';

const ProtectedRoute = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const booting = useStore((state) => state.booting);
  const sessionEnded = useStore((state) => state.sessionEnded);
  const location = useLocation();
  if (booting) {
    return <BootScreen />;
  }
  if (isAuthenticated) return <Outlet />;
  // Chưa đăng nhập hoặc vừa hết phiên: về đăng nhập, nhớ trang đang xem để quay lại sau khi đăng nhập.
  const params = new URLSearchParams({ next: `${location.pathname}${location.search}` });
  if (sessionEnded) params.set('reason', sessionEnded);
  return <Navigate to={`/login?${params.toString()}`} replace />;
};

/** Flow 2 (huấn luyện): chỉ gắn route khi bật cờ. */
function trainingRoutes() {
  if (!FEATURES.training) return <Route path="training/*" element={<Navigate to="/dashboard" replace />} />;
  return (
    <>
      <Route path="training/subjects" element={<SubjectsPage />} />
      <Route path="training/plans" element={<PlanList />} />
      <Route path="training/plans/new" element={<PlanEditor />} />
      <Route path="training/plans/:id" element={<PlanDetail />} />
      <Route path="training/plans/:id/edit" element={<PlanEditor />} />
      <Route path="training/classes" element={<ClassList />} />
      <Route path="training/classes/new" element={<ClassCreate />} />
      <Route path="training/classes/:id" element={<ClassDetail />} />
      <Route path="training/sessions/:id" element={<SessionBoard />} />
      <Route path="training/participants/:id" element={<ParticipantDetail />} />
      <Route path="training/today" element={<TrainingToday />} />
      <Route path="training" element={<Navigate to="/training/classes" replace />} />
    </>
  );
}

import { createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route
        path="/"
        element={
          <Suspense fallback={<div className="p-8"><PageSkeleton /></div>}>
            <LandingPage />
          </Suspense>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />

          {/* Flow 1 — hồ sơ và lý lịch ngựa */}
          <Route path="horses" element={<HorseList />} />
          <Route path="horses/new" element={<HorseForm />} />
          <Route path="horses/:id" element={<HorseDetail />} />
          <Route path="horses/:id/edit" element={<HorseForm />} />
          <Route path="stable" element={<StableMap />} />
          <Route path="stable/zones" element={<Navigate to="/stable" replace />} />

          {/* Flow 2 — lập và thực hiện giáo án huấn luyện */}
          {trainingRoutes()}

          {/* Flow 3 — y tế và xử lý chấn thương */}
          <Route path="medical/board" element={<MedicalBoard />} />
          <Route path="medical/requests" element={<ExamRequests />} />
          <Route path="medical/cases" element={<CaseList />} />
          <Route path="medical/cases/:id" element={<CaseDetail />} />
          <Route path="medical/cases/:id/close" element={<CaseClose />} />
          <Route path="medical/horses/:id" element={<HorseMedical />} />
          <Route path="medical/visits/new" element={<VisitNew />} />
          <Route path="medical/periodic" element={<PeriodicExams />} />
          <Route path="medical/care" element={<CareSchedules />} />
          <Route path="medical/care/new" element={<CareNew />} />
          <Route path="medical/costs" element={<CostReport />} />
          <Route path="medical/locks" element={<Navigate to="/medical/board" replace />} />
          <Route path="medical/records" element={<Navigate to="/medical/cases" replace />} />

          {/* Quản trị */}
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="admin/zones" element={<Navigate to="/stable" replace />} />
          <Route path="admin/*" element={<Navigate to="/dashboard" replace />} />

          <Route path="*" element={<NotFound message="Đường dẫn này không tồn tại trong hệ thống." />} />
        </Route>
      </Route>
    </Route>
  )
);

function App() {
  const bootstrap = useStore((state) => state.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  );
}

export default App;
