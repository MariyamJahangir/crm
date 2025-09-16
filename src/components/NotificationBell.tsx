import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationService, Notification } from '../services/notificationService';
import { useSocket } from '../hooks/useSocket';
import NotificationModal from './NotificationModal'; // Ensure this component is created

const NotificationBell: React.FC = () => {
  const { token } = useAuth();
  const socket = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- DATA LOADING ---
  const loadNotifications = async () => {
    if (!token) return;
    try {
      const res = await notificationService.list(token, {});
      setNotifications(res.notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [token]);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;
    const handler = (newNotification: Notification) => {
      setNotifications(prev => [newNotification, ...prev]);
    };
    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [socket]);

  // --- ACTIONS ---
  const handleMarkAsRead = async (id: string) => {
    if (!token) return;
    try {
      await notificationService.markAsRead(id, token);
      setNotifications(prev => 
        prev.map(n => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!token) return;
    try {
      await notificationService.markAllAsRead(token);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* 
        This wrapper div now controls the fixed positioning.
        - `fixed`: Positions the element relative to the viewport.
        - `top-5`: Corresponds to a margin of 1.25rem (20px) from the top.
        - `right-5`: Corresponds to a margin of 1.25rem (20px) from the right.
        - `z-50`: Ensures it sits on top of other content.
      */}
      <div className="fixed top-5 right-5 z-50">
        <button 
          className="relative bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors" 
          onClick={() => setIsModalOpen(true)}
          aria-label="Open notifications"
        >
          <Bell size={24} className="text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      <NotificationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
      />
    </>
  );
};

export default NotificationBell;
