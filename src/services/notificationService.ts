import { api } from './api';

export type Notification = {
  _id: string;
  toType: 'ADMIN'|'MEMBER';
  toId: string;
  event: string;
  entityType: 'LEAD'|'CUSTOMER';
  entityId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export const notificationService = {
  list: (token?: string | null, params?: { unread?: boolean; memberId?: string }) => {
    const q = new URLSearchParams();
    if (params?.unread) q.set('unread','true');
    if (params?.memberId) q.set('memberId', params.memberId);
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return api.get<{ success: boolean; notifications: Notification[] }>(`/notifications${suffix}`, token);
  },
  markRead: (id: string, token?: string | null) =>
    api.patch<{ success: boolean }>(`/notifications/${id}/read`, {}, token),
};
