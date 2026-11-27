import { api } from './client';
import type { AuthResponse, User } from './types';

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export async function loginRequest(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function registerRequest(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function meRequest(): Promise<User> {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data.user;
}
