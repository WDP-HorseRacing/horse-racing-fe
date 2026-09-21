import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { I18nProvider } from './i18n/I18nContext';
import { useStore } from './store/store';

import LandingPage from './pages/LandingPage';
import { Login } from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import StableMap from './pages/StableMap';

import HorseList from './pages/horses/HorseList';
import HorseForm from './pages/horses/HorseForm';
import HorseDetail from './pages/horses/HorseDetail';

import ProgressBoard from './pages/training/ProgressBoard';
import PlanList from './pages/training/PlanList';
import PlanForm from './pages/training/PlanForm';
import PlanDetail from './pages/training/PlanDetail';
import SchedulePage from './pages/training/SchedulePage';
import TodaySessions from './pages/training/TodaySessions';
import LiveSession, { LiveList } from './pages/training/LiveSession';
import ReviewSession, { ReviewList } from './pages/training/ReviewSession';

import {
  CareSchedules,
  HealthBoard,
  MaxHeartRateList,
  MedicalRecords,
  TrainingLocks,
} from './pages/medical/MedicalPages';

import {
  CareInstructions,
  DietPlans,
  IncidentForm,
  IncidentList,
  Supplies,
  TodayCare,
} from './pages/care/CarePages';

import { RaceApprovals, RaceList, RaceResults, Reports } from './pages/races/RacePages';

import { AdminAudit, AdminPermissions, AdminSystem, AdminUsers, AdminZones } from './pages/admin/AdminPages';
import { NotFound } from './components/ui';

const ProtectedRoute = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="stable" element={<StableMap />} />

              {/* Flow 1 — hồ sơ và lý lịch ngựa */}
              <Route path="horses" element={<HorseList />} />
              <Route path="horses/new" element={<HorseForm />} />
              <Route path="horses/:id" element={<HorseDetail />} />
              <Route path="horses/:id/edit" element={<HorseForm />} />

              {/* Flow 2 — giáo án và buổi tập */}
              <Route path="training/progress" element={<ProgressBoard />} />
              <Route path="training/plans" element={<PlanList />} />
              <Route path="training/plans/new" element={<PlanForm />} />
              <Route path="training/plans/:id" element={<PlanDetail />} />
              <Route path="training/schedule" element={<SchedulePage />} />
              <Route path="training/today" element={<TodaySessions />} />
              <Route path="training/live" element={<LiveList />} />
              <Route path="training/live/:id" element={<LiveSession />} />
              <Route path="training/review" element={<ReviewList />} />
              <Route path="training/review/:id" element={<ReviewSession />} />

              {/* Flow 3 — y tế và chấn thương */}
              <Route path="medical/board" element={<HealthBoard />} />
              <Route path="medical/records" element={<MedicalRecords />} />
              <Route path="medical/locks" element={<TrainingLocks />} />
              <Route path="medical/care" element={<CareSchedules />} />
              <Route path="medical/heart-rate" element={<MaxHeartRateList />} />

              {/* Flow 4 — chăm sóc chuồng trại */}
              <Route path="care/today" element={<TodayCare />} />
              <Route path="care/instructions" element={<CareInstructions />} />
              <Route path="care/diet" element={<DietPlans />} />
              <Route path="care/incidents" element={<IncidentList />} />
              <Route path="care/incidents/new" element={<IncidentForm />} />
              <Route path="care/supplies" element={<Supplies />} />

              {/* Flow 5 — thi đấu và báo cáo */}
              <Route path="races" element={<RaceList />} />
              <Route path="races/approvals" element={<RaceApprovals />} />
              <Route path="races/results" element={<RaceResults />} />
              <Route path="reports" element={<Reports />} />

              {/* Quản trị */}
              <Route path="admin/users" element={<AdminUsers />} />
              <Route path="admin/permissions" element={<AdminPermissions />} />
              <Route path="admin/zones" element={<AdminZones />} />
              <Route path="admin/audit" element={<AdminAudit />} />
              <Route path="admin/system" element={<AdminSystem />} />

              <Route path="*" element={<NotFound message="Đường dẫn này không tồn tại trong hệ thống." />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}

export default App;
