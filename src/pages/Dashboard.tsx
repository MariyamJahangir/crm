import React from 'react';
import { User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-midnight-800/50 transition-colors duration-300">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto min-h-screen">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Welcome Card */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white mb-8 shadow-md">
            <div className="flex items-center">
              <div className="bg-white/20 p-3 rounded-full">
                <User className="h-8 w-8" />
              </div>
              <div className="ml-4">
                <h2 className="text-3xl font-bold">
                  Welcome back, {user?.name || 'User'}!
                </h2>
                <p className="text-blue-100 mt-1">
                  Ready to make today productive?
                </p>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Example stat cards (replace with real data) */}
            <div className="bg-white dark:bg-midnight-700 rounded-xl p-6 shadow">
              <p className="text-gray-600 dark:text-midnight-300">Total Vendors</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-ivory-200">42</h3>
            </div>
            <div className="bg-white dark:bg-midnight-700 rounded-xl p-6 shadow">
              <p className="text-gray-600 dark:text-midnight-300">Active Deals</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-ivory-200">15</h3>
            </div>
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Example cards */}
            <div className="lg:col-span-2 bg-white dark:bg-midnight-700 rounded-xl p-6 shadow">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-ivory-200 mb-4">
                Recent Activity
              </h4>
              <p className="text-gray-600 dark:text-midnight-300">Activity feed will go here...</p>
            </div>
            <div className="bg-white dark:bg-midnight-700 rounded-xl p-6 shadow">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-ivory-200 mb-4">
                Notifications
              </h4>
              <p className="text-gray-600 dark:text-midnight-300">Notifications panel...</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
