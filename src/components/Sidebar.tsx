import React from 'react';
import {
  LayoutDashboard,
  User as UserIcon,
  Settings,
  Bell,
  LogOut,
  Users,
  Building2,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth', { replace: true });
  };

  const linkBase =
    'flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-300 whitespace-nowrap overflow-hidden';
  const linkInactive =
    'text-ivory-400 hover:bg-midnight-700/40 hover:text-ivory-100 backdrop-blur-md';
  const linkActive =
    'bg-midnight-600/50 text-ivory-100 font-medium shadow-inner backdrop-blur-md';

  return (
    <aside
      className="group fixed inset-y-0 left-0 z-40 
                 w-16 hover:w-56 
                 bg-midnight-900/80 backdrop-blur-xl 
                 border-r border-midnight-700/40 
                 flex flex-col shadow-2xl 
                 transition-all duration-300 overflow-hidden"
    >
      {/* Brand */}
      <div className="h-16 px-4 border-b border-midnight-700/40 flex items-center transition-all duration-300">
        <div className="flex items-center space-x-3">
          <div className="bg-sky-500/40 p-2 rounded-lg backdrop-blur-md shadow-md">
            <LayoutDashboard className="h-6 w-6 text-ivory-100" />
          </div>
          <span className="text-lg font-semibold text-ivory-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Dashboard
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkInactive}`
          }
        >
          <LayoutDashboard size={18} className="mr-3 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Overview
          </span>
        </NavLink>
        <NavLink
          to="/users"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkInactive}`
          }
        >
          <UserIcon size={18} className="mr-3 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Users
          </span>
        </NavLink>
        <NavLink
          to="/leads"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkInactive}`
          }
        >
          <Users size={18} className="mr-3 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Leads
          </span>
        </NavLink>
           <NavLink
          to="/deals"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <Users size={18} className="mr-3" />
          Deals
        </NavLink>

        {/* --- CHANGE: Added Building2 icon for consistency --- */}
        <NavLink
          to="/customers"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkInactive}`
          }
        >
          <Building2 size={18} className="mr-3 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Customers
          </span>
        </NavLink>
        <NavLink
          to="/quote"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkInactive}`
          }
        >
          <Building2 size={18} className="mr-3 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Quote
          </span>
        </NavLink>
        <NavLink
          to="/contacts"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkInactive}`
          }
        >
          <Bell size={18} className="mr-3 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Contacts
          </span>
        </NavLink>
<NavLink
          to="/invoices"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <Bell size={18} className="mr-3" />
          invoice
        </NavLink>
        <NavLink
          to="/vendors"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <Settings size={18} className="mr-3" />
         vendors
        </NavLink>
      </nav>

      {/* Footer actions */}
      <div className="p-3 border-t border-midnight-700/40">
        <Button
          variant="secondary"
          className="w-full flex items-center justify-start px-3
                     bg-sky-500/70 text-ivory-50 hover:bg-sky-600/80 
                     backdrop-blur-md border border-sky-400/30
                     transition-all duration-300 rounded-lg shadow-md"
          onClick={handleLogout}
        >
          <LogOut size={16} className="flex-shrink-0" />
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Logout
          </span>
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
