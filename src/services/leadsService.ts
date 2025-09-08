// src/services/leadsService.ts
import { api } from './api';

export type SalesmanUser = { id: string; name: string; email?: string };

export type Lead = {
  id: string;
  stage: 'Discover' | 'Solution Validation' | 'Quote' | 'Negotiation' | 'Deal Closed' | 'Deal Lost' | 'Fake Lead';
  forecastCategory: 'Pipeline' | 'BestCase' | 'Commit';
  division: string;
  source?: string;
  uniqueNumber: string;
  quoteNumber?: string;
  previewUrl?: string;
  actualDate: string;
  contactPerson?: string;
  mobile?: string;
  mobileAlt?: string;
  email?: string;
  city?: string;
  salesman?: SalesmanUser | null;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  lostReason?: string;
  createdAt?: string;
  updatedAt?: string;
  customerId?: string;
nextFollowupAt?: string | null;
  attachments?: { filename: string; url: string; createdAt: string }[];
  followups?: { status: string; description?: string; createdAt: string }[];
  logs?: { action: string; message: string; createdAt: string }[];
};

export type ListLeadsResponse = { success: boolean; leads: Lead[] };
export type GetLeadResponse = { success: boolean; lead: Lead };

export const leadsService = {
  list: (token?: string | null) => api.get<ListLeadsResponse>('/leads', token),

  getOne: (id: string, token?: string | null) => api.get<GetLeadResponse>(`/leads/${id}`, token),

  create: (
    body: {
      stage?: Lead['stage'];
      forecastCategory?: Lead['forecastCategory'];
      customerId: string;
      contactId?: string;
      source?: string;
      quoteNumber?: string;
      previewUrl?: string;
      contactPerson?: string;
      mobile?: string;
      mobileAlt?: string;
      email?: string;
      city?: string;
      salesmanId?: string;
      description?: string;
      nextFollowupAt?: string; // added
      lostReason?: string;     // optional on create if stage is Deal Lost
    },
    token?: string | null
  ) => api.post<{ success: boolean; id: string; uniqueNumber: string }>('/leads', body, token),

  update: (
    id: string,
    body: Partial<{
      stage: Lead['stage'];
      forecastCategory: Lead['forecastCategory'];
      customerId: string;
      source: string;
      quoteNumber: string;
      previewUrl: string;
      contactPerson: string;
      mobile: string;
      mobileAlt: string;
      email: string;
      city: string;
      salesmanId: string;
      description: string;
      nextFollowupAt: string | null; // added
      lostReason: string;            // added
    }>,
    token?: string | null
  ) => api.put<{ success: boolean }>(`/leads/${id}`, body, token),

  addAttachment: (id: string, body: { filename: string; url: string }, token?: string | null) =>
    api.post<{ success: boolean }>(`/leads/${id}/attachments`, body, token),

  search: (query: string, page = 1, pageSize = 20, token?: string | null) =>
    api.get<{ success: boolean; leads: Array<{ id:string; uniqueNumber:string; companyName:string; contactPerson?:string; mobile?:string; email?:string; customerId?: string | null; salesman?: { id:string; name:string; email?:string } | null }>; page:number; pageSize:number; total:number }>(
      `/search?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`, token
    ),

  listPage: (page = 1, pageSize = 20, token?: string | null) =>
    api.get<{ success: boolean; leads: Array<{ id:string; uniqueNumber:string; companyName:string; contactPerson?:string; mobile?:string; email?:string; customerId?: string | null; salesman?: { id:string; name:string; email?:string } | null }>; page:number; pageSize:number; total:number }>(
      `/list?page=${page}&pageSize=${pageSize}`, token
    ),

  addFollowup: (id: string, body: { status?: string; description?: string }, token?: string | null) =>
    api.post<{ success: boolean }>(`/leads/${id}/followups`, body, token),
};
