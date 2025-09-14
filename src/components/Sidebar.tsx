import React from 'react';
import {
  LayoutDashboard,
  User as UserIcon,
  Settings,
  Bell,
  LogOut,
  Users,
  Building2, // Icon for Customers/Companies
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

  // Tailwind classes for link styles
  const linkBase = 'flex items-center px-3 py-2 rounded-lg text-sm transition-colors';
  const linkInactive = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';
  const linkActive = 'bg-gray-100 text-gray-900 font-medium';

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Brand */}
      <div className="h-16 px-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-lg">
            <LayoutDashboard className="h-6 w-6 text-blue-600" />
          </div>
          <span className="ml-3 text-lg font-semibold text-gray-900">Dashboard</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <LayoutDashboard size={18} className="mr-3" />
          Overview
        </NavLink>
        <NavLink
          to="/users"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <UserIcon size={18} className="mr-3" />
          Users
        </NavLink>
        <NavLink
          to="/leads"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <Users size={18} className="mr-3" />
          Leads
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
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <Building2 size={18} className="mr-3" />
          Customers
        </NavLink>

        {/* --- CHANGE: Changed icon from UserIcon to Building2 for better semantics --- */}
        <NavLink
          to="/quote"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <Building2 size={18} className="mr-3" />
          Quote
        </NavLink>

        <NavLink
          to="/contacts"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <Bell size={18} className="mr-3" />
          Contacts
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
      <div className="p-3 border-t border-gray-200">
        <Button
          variant="secondary"
          className="w-full flex items-center justify-center"
          onClick={handleLogout}
        >
          <LogOut size={16} className="mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;