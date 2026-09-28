import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { useStore } from './store/store';

import LandingPage from './pages/LandingPage';
import { Login } from './pages/Login';
import Dashboard from './pages/dashboard/Dashboard';
import Profile from './pages/Profile';

import HorseList from './pages/horses/HorseList';
import HorseForm from './pages/horses/HorseForm';
import HorseDetail from './pages/horses/HorseDetail';
import StableMap from './pages/stable/StableMap';
import ZoneCatalog from './pages/stable/ZoneCatalog';

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
import TrainingLocks from './pages/medical/TrainingLocks';

import { AdminAudit, AdminPermissions, AdminSystem, AdminUsers } from './pages/admin/AdminPages';
import { NotFound } from './components/ui';

const ProtectedRoute = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

/** Đường dẫn cũ của buổi tập (live/review) chuyển sang trang buổi học mới. */
function SessionRedirect() {
  const { id } = useParams();
  return <Navigate to={`/training/sessions/${id}`} replace />;
}

function App() {
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
            <Route path="stable/zones" element={<ZoneCatalog />} />

            {/* Flow 2 — lập và thực hiện giáo án huấn luyện (mô hình lớp học) */}
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

            {/* Flow 3 — y tế và xử lý chấn thương */}
            <Route path="medical/board" element={<MedicalBoard />} />
            <Route path="medical/requests" element={<ExamRequests />} />
            <Route path="medical/cases" element={<CaseList />} />
            <Route path="medical/cases/:id" element={<CaseDetail />} />
            <Route path="medical/periodic" element={<PeriodicExams />} />
            <Route path="medical/locks" element={<TrainingLocks />} />
            <Route path="medical/records" element={<Navigate to="/medical/cases" replace />} />
            <Route path="medical/care" element={<Navigate to="/medical/periodic" replace />} />
            <Route path="medical/heart-rate" element={<Navigate to="/training/heart-rate" replace />} />

            {/* Quản trị */}
            <Route path="admin/users" element={<AdminUsers />} />
            <Route path="admin/permissions" element={<AdminPermissions />} />
            <Route path="admin/zones" element={<Navigate to="/stable/zones" replace />} />
            <Route path="admin/audit" element={<AdminAudit />} />
            <Route path="admin/system" element={<AdminSystem />} />

            <Route path="*" element={<NotFound message="Đường dẫn này không tồn tại trong hệ thống." />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
