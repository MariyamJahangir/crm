import { api } from './api';

// --- Base Interfaces ---
export interface ChartData {
    labels: string[];
    values: number[];
}

export interface AdminChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor?: string;
        borderColor?: string;
    }[];
}

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

// --- NEW: Interface for mixed-type charts (Bar + Line) ---
export interface MixedChartData {
    labels: string[];
    datasets: ({
        type: 'bar';
        label: string;
        data: number[];
        backgroundColor: string;
        order: number;
    } | {
        type: 'line';
        label: string;
        data: (number | null)[];
        borderColor: string;
        fill: boolean;
        tension: number;
        order: number;
    })[];
}

// NEW: Interface for member target achievement
export interface MemberTargetAchievement {
    name: string;
    target: number;
    achieved: number;
}

// --- Main Dashboard Data Interface ---
export interface DashboardData {
    isAdmin: boolean;
    overallStats: OverallStats;
    totalSalesComparison: ChartData | AdminChartData;
    leadPipeline: LeadStagesData;
    revenueLastSixMonths: MixedChartData;
    memberTargetAchievements: MemberTargetAchievement[]; // NEW
}

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
