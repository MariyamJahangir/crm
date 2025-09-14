import { api } from './api'; // Your central API instance

// --- TYPE DEFINITIONS (assuming they are in the same file) ---
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
  address?: string;
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  grandTotal: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Cancelled' | 'Overdue';
  items: InvoiceItem[];
  notes?: string;
}

export type ManualInvoicePayload = Omit<Invoice, 'id' | 'invoiceNumber' | 'status' | 'items' | 'subtotal' | 'grandTotal' | 'notes'> & {
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
}

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Cancelled' | 'Overdue';

// --- SERVICE OBJECT ---
export const invoiceService = {
  list: (token: string): Promise<ListInvoicesResponse> => {
    return api.get('/invoices', token);
  },
  
  // MODIFIED create method
  create: (
    payload: { quoteId: string } | { manualData: ManualInvoicePayload },
    token: string
  ): Promise<CreateInvoiceResponse> => {
    if ('quoteId' in payload) {
      // If a quoteId is provided, use the new conversion route
      return api.post(`/invoices/from-quote/${payload.quoteId}`, {}, token);
    }
    // Otherwise, use the manual creation route
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
};
