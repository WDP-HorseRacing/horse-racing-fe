import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Activity, ClipboardList, Flag, LogOut } from 'lucide-react';
import { useStore } from '../store/store';

const MainLayout = () => {
  const { currentUser, logout } = useStore();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'My Horses', path: '/horses', icon: Users },
    { name: 'Schedule', path: '/adjust-plan', icon: Calendar },
    { name: 'Race Reg', path: '/race-registration', icon: Flag },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-[#121212] p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <Flag size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">HorseRacing</span>
        </div>
        
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 font-medium' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`
              }
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </nav>
        
        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden ring-2 ring-emerald-500/20">
                <img src={currentUser?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&h=100&auto=format&fit=crop'} alt="User Avatar" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{currentUser?.name || 'Unknown User'}</p>
                <p className="text-xs text-slate-400 truncate">{currentUser?.role?.replace('_', ' ') || 'Guest'}</p>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center w-full gap-2 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors text-sm font-medium"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-slate-800 flex items-center px-8 bg-[#0a0a0a]/80 backdrop-blur-md">
          <h1 className="text-xl font-semibold text-white">
            {currentUser?.role === 'CLUB_MANAGER' ? 'Management Portal' : 
             currentUser?.role === 'HORSE_OWNER' ? 'Owner Portal' : 
             'Trainer Portal'}
          </h1>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;