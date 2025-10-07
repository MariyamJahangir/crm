import { api } from './api';


interface Member {
    id: string;
    name: string;
}

export interface Achievement {
    memberId: string;
    memberName: string;
    targetType: 'INVOICE_VALUE' | 'LEADS' | 'N/A';
    targetValue: number;
    achievedValue: number;
    achievementDetails: {
        totalAED: number;
        leadCount: number;
    };
}

interface TargetPayload {
    targetValue: number;
    targetType: string;
    memberId?: string;
}


const getAchievements = async (token: string, year: number, month: number): Promise<{ success: boolean, data?: Achievement[], message?: string }> => {
    return api.get(`/targets/achievements?year=${year}&month=${month}`, token);
};


const getMembers = async (token: string): Promise<{ success: boolean, data?: Member[], message?: string }> => {
    return api.get('/targets/members', token);
};


const setTarget = async (payload: TargetPayload, token: string): Promise<{ success: boolean, message?: string }> => {
    return api.post('/targets', payload, token);
};


const setBulkTargets = async (payload: TargetPayload, token: string): Promise<{ success: boolean, message?: string }> => {
    return api.post('/targets/bulk', payload, token);
};

export const targetService = {
    getAchievements,
    getMembers,
    setTarget,
    setBulkTargets,
};
