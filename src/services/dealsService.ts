import { api } from './api';
import { Lead } from './leadsService'; // Reuse your main Lead type

// Define a more specific type for the detailed deal view
export type DealDetailsType = Lead & {
  quote?: {
    id: string;
    quoteNumber: string;
    grandTotal: number;
    items: any[]; // Define QuoteItem type if available
    invoice?: {
      id: string;
      invoiceNumber: string;
      grandTotal: number;
    }
  }
};

export interface ListDealsResponse {
  success: boolean;
  deals: DealDetailsType[];
}

export interface SingleDealResponse {
    success: boolean;
    deal: DealDetailsType;
}

export const dealsService = {
  listAll: (token: string): Promise<ListDealsResponse> => {
    return api.get('/deals', token);
  },
  getOne: (id: string, token: string): Promise<SingleDealResponse> => {
    return api.get(`/deals/${id}`, token);
  }
};
