import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users as UsersIcon,
  Briefcase,
  Building2,
  FileText,
  Contact,
  Receipt,
  ShoppingCart,
  LogOut,
  User as UserIconLucide // Renamed to avoid conflict
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/auth', { replace: true });
  };

  // Navigation items based on the routes in your original code
  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { to: '/users', icon: UserIconLucide, label: 'Users' },
    { to: '/leads', icon: UsersIcon, label: 'Leads' },
    { to: '/deals', icon: Briefcase, label: 'Deals' },
    { to: '/customers', icon: Building2, label: 'Customers' },
    { to: '/quote', icon: FileText, label: 'Quote' },
    { to: '/contacts', icon: Contact, label: 'Contacts' },
    { to: '/invoices', icon: Receipt, label: 'Invoices' },
    { to: '/vendors', icon: ShoppingCart, label: 'Vendors' },
  ];

  return (
    <aside
      className="fixed left-4 top-1/2 -translate-y-1/2 h-auto w-16 bg-[#1e293b] rounded-full flex flex-col items-center py-5 shadow-2xl z-50"
      style={{
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
        height: 'calc(100vh - 60px)',
        maxHeight: '800px' // Increased maxHeight to fit all items
      }}
    >
      <nav className="flex flex-col items-center justify-center flex-1 space-y-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <div
            key={to}
            className="relative"
            onMouseEnter={() => setHovered(label)}
            onMouseLeave={() => setHovered(null)}
          >
            <NavLink
              to={to}
              className={({ isActive }) =>
                `w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ease-in-out ${
                  isActive
                    ? 'bg-white text-gray-900 scale-110 shadow-md'
                    : 'bg-transparent text-gray-400 hover:bg-gray-700 hover:text-white'
                }`
              }
              title={label}
            >
              <Icon size={18} strokeWidth={1.5} />
            </NavLink>
            {hovered === label && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 whitespace-nowrap rounded-md bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white shadow-lg z-50">
                {label}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        <button
          onClick={handleLogout}
          className="w-10 h-10 rounded-full bg-transparent text-gray-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors duration-300"
          title="Logout"
        >
          <LogOut size={20} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
