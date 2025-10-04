import { api } from './api'; // Your pre-configured api client


// --- Interface for the API Response ---
export interface DashboardData {
    isAdmin: boolean;
    memberTargetAchievements: any[];
    salesBySalesman: any;
    leadsBySalesman: any;
    quotesBySalesman: any;
    leadsByStage: any;
    leadsByForecast: any;
}


export interface DashboardResponse {
    success: boolean;
    data?: DashboardData;
    message?: string;
}


// --- Service Definition ---


/**
 * Fetches all data for the dashboard in a single API call.
 * @param token The authentication token.
 * @param period The time period string (e.g., 'this_month').
 */
const getData = (token: string, period: string): Promise<DashboardResponse> => {
    const urlWithParams = `/dashboard?period=${period}`;
    return api.get(urlWithParams, token);
};


export const dashboardService = {
    getData,
};
