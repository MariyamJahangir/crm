import { api, API_BASE_URL } from './api';

// --- TYPE DEFINITIONS ---
export interface InvoiceItem {
  id: string;
  slNo: number;
  product: string;
  description?: string;
  quantity: number;
  itemRate: number;
  taxPercent?: number;
  taxAmount?: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  quoteId?: string;
  invoiceDate: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  customerType?: 'Vendor' | 'Customer' | null;
  address?: string;
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  salesmanId: string;
  grandTotal: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Cancelled' | 'Overdue';
  items: InvoiceItem[];
  notes?: string;
}

// ★★★ FIX IS HERE ★★★
// Removed 'customerType' from the Omit list to allow it in the payload.
export type ManualInvoicePayload = Omit<Invoice, 
  'id' | 
  'invoiceNumber' | 
  'status' | 

  'items' | 
  'subtotal' | 
  'grandTotal' 
> & {
  items: Omit<InvoiceItem, 'id' | 'lineTotal' | 'taxPercent' | 'taxAmount'>[];
};

export interface ListInvoicesResponse {
  success: boolean;
  invoices: Invoice[];
}

export interface CreateInvoiceResponse {
  success: boolean;
  invoice: Invoice;
  message?: string;
  errors?: { msg: string }[]; // Added to handle validation errors from the previous step
}

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Cancelled' | 'Overdue';

// --- SERVICE OBJECT ---
export const invoiceService = {
  // ... (service methods remain the same)
  list: (token: string): Promise<ListInvoicesResponse> => {
    return api.get('/invoices', token);
  },
  
  create: (
    payload: { quoteId: string } | { manualData: ManualInvoicePayload },
    token: string
  ): Promise<CreateInvoiceResponse> => {
    if ('quoteId' in payload) {
      return api.post(`/invoices/from-quote/${payload.quoteId}`, {}, token);
    }
    return api.post('/invoices', payload, token);
  },

  updateStatus: (
    id: string,
    status: InvoiceStatus,
    token: string
  ): Promise<{ success: boolean; invoice: Invoice }> => {
    return api.patch(`/invoices/${id}/status`, { status }, token);
  },

  previewHtml: (id: string, token: string): Promise<{ success: boolean; html: string }> => {
    return api.get(`/invoices/${id}/preview`, token);
  },
  
  downloadPdf: async (id: string, token: string | null): Promise<Blob> => {
    const headers: HeadersInit = {
      Accept: 'application/pdf',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/invoices/${id}/download`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      let msg = 'Download failed';
      try {
        const errorData = await res.json();
        msg = errorData?.message || msg;
      } catch {
        // Ignore if the response isn't JSON
      }
      throw new Error(msg);
    }
    
    return res.blob();
  },
};
