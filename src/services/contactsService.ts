import {api} from './api';

export interface Company {
  id: string;
  companyName: string;
  entityType: 'Vendor' | 'Customer';
}

// Represents an individual contact person with full details
export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  companyId: string;
  companyName: string;
  entityType: 'Vendor' | 'Customer';
  isPrimary?: boolean;
}

// Type for the API response when searching for companies
interface SearchCompaniesResponse {
  success: boolean;
  contacts: Company[]; // API uses 'contacts' key for the list of companies
}

// Type for the API response when fetching contacts for a specific company
interface GetCompanyContactsResponse {
    success: boolean;
    contacts: Contact[];
}

// Existing types for other contact operations
export type ContactRow = { /* ... your existing ContactRow definition ... */ };
export type CreateContactPayload = { /* ... your existing CreateContactPayload ... */ };
export type ListContactsResponse = { /* ... your existing ListContactsResponse ... */ };

// --- THE PERFECTED SERVICE OBJECT ---
export const contactsService = {
  /**
   * Searches for companies (Vendors and Customers with leads).
   * This is the FIRST step of the selection process.
   */
  searchCompanies: (token: string, query: string): Promise<SearchCompaniesResponse> => {
    const endpoint = `/contacts/search?query=${encodeURIComponent(query)}`;
    return api.get(endpoint, token);
  },

  /**
   * Fetches all individual contact persons for a given company ID.
   */
  getContactsForCompany: (token: string, companyId: string): Promise<GetCompanyContactsResponse> => {
    return api.get(`/contacts/${companyId}`, token);
  },
  
  // --- Other existing functions can remain below ---
  list: (token?: string | null, search?: string) =>
    api.get<ListContactsResponse>(`/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`, token),
  
  create: (payload: CreateContactPayload, token?: string | null) =>
    api.post<{ success: boolean; contact: ContactRow }>(`/contacts`, payload, token),
  
  remove: (id: string, token?: string | null) =>
    api.delete<void>(`/contacts/${id}`, token),
    
  bulkDelete: (ids: string[], token?: string | null) =>
    api.post<{ success: boolean }>(`/contacts/bulk-delete`, { contactIds: ids }, token),
};
