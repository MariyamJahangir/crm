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
import { useAuth } from '../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth', { replace: true });
  };

  const linkBase =
    'flex items-center h-10 rounded-lg transition-colors duration-300 whitespace-nowrap overflow-hidden';
  const linkInactive =
    'text-gray-400 hover:bg-gray-700 hover:text-white';
  const linkActive =
    'bg-white text-gray-900 font-semibold shadow-md';

  return (
    <aside
      className="group fixed left-4 top-1/2 -translate-y-1/2 
                 w-16 hover:w-56 bg-[#1e2b3a] rounded-full
                 flex flex-col z-50
                 transition-all duration-300 shadow-2xl"
      style={{
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
        height: 'calc(100vh - 60px)',
        maxHeight: '800px',
      }}
    >
      {/* Brand */}
      <div className="flex items-center h-16 px-3 flex-shrink-0">
        <div className="flex items-center justify-center w-10 h-10 bg-sky-500/40 rounded-lg shadow-md">
            <LayoutDashboard className="h-6 w-10 text-white" />
        </div>
        <span className="ml-2 text-lg font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100">
          Dashboard
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-1">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <div className="flex items-center justify-center flex-shrink-0 w-12 h-10">
            <LayoutDashboard size={18} />
          </div>
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-sm">
            Overview
          </span>
        </NavLink>

        <NavLink
          to="/users"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <div className="flex items-center justify-center flex-shrink-0 w-12 h-10">
            <UserIcon size={18} />
          </div>
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-sm">
            Users
          </span>
        </NavLink>

        <NavLink
          to="/leads"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <div className="flex items-center justify-center flex-shrink-0 w-12 h-10">
            <Users size={18} />
          </div>
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-sm">
            Leads
          </span>
        </NavLink>

        <NavLink
          to="/deals"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <div className="flex items-center justify-center flex-shrink-0 w-12 h-10">
            <Users size={18} />
          </div>
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-sm">
            Deals
          </span>
        </NavLink>

        <NavLink
          to="/customers"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <div className="flex items-center justify-center flex-shrink-0 w-12 h-10">
            <Building2 size={18} />
          </div>
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-sm">
            Customers
          </span>
        </NavLink>

        <NavLink
          to="/quote"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <div className="flex items-center justify-center flex-shrink-0 w-12 h-10">
            <Building2 size={18} />
          </div>
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-sm">
            Quote
          </span>
        </NavLink>

        <NavLink
          to="/contacts"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <div className="flex items-center justify-center flex-shrink-0 w-12 h-10">
            <Bell size={18} />
          </div>
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-sm">
            Contacts
          </span>
        </NavLink>

        <NavLink
          to="/invoices"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <div className="flex items-center justify-center flex-shrink-0 w-12 h-10">
            <Bell size={18} />
          </div>
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-sm">
            Invoices
          </span>
        </NavLink>

        <NavLink
          to="/vendors"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <div className="flex items-center justify-center flex-shrink-0 w-12 h-10">
            <Settings size={18} />
          </div>
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-sm">
            Vendors
          </span>
        </NavLink>
      </nav>

      {/* Footer actions */}
      <div className="p-2 mt-auto flex-shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center h-10 rounded-lg text-gray-400 hover:bg-red-500 hover:text-white transition-colors duration-300"
          title="Logout"
        >
            <div className="flex items-center justify-center flex-shrink-0 w-12 h-10">
              <LogOut size={18} />
            </div>
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-sm">
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;



