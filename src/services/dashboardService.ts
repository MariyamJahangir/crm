// services/dashboardService.js
import { api } from './api'; // Your configured axios instance

// --- TypeScript Interfaces for Type Safety ---

export interface ChartData {
  labels: string[];
  values: (number | string)[];
}

export interface LeadPipelineData {
  discovery: number;
  quote: number;
  deal_closed: number;
}

export interface DashboardData {
  totalSalesComparison: ChartData;
  leadPipeline: LeadPipelineData;
  revenueLastSixMonths: ChartData;
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

// --- Service Object for API Calls ---

export const dashboardService = {
  /**
   * Fetches all dashboard data from the single unified endpoint.
   * The backend will automatically determine whether to return admin or member data
   * based on the provided authentication token.
   *
   * @param token - The JWT token for authentication.
   * @returns A promise that resolves with the dashboard data.
   */
  getData: (token: string): Promise<DashboardResponse> => {
    return api.get('/dashboard', token);
  },
};
