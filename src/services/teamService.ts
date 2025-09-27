import { api } from './api';

export type TeamUser = {
  id: string;
  name: string;
  email: string;
  designation?: string;
  role: 'MEMBER';
  parent?: string | null;
  createdAt?: string;
  isBlocked: boolean;
};

export type ListTeamResponse = { success: boolean; users: TeamUser[] };
export type CreateTeamPayload = { name: string; email: string; password: string; designation?: string; };
export type CreateTeamResponse = { success: boolean; user: TeamUser };

export const teamService = {
  list: (token?: string | null) =>
    api.get<ListTeamResponse>(`/team/users`, token),
  listForSelection: (token: string) => {
        return api.get<{ success: boolean; users: TeamUser[] }>('/team/for-selection', token);
    },
  create: (payload: CreateTeamPayload, token?: string | null) =>
    api.post<CreateTeamResponse>(`/team/users`, payload, token),
  getOne: (id: string, token?: string | null) =>
    api.get<{ success: boolean; user: TeamUser }>(`/team/users/${id}`, token),
  update: (id: string, payload: Partial<CreateTeamPayload>, token?: string | null) =>
    api.put<{ success: boolean; user: TeamUser }>(`/team/users/${id}`, payload, token),
  remove: (id: string, token?: string | null) =>
    api.delete<void>(`/team/users/${id}`, token),
  block: (id: string, token?: string | null) =>
    api.post<{ success: boolean; user: { id: string; isBlocked: boolean } }>(`/team/users/${id}/block`, {}, token),
  unblock: (id: string, token?: string | null) =>
    api.post<{ success: boolean; user: { id: string; isBlocked: boolean } }>(`/team/users/${id}/unblock`, {}, token),

  
};
