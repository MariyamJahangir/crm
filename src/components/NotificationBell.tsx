import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationService, Notification } from '../services/notificationService';
import { useSocket } from '../hooks/useSocket';

const NotificationBell: React.FC = () => {
  const { token, user } = useAuth();
  const socket = useSocket();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const res = await notificationService.list(token, {});
      setItems(res.notifications);
    } catch {}
  };

  useEffect(() => { load(); }, [token]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => load();
    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [socket]);

  const unread = items.filter(i => !i.read).length;

  return (
    <div className="relative">
      <button className="relative" onClick={() => setOpen(o => !o)}>
        <Bell />
        {unread > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-50 max-h-96 overflow-auto">
          <div className="p-2 text-sm font-medium border-b">Notifications</div>
          {items.length === 0 && <div className="p-3 text-sm text-gray-500">No notifications</div>}
          {items.map(n => (
            <div key={n._id} className="p-3 border-b">
              <div className="text-sm font-semibold">{n.title}</div>
              <div className="text-xs text-gray-600">{n.message}</div>
              <div className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
