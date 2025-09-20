import React from 'react';
import {
  LayoutDashboard,
  UserCircle,
  UserPlus,
  Handshake,
  Receipt,
  FileText,
  Settings,
  Store,
  Contact,
  Bell,
  LogOut,
  Users,
  Building2,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
import Emblem from '../../public/artiflex emblem.png'
import Logo from '../../public/artiflex logo.png'
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
      className="group inset-y-0 left-0 z-40 
                 w-16 hover:w-56 
                 bg-midnight-900/60 backdrop-blur-xl 
                 border-r border-midnight-700/40 
                 flex flex-col shadow-2xl 
                 transition-all duration-300 overflow-hidden"
    >
      {/* Brand */}
    <div className="h-16 px-3 border-b border-midnight-700/40 flex items-center transition-all duration-300">
    <div className="flex items-center space-x-2">
        
        {/* Emblem - Always Visible */}
        {/* The size h-12 w-12 was working well, so we keep it. */}
        <img 
            src={Emblem} 
            className="h-14 w-14 flex-shrink-0" 
            alt="Artiflex Emblem" 
        />
        
        {/* Logo - Visible on Hover */}
        {/* We set a fixed height and let the width adjust automatically, with a max-width to prevent it from getting too large. */}
        <img 
            src={Logo} 
            className="h-17 w-auto max-w-[120px] opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
            alt="Artiflex Logo" 
        />

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
            Dashboard
          </span>
        </NavLink>
        <NavLink
          to="/users"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkInactive}`
          }
        >
          <UserCircle size={18} className="mr-3 flex-shrink-0" />
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
          <UserPlus size={18} className="mr-3 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Leads
          </span>
        </NavLink>
        <NavLink
          to="/deals"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <Handshake size={18} className="mr-3 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Deals
          </span>
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
          <FileText size={18} className="mr-3 flex-shrink-0" />
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
          <Contact size={18} className="mr-3 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Contacts
          </span>
        </NavLink>
        <NavLink
          to="/invoices"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <Receipt size={18} className="mr-3 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Invoice
          </span>
        </NavLink>
        <NavLink
          to="/vendors"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <Store size={18} className="mr-3 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Vendors
          </span>
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
