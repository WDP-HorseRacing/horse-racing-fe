import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import TrainerHorses from './pages/TrainerHorses';
import TrainerPlan from './pages/TrainerPlan';
import TrainerAdjustPlan from './pages/TrainerAdjustPlan';
import RealtimeTraining from './pages/RealtimeTraining';
import PostSessionEval from './pages/PostSessionEval';
import RaceRegistration from './pages/RaceRegistration';
import { Login } from './pages/Login';
import HorseDetails from './pages/HorseDetails';
import HorseForm from './pages/HorseForm';
import HorsePedigree from './pages/HorsePedigree';
import HorseOwners from './pages/HorseOwners';
import LandingPage from './pages/LandingPage';
import { useStore } from './store/store';

const ProtectedRoute = () => {
  const isAuthenticated = useStore(state => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Outlet />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        
        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Horse Profile & Management (Flow 1) */}
            <Route path="horses" element={<TrainerHorses />} />
            <Route path="horses/new" element={<HorseForm />} />
            <Route path="horses/:id" element={<HorseDetails />} />
            <Route path="horses/:id/edit" element={<HorseForm />} />
            <Route path="horses/:id/pedigree" element={<HorsePedigree />} />
            <Route path="horses/:id/owners" element={<HorseOwners />} />
            
            {/* Training (Flow 2) */}
            <Route path="plan/:id" element={<TrainerPlan />} />
            <Route path="adjust-plan" element={<TrainerAdjustPlan />} />
            <Route path="live-training/:id" element={<RealtimeTraining />} />
            <Route path="eval/:id" element={<PostSessionEval />} />
            
            {/* Race Registration (Flow 5) */}
            <Route path="race-registration" element={<RaceRegistration />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;