import { api } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  subjectType: 'ADMIN' | 'MEMBER';
}
export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
}
export interface BasicResponse {
  success: boolean;
  message?: string;
}

export const authService = {
  login: (payload: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', payload),
  me: (token?: string | null) =>
    api.get<{ success: boolean; user: User }>('/auth/me', token),
  forgotPassword: (payload: { email: string }) =>
    api.post<BasicResponse>('/auth/forgot-password', payload),
  resetPassword: (payload: { email: string; otp: string; password: string; confirmPassword: string }) =>
    api.post<BasicResponse>('/auth/reset-password', payload),
  resendOtp: (payload: { email: string }) =>
    api.post<BasicResponse>('/auth/resend-otp', payload),
};
