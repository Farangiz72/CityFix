import { api } from './client';
import type {
  AdminUser,
  AuditEntry,
  CategoryItem,
  CategoryOption,
  Paginated,
  RequestDetails,
  Role,
  ServiceItem,
} from './types';

/**
 * Админские вызовы (BL-T1). Все маршруты под `/admin` закрыты `requireRole('ADMIN')`,
 * поэтому интерфейс — только удобство, права проверяет сервер.
 */

export interface UserQuery {
  search?: string;
  role?: Role | '';
  page?: number;
  limit?: number;
}

export async function fetchUsers(query: UserQuery): Promise<Paginated<AdminUser>> {
  const params: Record<string, string | number> = {};
  if (query.search && query.search.trim()) params.search = query.search.trim();
  if (query.role) params.role = query.role;
  params.page = query.page ?? 1;
  params.limit = query.limit ?? 50;
  const { data } = await api.get<Paginated<AdminUser>>('/admin/users', { params });
  return data;
}

export interface CreateUserPayload {
  email: string;
  fullName: string;
  role: 'OPERATOR' | 'EXECUTOR';
  password: string;
  phone?: string;
  serviceId?: string;
}

export async function createUser(payload: CreateUserPayload): Promise<AdminUser> {
  const { data } = await api.post<AdminUser>('/admin/users', payload);
  return data;
}

export interface UpdateUserPayload {
  fullName?: string;
  phone?: string;
  role?: Role;
  serviceId?: string | null;
  isActive?: boolean;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/admin/users/${id}`, payload);
  return data;
}

/** Пароль показывается один раз — его нужно передать пользователю. */
export async function resetPassword(id: string): Promise<{ user: AdminUser; password: string }> {
  const { data } = await api.post<{ user: AdminUser; password: string }>(`/admin/users/${id}/reset-password`);
  return data;
}

export async function fetchServices(): Promise<ServiceItem[]> {
  const { data } = await api.get<{ items: ServiceItem[] }>('/admin/services');
  return data.items;
}

export async function createService(payload: { code: string; name: string }): Promise<ServiceItem> {
  const { data } = await api.post<ServiceItem>('/admin/services', payload);
  return data;
}

export async function updateService(
  id: string,
  payload: { name?: string; isActive?: boolean },
): Promise<ServiceItem> {
  const { data } = await api.patch<ServiceItem>(`/admin/services/${id}`, payload);
  return data;
}

export async function fetchCategories(): Promise<CategoryItem[]> {
  const { data } = await api.get<{ items: CategoryItem[] }>('/admin/categories');
  return data.items;
}

export async function createCategory(payload: {
  code: string;
  name: string;
  slaHours: number;
}): Promise<CategoryItem> {
  const { data } = await api.post<CategoryItem>('/admin/categories', payload);
  return data;
}

export async function updateCategory(
  id: string,
  payload: { name?: string; slaHours?: number; isActive?: boolean },
): Promise<CategoryItem> {
  const { data } = await api.patch<CategoryItem>(`/admin/categories/${id}`, payload);
  return data;
}

/** Активные категории: ими пользуются форма жителя и фильтр списка (TC-26). */
export async function fetchActiveCategories(): Promise<CategoryOption[]> {
  const { data } = await api.get<{ items: CategoryOption[] }>('/categories');
  return data.items;
}

export async function fetchAudit(query: {
  page?: number;
  limit?: number;
  objectType?: string;
}): Promise<Paginated<AuditEntry>> {
  const params: Record<string, string | number> = { page: query.page ?? 1, limit: query.limit ?? 50 };
  if (query.objectType) params.objectType = query.objectType;
  const { data } = await api.get<Paginated<AuditEntry>>('/admin/audit', { params });
  return data;
}

/** BL-T1 п.3: администратор исправляет категорию (и службу) заявки. */
export async function changeRequestCategory(
  id: string,
  payload: { category: string; assigneeId?: string },
): Promise<RequestDetails> {
  const { data } = await api.patch<RequestDetails>(`/admin/requests/${id}/category`, payload);
  return data;
}

/** BL-T1 п.6: выгрузка CSV по текущему фильтру — файл скачивается браузером. */
export async function downloadRequestsCsv(params: Record<string, string | number>): Promise<number> {
  const response = await api.get<string>('/admin/export/requests.csv', { params, responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cityfix-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return Number(response.headers['x-total-count'] ?? 0);
}
