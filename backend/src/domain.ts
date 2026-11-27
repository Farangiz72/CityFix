/**
 * Доменные словари — единственный источник правды для ролей, статусов и переходов.
 * Domain dictionaries: the single source of truth for roles, statuses and transitions.
 *
 * SQLite/Prisma не поддерживает enum, поэтому значения хранятся строками (docs/04-er.md),
 * а допустимость проверяется здесь и в сервисном слое (NFR-2).
 */

export const ROLES = ['RESIDENT', 'OPERATOR', 'EXECUTOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const STATUSES = ['NEW', 'VERIFIED', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'REJECTED'] as const;
export type RequestStatus = (typeof STATUSES)[number];

export const CATEGORIES = ['ROADS', 'LIGHTING', 'WATER', 'WASTE', 'OTHER'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * Причины отказа (BL-T2). Список фиксирован: житель видит понятную причину, статистика — код.
 * Rejection reasons: a fixed list, so the resident sees a clear reason and reports stay groupable.
 */
export const REJECT_REASONS = [
  'DUPLICATE',
  'NOT_CITY_SERVICE',
  'INSUFFICIENT_INFO',
  'SPAM',
  'OTHER',
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** Сужающие проверки для значений из БД: в SQLite они приходят строками. */
export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/**
 * Роли, которые администратор создаёт вручную (BL-T1).
 * Жители регистрируются сами, администраторов добавляет только начальный набор данных.
 */
export const ASSIGNABLE_ROLES = ['OPERATOR', 'EXECUTOR'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/**
 * Коды справочников: заглавные латинские буквы, цифры и подчёркивание.
 * Код категории попадает в `requests.category`, поэтому формат фиксирован.
 */
export const DIRECTORY_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,19}$/;

/**
 * Действия журнала аудита (BL-T1). Коды стабильны: по ним фильтруется журнал,
 * подписи — на стороне интерфейса.
 */
export const AUDIT_ACTIONS = [
  'USER_CREATED',
  'USER_ROLE_CHANGED',
  'USER_SERVICE_CHANGED',
  'USER_BLOCKED',
  'USER_UNBLOCKED',
  'USER_PASSWORD_RESET',
  'SERVICE_CREATED',
  'SERVICE_UPDATED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'REQUEST_CATEGORY_CHANGED',
  'REQUESTS_EXPORTED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export function isStatus(value: string): value is RequestStatus {
  return (STATUSES as readonly string[]).includes(value);
}

export function isRejectReason(value: string): value is RejectReason {
  return (REJECT_REASONS as readonly string[]).includes(value);
}

/**
 * Матрица переходов v2 — единственный источник правды (docs/07-roles-and-statuses.md).
 * Ключ внешнего объекта — текущий статус, внутреннего — целевой, значение — роли.
 *
 * Отличия от v1: добавлены PENDING («Ожидает»), возврат исполнителем оператору
 * (IN_PROGRESS/PENDING → VERIFIED) и возврат в работу жителем (RESOLVED → VERIFIED).
 */
export const STATUS_TRANSITIONS: Record<RequestStatus, Partial<Record<RequestStatus, Role[]>>> = {
  NEW: {
    VERIFIED: ['OPERATOR'],
    REJECTED: ['OPERATOR'],
  },
  VERIFIED: {
    IN_PROGRESS: ['EXECUTOR'],
    REJECTED: ['OPERATOR'],
  },
  IN_PROGRESS: {
    PENDING: ['EXECUTOR'],
    RESOLVED: ['EXECUTOR'],
    VERIFIED: ['EXECUTOR'],
  },
  PENDING: {
    IN_PROGRESS: ['EXECUTOR'],
    VERIFIED: ['EXECUTOR'],
  },
  RESOLVED: {
    VERIFIED: ['RESIDENT'],
  },
  REJECTED: {},
};
