// src/services/contactsService.ts
import {api} from './api';

export type ContactRow = {
  id: string;
  name: string;
  designation?: string;
  department?: string;
  email?: string;
  mobile?: string;
  fax?: string;
  social?: string;
  customer?: {
    id: string;
    companyName: string;
    industry?: string;
    category?: string;
    website?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ListContactsResponse = {
  success: boolean;
  contacts: ContactRow[];
};

export const contactsService = {
  list: (token?: string | null, search?: string) =>
    api.get<ListContactsResponse>(`/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`, token),
  remove: (id: string, token?: string | null) =>
    api.delete<void>(`/contacts/${id}`, token),
  bulkDelete: (ids: string[], token?: string | null) =>
    api.post<{ success: boolean }>(`/contacts/bulk-delete`, { contactIds: ids }, token),
};
