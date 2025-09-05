// services/customerService.ts
import { api } from './api';

export type Salesman = { id: string; name: string; email?: string };

export type CustomerContact = {
  id: string;
  name: string;
  designation?: string;
  mobile?: string;
  fax?: string;
  email?: string;
};

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
};

export type ListCustomersResponse = { success: boolean; customers: Customer[] };
export type GetCustomerResponse = { success: boolean; customer: Customer };

export const customerService = {
  list: (token?: string | null) =>
    api.get<ListCustomersResponse>('/customers', token),

  getOne: (id: string, token?: string | null) =>
    api.get<GetCustomerResponse>(`/customers/${id}`, token),

  getContacts: (id: string, token?: string | null) =>
    api.get<{ success: boolean; contacts: CustomerContact[] }>(`/customers/${id}/contacts`, token),

  create: (
    payload: {
      companyName: string;
      contactNumber?: string;
      salesmanId?: string; // make optional so members don’t send it [12][13]
      email?: string;
      vatNo?: string;
      address?: string;
    },
    token?: string | null
  ) => api.post<{ success: boolean; customerId: string }>('/customers', payload, token),

  update: (
    id: string,
    payload: Partial<{
      companyName: string;
      contactNumber: string;
      salesmanId: string;
      email: string;
      vatNo: string;
      address: string;
    }>,
    token?: string | null
  ) => api.put<{ success: boolean }>(`/customers/${id}`, payload, token),

  remove: (id: string, token?: string | null) => api.delete<void>(`/customers/${id}`, token),

  addContact: (
    id: string,
    payload: { name: string; designation?: string; mobile?: string; fax?: string; email?: string },
    token?: string | null
  ) =>
    api.post<{ success: boolean; contact: CustomerContact }>(`/customers/${id}/contacts`, payload, token),

  deleteContact: (id: string, contactId: string, token?: string | null) =>
    api.delete<void>(`/customers/${id}/contacts/${contactId}`, token),

  bulkDeleteContacts: (id: string, contactIds: string[], token?: string | null) =>
    api.post<{ success: boolean }>(`/customers/${id}/contacts/bulk-delete`, { contactIds }, token),
};
