// services/customerService.ts
import {api } from './api';

export type Salesman = { id: string; name: string; email?: string };

// FIXED: Added the 'social' property
export type CustomerContact = {
  id: string;
  name: string;
  designation?: string;
  mobile?: string;
  fax?: string;
  email?: string;
  social?: string; // <-- ADDED
};

// NEW: Defined the Attachment type
export type Attachment = {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
};

// FIXED: Added all new properties to the Customer type
export type Customer = {
  id: string;
  companyName: string;
  contactNumber?: string;
  salesman: Salesman | null;
  email?: string;
  vatNo?: string;
  address?: string;
  contacts: CustomerContact[];
  createdAt?: string;
  updatedAt?: string;
  // --- New fields ---
  industry?: string;
  website?: string;
  category?: 'Enterprise' | 'SMB' | 'Individual';
  country?: string;
  sizeOfCompany?: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  status: 'active' | 'inactive' | 'on-hold' | 'closed';
  note?: string;
  attachments?: Attachment[];
};

export type ListCustomersResponse = { success: boolean; customers: Customer[] };
export type GetCustomerResponse = { success:boolean; customer: Customer };

// Base payload for create/update operations
type CustomerPayload = Partial<{
  companyName: string;
  contactNumber: string;
  salesmanId: string;
  email: string;
  vatNo: string;
  address: string;
  industry: string;
  website: string;
  category: 'Enterprise' | 'SMB' | 'Individual' | '';
  country: string;
  sizeOfCompany: '1-10' | '11-50' | '51-200' | '201-500' | '500+' | '';
  status: 'active' | 'inactive' | 'on-hold' | 'closed';
  note: string;
}>;


export const customerService = {
  list: (token?: string | null) =>
    api.get<ListCustomersResponse>('/customers', token),

  getOne: (id: string, token?: string | null) =>
    api.get<GetCustomerResponse>(`/customers/${id}`, token),

  getContacts: (id: string, token?: string | null) =>
    api.get<{ success: boolean; contacts: CustomerContact[] }>(`/customers/${id}/contacts`, token),

  create: (
    payload: CustomerPayload,
    token?: string | null
  ) => api.post<{ success: boolean; customerId: string }>('/customers', payload, token),

  update: (
    id: string,
    payload: CustomerPayload,
    token?: string | null
  ) => api.put<{ success: boolean }>(`/customers/${id}`, payload, token),

  remove: (id: string, token?: string | null) => api.delete<void>(`/customers/${id}`, token),

  addContact: (
    id: string,
    payload: Partial<Omit<CustomerContact, 'id'>>,
    token?: string | null
  ) =>
    api.post<{ success: boolean; contact: CustomerContact }>(`/customers/${id}/contacts`, payload, token),

  deleteContact: (id: string, contactId: string, token?: string | null) =>
    api.delete<void>(`/customers/${id}/contacts/${contactId}`, token),

  bulkDeleteContacts: (id: string, contactIds: string[], token?: string | null) =>
    api.post<{ success: boolean }>(`/customers/${id}/contacts/bulk-delete`, { contactIds }, token),
  
  // FIXED: Corrected the api.post call for multipart/form-data
  uploadAttachments: (id: string, files: File[], token?: string | null) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('attachments', file);
    });
    // Pass headers inside a config object, which is a common pattern for API wrappers
    return api.post<{ success: boolean; attachments: Attachment[] }>(
      `/customers/${id}/attachments`,
      formData,
      token,

    );
  },

  deleteAttachment: (id: string, attachmentId: string, token?: string | null) => {
    return api.delete<{ success: boolean; attachments: Attachment[] }>(
      `/customers/${id}/attachments/${attachmentId}`,
      token
    );
  },
};
