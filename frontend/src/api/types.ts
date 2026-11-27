export type Role = 'RESIDENT' | 'OPERATOR' | 'EXECUTOR' | 'ADMIN';
export type RequestStatus = 'NEW' | 'VERIFIED' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'REJECTED';
export type Category = 'ROADS' | 'LIGHTING' | 'WATER' | 'WASTE' | 'OTHER';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type RejectReason = 'DUPLICATE' | 'NOT_CITY_SERVICE' | 'INSUFFICIENT_INFO' | 'SPAM' | 'OTHER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  phone: string | null;
  createdAt: string;
}

export interface ShortUser {
  id: string;
  fullName: string;
  role?: Role;
  /** BL-T1: служба исполнителя — по ней администратор фильтрует заявки. */
  service?: ServiceRef | null;
}

export interface HistoryEntry {
  id: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  comment: string | null;
  reasonCode: string | null;
  createdAt: string;
  changedBy: ShortUser;
}

export interface RequestListItem {
  id: string;
  number: number;
  title: string;
  category: Category;
  priority: Priority;
  status: RequestStatus;
  address: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  author: ShortUser;
  assignee: ShortUser | null;
}

export interface RequestDetails extends RequestListItem {
  description: string;
  history: HistoryEntry[];
  /** BL-T2: код причины отказа / rejection reason code */
  rejectReason: RejectReason | null;
  /** BL-R1: отметка «житель подтвердил результат» */
  confirmedAt: string | null;
  /** BL-R1: сколько раз заявку возвращали в работу */
  reopenCount: number;
  /** BL-T3: планируемая дата возобновления из «Ожидает» */
  resumeDate: string | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ExecutorOption {
  id: string;
  fullName: string;
  role: Role;
  serviceId: string | null;
  service: ServiceRef | null;
}

export interface ServiceRef {
  id: string;
  code: string;
  name: string;
}

/** BL-T1: карточка пользователя в админском списке. */
export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  phone: string | null;
  isActive: boolean;
  serviceId: string | null;
  service: ServiceRef | null;
  createdAt: string;
}

export interface ServiceItem extends ServiceRef {
  isActive: boolean;
  createdAt: string;
  _count: { users: number };
}

export interface CategoryItem {
  id: string;
  code: string;
  name: string;
  slaHours: number;
  isActive: boolean;
  createdAt: string;
}

/** Активная категория для формы жителя и фильтра списка. */
export interface CategoryOption {
  code: string;
  name: string;
  slaHours?: number;
}

export interface CountByName {
  code: string;
  name: string;
  isActive: boolean;
  count: number;
}

export interface Stats {
  total: number;
  byStatus: Record<RequestStatus, number>;
  /** BL-T1: разрезы для панели статистики. */
  byCategory: CountByName[];
  byService: CountByName[];
  unassigned: number;
  rejected: number;
  /** Среднее время «Новая → Выполнена» в часах; null, если выполненных ещё нет. */
  avgResolutionHours: number | null;
}

export type AuditAction =
  | 'USER_CREATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_SERVICE_CHANGED'
  | 'USER_BLOCKED'
  | 'USER_UNBLOCKED'
  | 'USER_PASSWORD_RESET'
  | 'SERVICE_CREATED'
  | 'SERVICE_UPDATED'
  | 'CATEGORY_CREATED'
  | 'CATEGORY_UPDATED'
  | 'REQUEST_CATEGORY_CHANGED'
  | 'REQUESTS_EXPORTED';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  objectType: 'USER' | 'SERVICE' | 'CATEGORY' | 'REQUEST';
  objectId: string;
  summary: string;
  createdAt: string;
  actor: ShortUser;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RequestFilters {
  status?: RequestStatus | '';
  category?: Category | '';
  search?: string;
  /** BL-T1: период создания (YYYY-MM-DD). */
  dateFrom?: string;
  dateTo?: string;
  serviceId?: string;
  page?: number;
  limit?: number;
}
