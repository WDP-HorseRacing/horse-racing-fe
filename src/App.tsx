import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { useStore } from './store/store';
import { FEATURES } from './config/features';

import LandingPage from './pages/LandingPage';
import { Login } from './pages/Login';
import Dashboard from './pages/dashboard/Dashboard';
import Profile from './pages/Profile';

import HorseList from './pages/horses/HorseList';
import HorseForm from './pages/horses/HorseForm';
import HorseDetail from './pages/horses/HorseDetail';
import StableMap from './pages/stable/StableMap';

import SubjectList from './pages/training/subjects/SubjectList';
import ProgramList from './pages/training/programs/ProgramList';
import ProgramEditor from './pages/training/programs/ProgramEditor';
import ProgramDetail from './pages/training/programs/ProgramDetail';
import ClassList from './pages/training/classes/ClassList';
import ClassForm from './pages/training/classes/ClassForm';
import ClassDetail from './pages/training/classes/ClassDetail';
import SchedulePage from './pages/training/SchedulePage';
import TodaySessions from './pages/training/TodaySessions';
import SessionPage from './pages/training/SessionPage';
import LiveList from './pages/training/LiveList';
import ReviewList from './pages/training/ReviewList';
import ProgressBoard from './pages/training/ProgressBoard';
import HeartRatePage from './pages/training/HeartRatePage';

import MedicalBoard from './pages/medical/MedicalBoard';
import ExamRequests from './pages/medical/ExamRequests';
import CaseList from './pages/medical/CaseList';
import CaseDetail from './pages/medical/CaseDetail';
import PeriodicExams from './pages/medical/PeriodicExams';
import CareSchedules from './pages/medical/CareSchedules';
import CostReport from './pages/medical/CostReport';
import HorseMedical from './pages/medical/HorseMedical';
import VisitNew from './pages/medical/VisitNew';
import CaseClose from './pages/medical/CaseClose';
import CareNew from './pages/medical/CareNew';

import { AdminUsers } from './pages/admin/AdminPages';
import { NotFound, Skeleton } from './components/ui';

const ProtectedRoute = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const booting = useStore((state) => state.booting);
  const sessionEnded = useStore((state) => state.sessionEnded);
  const location = useLocation();
  if (booting) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-8">
        <Skeleton rows={3} className="w-full max-w-md" />
      </div>
    );
  }
  if (isAuthenticated) return <Outlet />;
  // Chưa đăng nhập hoặc vừa hết phiên: về đăng nhập, nhớ trang đang xem để quay lại sau khi đăng nhập.
  const params = new URLSearchParams({ next: `${location.pathname}${location.search}` });
  if (sessionEnded) params.set('reason', sessionEnded);
  return <Navigate to={`/login?${params.toString()}`} replace />;
};

/** Đường dẫn cũ của buổi tập (live/review) chuyển sang trang buổi học mới. */
function SessionRedirect() {
  const { id } = useParams();
  return <Navigate to={`/training/sessions/${id}`} replace />;
}

/** Flow 2 (huấn luyện) — chỉ gắn route khi bật cờ; code giữ nguyên để gắn API sau. */
function trainingRoutes() {
  if (!FEATURES.training) return <Route path="training/*" element={<Navigate to="/dashboard" replace />} />;
  return (
    <>
      <Route path="training/subjects" element={<SubjectList />} />
      <Route path="training/programs" element={<ProgramList />} />
      <Route path="training/programs/new" element={<ProgramEditor />} />
      <Route path="training/programs/:id" element={<ProgramDetail />} />
      <Route path="training/programs/:id/edit" element={<ProgramEditor />} />
      <Route path="training/classes" element={<ClassList />} />
      <Route path="training/classes/new" element={<ClassForm />} />
      <Route path="training/classes/:id" element={<ClassDetail />} />
      <Route path="training/schedule" element={<SchedulePage />} />
      <Route path="training/today" element={<TodaySessions />} />
      <Route path="training/sessions/:id" element={<SessionPage />} />
      <Route path="training/live" element={<LiveList />} />
      <Route path="training/live/:id" element={<SessionRedirect />} />
      <Route path="training/review" element={<ReviewList />} />
      <Route path="training/review/:id" element={<SessionRedirect />} />
      <Route path="training/progress" element={<ProgressBoard />} />
      <Route path="training/heart-rate" element={<HeartRatePage />} />
      <Route path="training/plans/*" element={<Navigate to="/training/classes" replace />} />
    </>
  );
}

function App() {
  const bootstrap = useStore((state) => state.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />

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

            {/* Flow 2 — huấn luyện (tạm ẩn) */}
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
