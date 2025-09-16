// src/services/reportsService.ts
import { api } from './api';


export interface MemberSalesReport {
  memberId: string;
  memberName: string;
  dealsWon: number;
  dealsTotalValue: number;
  dealsAverageValue: number;
  conversionRateHistory: number[];
}


export type GetSalesByMemberResponse = {
  success: boolean;
  report: MemberSalesReport[];
};


export const reportsService = {
  getSalesByMember: (token?: string | null) =>
    api.get<GetSalesByMemberResponse>('/reports/sales-by-member', token),
};
