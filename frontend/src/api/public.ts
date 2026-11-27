import { api } from './client';

/**
 * BL-T4 / FR-26: счётчики главной страницы.
 * Маршрут открыт без токена и отдаёт только агрегаты — ни авторов, ни адресов, ни фото.
 */
export interface PublicStats {
  total: number;
  resolved: number;
  inProgress: number;
  open: number;
  rejected: number;
  avgResolutionDays: number | null;
  updatedAt: string;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  const { data } = await api.get<PublicStats>('/public/stats');
  return data;
}
