import { api } from './client';
import type {
  ExecutorOption,
  Paginated,
  RejectReason,
  RequestDetails,
  RequestFilters,
  RequestListItem,
  RequestStatus,
  Stats,
} from './types';

export async function fetchRequests(filters: RequestFilters): Promise<Paginated<RequestListItem>> {
  const params: Record<string, string | number> = {};
  if (filters.status) params.status = filters.status;
  if (filters.category) params.category = filters.category;
  if (filters.search && filters.search.trim()) params.search = filters.search.trim();
  // BL-T1: период и служба — фильтры администратора, но работают для любого списка.
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.serviceId) params.serviceId = filters.serviceId;
  params.page = filters.page ?? 1;
  params.limit = filters.limit ?? 20;

  const { data } = await api.get<Paginated<RequestListItem>>('/requests', { params });
  return data;
}

export async function fetchRequest(id: string): Promise<RequestDetails> {
  const { data } = await api.get<RequestDetails>(`/requests/${id}`);
  return data;
}

export interface CreateRequestPayload {
  title: string;
  description: string;
  category: string;
  priority: string;
  address: string;
  lat: number;
  lng: number;
  photo?: File | null;
}

/** FR-2: multipart, фото необязательно. */
export async function createRequest(payload: CreateRequestPayload): Promise<RequestDetails> {
  const form = new FormData();
  form.append('title', payload.title);
  form.append('description', payload.description);
  form.append('category', payload.category);
  form.append('priority', payload.priority);
  form.append('address', payload.address);
  form.append('lat', String(payload.lat));
  form.append('lng', String(payload.lng));
  if (payload.photo) {
    form.append('photo', payload.photo);
  }

  const { data } = await api.post<RequestDetails>('/requests', form);
  return data;
}

export interface StatusChangePayload {
  status: RequestStatus;
  comment?: string;
  assigneeId?: string;
  /** BL-T2: обязательно для `REJECTED` */
  reasonCode?: RejectReason;
  /** BL-T3: необязательная дата возобновления для `PENDING` */
  resumeDate?: string;
}

export async function changeStatus(id: string, payload: StatusChangePayload): Promise<RequestDetails> {
  const { data } = await api.patch<RequestDetails>(`/requests/${id}/status`, payload);
  return data;
}

/** BL-R1: подтверждение результата жителем (флаг `confirmedAt`). */
export async function confirmRequest(id: string): Promise<RequestDetails> {
  const { data } = await api.post<RequestDetails>(`/requests/${id}/confirm`);
  return data;
}

/** BL-R1: «Проблема осталась» — возврат в работу (RESOLVED → VERIFIED). */
export async function reopenRequest(id: string, comment?: string): Promise<RequestDetails> {
  const { data } = await api.post<RequestDetails>(`/requests/${id}/reopen`, { comment });
  return data;
}

export async function fetchExecutors(): Promise<ExecutorOption[]> {
  const { data } = await api.get<{ items: ExecutorOption[] }>('/users/executors');
  return data.items;
}

export async function fetchStats(): Promise<Stats> {
  const { data } = await api.get<Stats>('/admin/stats');
  return data;
}
