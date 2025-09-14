// src/services/vendorService.ts

import { api } from './api';

// --- Type Definitions ---
export interface VendorContact {
  id?: string;
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
}

export type VendorStatus = 'Active' | 'Inactive' | 'OnHold' | 'Blacklisted';
export type VendorCategory = 'Manufacturer' | 'Distributor' | 'ServiceProvider' | 'Other';
export type PaymentTerms = 'Advance' | 'Net15' | 'Net30' | 'Net60';

export interface Vendor {
  id: string;
  vendorName: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  industry?: string;
  category?: VendorCategory;
  gstNo?: string;
  panNo?: string;
  paymentTerms?: PaymentTerms;
  status: VendorStatus;
  assignedTo?: string;
  contacts: VendorContact[];
  assignedMember?: { id: string; name: string; };
  createdAt: string;
}

interface VendorQueryParams {
  search?: string;
  status?: string;
  category?: string;
  industry?: string;
  sortBy?: string;
  order?: 'ASC' | 'DESC';
}

export type ListVendorsResponse = {
    success: boolean;
    vendors: Vendor[];
};

export type VendorResponse = {
    success: boolean;
    vendor: Vendor;
};

export const vendorService = {
  list: (token?: string | null, params: VendorQueryParams = {}) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<ListVendorsResponse>(`/vendors?${query}`, token);
  },

  getById: (token?: string | null, id?: string) => {
    return api.get<VendorResponse>(`/vendors/${id}`, token);
  },

  create: (token?: string | null, data?: Partial<Vendor>) => {
    
    return api.post<VendorResponse>('/vendors', data, token);
  },

  update: (token?: string | null, id?: string, data?: Partial<Vendor>) => {
    return api.put<VendorResponse>(`/vendors/${id}`, data, token);
  },

  remove: (token?: string | null, id?: string) => {
    return api.delete<void>(`/vendors/${id}`, token);
  },
  
  bulkDelete: (token?: string | null, ids?: string[]) => {
    return api.post<{ success: boolean }>('/vendors/bulk-delete', { ids }, token);
  },
};
