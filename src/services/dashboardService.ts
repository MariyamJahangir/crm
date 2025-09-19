import {api } from './api';

// --- Base Interfaces for Chart Data ---
export interface ChartData {
    labels: string[];
    values: number[];
}

export interface AdminChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
    }[];
}

// --- Data-Specific Interfaces ---
export interface LeadStagesData {
    labels: string[];
    values: number[];
}

export interface OverallStats {
    queries: number;
    inProgress: number;
    clients: number;
    completed: number;
}

export interface MemberTargetAchievement {
    name: string;
    target: number;
    achieved: number;
    isAchieved: boolean;
}

// --- Main Dashboard Data Interface (Final) ---
export interface DashboardData {
    isAdmin: boolean;
    overallStats: OverallStats;
    leadPipeline: LeadStagesData;
    memberTargetAchievements: MemberTargetAchievement[];
    
    // Charts for Admin
    teamSalesTrend?: AdminChartData;
    monthlySales?: ChartData;
    
    // Charts for Member
    memberDailySales?: ChartData;
    memberMonthlySales?: { year: number, month: number, totalSales: number }[];
}

// --- API Response Interface ---
export interface DashboardResponse {
    success: boolean;
    data?: DashboardData;
    message?: string;
}

// --- Service Definition ---
export const dashboardService = {
    getData: (token: string): Promise<DashboardResponse> => {
        return api.get('/dashboard', token);
    },
};
