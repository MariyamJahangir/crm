// src/components/NotificationModal.tsx

import React from 'react';
import { X } from 'lucide-react';
import { Notification } from '../services/notificationService'; // Assuming type export

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()} // Prevent modal from closing on inner click
      >
        <header className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Notifications</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-800"
          >
            <X size={24} />
          </button>
        </header>

        <main className="p-4 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-gray-500 text-center py-8">You have no notifications.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map(n => (
                <div 
                  key={n._id} 
                  className={`p-3 rounded-md transition-colors ${
                    n.read ? 'bg-gray-50' : 'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">{n.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => onMarkAsRead(n._id)}
                        className="text-xs text-blue-600 hover:underline ml-4 flex-shrink-0"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </main>

        {unreadCount > 0 && (
          <footer className="p-4 border-t">
            <button
              onClick={onMarkAllAsRead}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Mark All as Read
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};

export default NotificationModal;
