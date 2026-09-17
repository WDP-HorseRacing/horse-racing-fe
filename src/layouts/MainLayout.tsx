import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Flag, LogOut, Activity, Bell, Stethoscope, ClipboardCheck, MapPinned, Camera, BarChart3, Workflow, Boxes, UserCircle } from 'lucide-react';
import { useStore } from '../store/store';
import Lenis from 'lenis';
import { useI18n } from '../i18n/I18nContext';
import { T } from '../i18n/T';

const MainLayout = () => {
  const { currentUser, logout } = useStore();
  const navigate = useNavigate();
  const { language, toggleLanguage, t } = useI18n();

  // Initialize Lenis smooth scroll
  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll');
    if (!scrollContainer) return;

    const lenis = new Lenis({
      wrapper: scrollContainer,
      content: scrollContainer.firstElementChild as HTMLElement,
      smoothWheel: true,
      lerp: 0.08,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  const common = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Horses', path: '/horses', icon: Users },
  ];
  const roleItems = (() => {
    switch (currentUser?.role) {
      case 'VETERINARIAN': return [
        { name: 'Medical', path: '/medical', icon: Stethoscope },
        { name: 'Alerts', path: '/alerts', icon: Bell },
        { name: 'Reports', path: '/reports', icon: BarChart3 },
      ];
      case 'GROOM': return [
        { name: 'Tasks', path: '/tasks', icon: ClipboardCheck },
        { name: 'Stable', path: '/stable', icon: MapPinned },
        { name: 'Report incident', path: '/incidents/new', icon: Camera },
      ];
      case 'CLUB_MANAGER': return [
        { name: 'Operations', path: '/operations', icon: Boxes },
        { name: 'Reports', path: '/reports', icon: BarChart3 },
        { name: 'Race registration', path: '/race-registration', icon: Flag },
      ];
      case 'HORSE_OWNER': return [
        { name: 'Racing', path: '/race-registration', icon: Flag },
        { name: 'Reports', path: '/reports', icon: BarChart3 },
      ];
      default: return [
        { name: 'Schedule', path: '/adjust-plan', icon: Calendar },
        { name: 'Live training', path: '/live-training/goldship', icon: Activity },
        { name: 'Alerts', path: '/alerts', icon: Bell },
        { name: 'Race registration', path: '/race-registration', icon: Flag },
      ];
    }
  })();
  const filteredNavItems = [
    ...common,
    ...roleItems,
    { name: 'Workflow', path: '/workflow', icon: Workflow },
    { name: 'Profile', path: '/profile', icon: UserCircle },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const portalName = (() => {
    switch (currentUser?.role) {
      case 'CLUB_MANAGER': return 'Management portal';
      case 'HORSE_OWNER': return 'Owner portal';
      case 'VETERINARIAN': return 'Veterinary portal';
      case 'GROOM': return 'Groom portal';
      default: return 'Trainer portal';
    }
  })();

  return (
    <div className="flex h-screen bg-[#f8faf8] font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm shadow-emerald-600/20">
            <Flag size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900"><T>HorseRacing</T></span>
        </div>
        
        <nav className="flex-1 space-y-1">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
                  isActive 
                    ? 'bg-emerald-50 text-emerald-700 border-l-[3px] border-emerald-600 ml-[-3px]' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`
              }
            >
              <item.icon size={18} />
              {t(item.name)}
            </NavLink>
          ))}
        </nav>
        
        <div className="mt-auto pt-6 border-t border-gray-100">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-gray-100 overflow-hidden ring-2 ring-emerald-100 shrink-0">
                <img
                  src={currentUser?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&h=100&auto=format&fit=crop'}
                  alt="User avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{currentUser?.name || 'Unknown User'}</p>
                <p className="text-xs text-gray-400 truncate">{currentUser?.role?.replace('_', ' ') || 'Guest'}</p>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center w-full gap-2 py-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 text-sm font-medium active:scale-[0.98]"
            >
              <LogOut size={16} />
              {t('Sign out')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b border-gray-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">{t(portalName)}</h1>
            <p className="text-xs text-gray-400">{t(greeting)}, {currentUser?.name?.split(' ')[0] || 'there'}</p>
          </div>
          <button onClick={toggleLanguage} aria-label="Change language" className="flex items-center rounded-xl border border-gray-200 bg-white p-1 text-xs font-semibold shadow-sm">
            <span className={`rounded-lg px-3 py-1.5 ${language === 'en' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}><T>EN</T></span>
            <span className={`rounded-lg px-3 py-1.5 ${language === 'vi' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}><T>VI</T></span>
          </button>
        </header>
        <div id="main-scroll" className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
