import { api } from './api';
import type { Lead } from './leadsService';
export type QuoteItem = {
  slNo: number;
  product: string;
  description?: string;
  unit?: string;
  quantity: number;
  itemCost: number;
  itemRate: number;
  lineDiscountPercent?: number;
  lineDiscountAmount?: number;
};

export type Quote = {
  id: string;
  quoteNumber: string;
  leadId: string;
  quoteDate: string;
  validityUntil?: string | null;
  salesmanId: string;
  salesmanName?: string;
  customerId?: string | null;
  customerName: string;
  contactPerson?: string;
  phone?: string;
   isMain: boolean; 
  email?: string;
  address?: string;
  description?: string;
  discountMode: 'PERCENT' | 'AMOUNT';
  discountValue: number;
  vatPercent: number;
  subtotal: string;
  totalCost: string;
  discountAmount: string;
  vatAmount: string;
  grandTotal: string;
  grossProfit: string;
  profitPercent: string;
  profitRate: string;
  status?: string;
  preparedBy?: string | null;
  approvedBy?: string | null;
  rejectNote?: string | null;
   isApproved?: boolean;
};

function withAuthHeaders(token?: string | null, extra?: Record<string, string>) {
  const headers: Record<string, string> = extra ? { ...extra } : {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function apiOrigin() {
  const baseUrl =
    import.meta.env.VITE_NODE_ENV == 'development'
      ? import.meta.env.VITE_DEV_API_BASE
      : import.meta.env.VITE_PROD_API_BASE;
  return `${baseUrl}/quotes`;
}

export const quotesService = {
  // Admin-wide list at GET /api/quotes
  listAll: (token?: string | null) =>
    api.get<{ success: boolean; quotes: Quote[] }>('/quotes', token),

setMainQuote: async (leadId: string, quoteNumber: string, token: string | null) => {
   
    return api.post(
      `/quotes/leads/${leadId}/main-quote`, 
      { quoteNumber: quoteNumber },
      token
    );
  },

  // Per-lead list at GET /api/quotes/leads/:leadId/quotes
  listByLead: (leadId: string, token?: string | null) =>
    api.get<{ success: boolean; quotes: Quote[] }>(`/quotes/leads/${leadId}/quotes`, token),

  update(leadId: string, quoteId: string, body: { status?: string }, token?: string | null) {
    return api.put(`/quotes/leads/${leadId}/quotes/${quoteId}`, body, token);
  },

  // Get one at GET /api/quotes/leads/:leadId/quotes/:quoteId
  getOne: (leadId: string, quoteId: string, token?: string | null) =>
    api.get<{ success: boolean; quote: Quote & { items: QuoteItem[] } }>(
      `/quotes/leads/${leadId}/quotes/${quoteId}`,
      token
    ),

  previewHtml: async (leadId: string, quoteId: string, token?: string | null): Promise<{ success: boolean; html: string }> => {
    const res = await fetch(`${apiOrigin()}/leads/${leadId}/quotes/${quoteId}/preview`, {
      method: 'GET',
      headers: withAuthHeaders(token, { 'Accept': 'application/json' }),
      credentials: 'include',
    });
    if (!res.ok) {
      let msg = 'Preview failed';
      try { const j = await res.json(); msg = j?.message || msg; } catch {}
      throw { message: msg };
    }
    return res.json(); // Correctly parse the JSON response
  },
  // listByLead: (leadId: string, token?: string | null) =>
  //   api.get<{ success: boolean; quotes: Quote[] }>(`/quotes/leads/${leadId}/quotes`, token),

  // PDF download
 downloadPdf: async (leadId: string, quoteId: string, token?: string | null): Promise<Blob> => {
    const res = await fetch(`${apiOrigin()}/leads/${leadId}/quotes/${quoteId}/pdf`, {
      method: 'GET',
      headers: withAuthHeaders(token, { Accept: 'application/pdf' }),
      credentials: 'include',
    });

    if (!res.ok) {
      let msg = 'Download failed';
      try {
        const j = await res.json();
        msg = j?.message || msg;
      } catch {
        // The response might not be JSON, so we ignore the parsing error
      }
      throw new Error(msg);
    }
    
    return res.blob();
  },
  // Create at POST /api/quotes/leads/:leadId/quotes
  create: (
    leadId: string,
    body: {
      quoteDate?: string;
      validityUntil?: string | null;
      salesmanId?: string;
      customerId?: string | null;
      customerName: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
      description?: string;
      discountMode: 'PERCENT' | 'AMOUNT';
      discountValue: number;
      vatPercent: number;
      items: QuoteItem[];
    },
    token?: string | null
  ) =>
    api.post<{ success: boolean; quoteId: string; quoteNumber: string }>(
      `/quotes/leads/${leadId}/quotes`,
      body,
      token
    ),

  // Admin actions (optional if backend exposes them)
  approve: (leadId: string, quoteId: string, token?: string | null) =>
    api.post<{ success: boolean }>(`/quotes/${leadId}/${quoteId}/approve`, {}, token),

  reject: (leadId: string, quoteId: string, body: { note?: string }, token?: string | null) =>
    api.post<{ success: boolean }>(`/quotes/${leadId}/${quoteId}/reject`, body, token),
};
