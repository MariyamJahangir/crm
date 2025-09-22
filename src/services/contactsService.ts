import {api} from './api';

// Represents a company/entity from the initial search
export interface Company {
  id: string;
  companyName: string;
  entityType: 'Vendor' | 'Customer' | 'Lead';
  uniqueNumber?: string;
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
  entityType: 'Vendor' | 'Customer' | 'Lead';
  isPrimary?: boolean;
}

// API response for searching companies
interface SearchCompaniesResponse {
  success: boolean;
  contacts: Company[];
}

// API response for fetching contacts for a specific company
interface GetCompanyContactsResponse {
    success: boolean;
    contacts: Contact[];
}

// Other existing types
export type ContactRow = {
    id: string;
    name: string;
    designation?: string;
    department?: string;
    mobile?: string;
    fax?: string;
    email?: string;
    social?: string;
    customer?: {
        id: string;
        companyName: string;
    }
};

export type CreateContactPayload = {
    customerId: string;
    name: string;
    designation?: string;
    department?: string;
    mobile?: string;
    fax?: string;
    email?: string;
    social?: string;
};

export type UpdateContactPayload = Omit<CreateContactPayload, 'customerId'>;
export type ListContactsResponse = { success: boolean, contacts: ContactRow[] };
export type GetContactResponse = { success: boolean; contact: ContactRow };

export const contactsService = {
  /**
   * Searches for companies (Vendors, Customers, Leads).
   */
  searchCompanies: (token: string, query: string): Promise<SearchCompaniesResponse> => {
    const endpoint = `/contacts/search?query=${encodeURIComponent(query)}`;
    return api.get(endpoint, token);
  },

  /**
   * Fetches all individual contact persons for a given entity ID (company, lead, etc.).
   */
  getContactsForCompany: (token: string, companyId: string): Promise<GetCompanyContactsResponse> => {
    return api.get(`/contacts/${companyId}`, token);
  },
  
  // --- Other functions ---
  list: (token?: string | null, search?: string) =>
    api.get<ListContactsResponse>(`/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`, token),
  
  create: (payload: CreateContactPayload, token?: string | null) =>
    api.post<{ success: boolean; contact: ContactRow }>(`/contacts`, payload, token),

  getOne: (id: string, token?: string | null) =>
    api.get<GetContactResponse>(`/contacts/${id}`, token),

  update: (id: string, payload: UpdateContactPayload, token?: string | null) =>
    api.put<{ success: boolean; contact: ContactRow }>(`/contacts/${id}`, payload, token),
  
  remove: (id: string, token?: string | null) =>
    api.delete<void>(`/contacts/${id}`, token),
    
  bulkDelete: (ids: string[], token?: string | null) =>
    api.post<{ success: boolean }>(`/contacts/bulk-delete`, { contactIds: ids }, token),
};
