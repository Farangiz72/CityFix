import type {
  AuditAction,
  Category,
  CategoryOption,
  Priority,
  RejectReason,
  RequestStatus,
  Role,
} from './types';

interface Label {
  ru: string;
  en: string;
}

export const STATUS_LABELS: Record<RequestStatus, Label> = {
  NEW: { ru: 'Новая', en: 'New' },
  VERIFIED: { ru: 'Проверена', en: 'Verified' },
  IN_PROGRESS: { ru: 'В процессе', en: 'In progress' },
  PENDING: { ru: 'Ожидает', en: 'Pending' },
  RESOLVED: { ru: 'Выполнена', en: 'Completed' },
  REJECTED: { ru: 'Отклонена', en: 'Rejected' },
};

export const STATUS_ORDER: RequestStatus[] = [
  'NEW',
  'VERIFIED',
  'IN_PROGRESS',
  'PENDING',
  'RESOLVED',
  'REJECTED',
];

export const CATEGORY_LABELS: Record<Category, Label> = {
  ROADS: { ru: 'Дороги', en: 'Roads' },
  LIGHTING: { ru: 'Освещение', en: 'Lighting' },
  WATER: { ru: 'Вода', en: 'Water' },
  WASTE: { ru: 'Мусор', en: 'Waste' },
  OTHER: { ru: 'Другое', en: 'Other' },
};

export const PRIORITY_LABELS: Record<Priority, Label> = {
  LOW: { ru: 'Низкий', en: 'Low' },
  NORMAL: { ru: 'Обычный', en: 'Normal' },
  HIGH: { ru: 'Высокий', en: 'High' },
  URGENT: { ru: 'Срочный', en: 'Urgent' },
};

/**
 * BL-T1: категория приходит строкой из справочника, поэтому подписи ищутся мягко:
 * неизвестный код показывается как есть, а не ломает карточку.
 */
export function categoryLabel(code: string): string {
  return CATEGORY_LABELS[code as Category]?.ru ?? code;
}

export function categoryLabelFull(code: string): string {
  const known = CATEGORY_LABELS[code as Category];
  return known ? `${known.ru} / ${known.en}` : code;
}

/** Категории для фильтра: встроенные плюс активные из справочника (в порядке справочника). */
export function mergeCategories(active: CategoryOption[]): Array<{ code: string; name: string }> {
  const merged = new Map<string, string>();
  for (const option of active) {
    merged.set(option.code, option.name);
  }
  for (const code of Object.keys(CATEGORY_LABELS) as Category[]) {
    if (!merged.has(code)) {
      merged.set(code, CATEGORY_LABELS[code].ru);
    }
  }
  return [...merged.entries()].map(([code, name]) => ({ code, name }));
}

/** BL-T2: фиксированный список причин отказа (совпадает с REJECT_REASONS в domain.ts). */
export const REJECT_REASON_LABELS: Record<RejectReason, Label> = {
  DUPLICATE: { ru: 'Дубликат', en: 'Duplicate' },
  NOT_CITY_SERVICE: { ru: 'Не относится к городским службам', en: 'Not a city service' },
  INSUFFICIENT_INFO: { ru: 'Недостаточно информации', en: 'Insufficient information' },
  SPAM: { ru: 'Спам или некорректное содержание', en: 'Spam or inappropriate content' },
  OTHER: { ru: 'Другое', en: 'Other' },
};

/** BL-T1 п.5: короткие подписи действий в журнале — по ним администратор читает историю. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_CREATED: 'Создан пользователь',
  USER_ROLE_CHANGED: 'Смена роли',
  USER_SERVICE_CHANGED: 'Смена службы',
  USER_BLOCKED: 'Блокировка',
  USER_UNBLOCKED: 'Разблокировка',
  USER_PASSWORD_RESET: 'Сброс пароля',
  SERVICE_CREATED: 'Создана служба',
  SERVICE_UPDATED: 'Служба изменена',
  CATEGORY_CREATED: 'Создана категория',
  CATEGORY_UPDATED: 'Категория изменена',
  REQUEST_CATEGORY_CHANGED: 'Категория заявки',
  REQUESTS_EXPORTED: 'Выгрузка CSV',
};

/** Тип объекта в журнале действий. */
export const AUDIT_OBJECT_LABELS: Record<'USER' | 'SERVICE' | 'CATEGORY' | 'REQUEST', string> = {
  USER: 'Пользователь',
  SERVICE: 'Служба',
  CATEGORY: 'Категория',
  REQUEST: 'Заявка',
};

export const ROLE_LABELS: Record<Role, Label> = {
  RESIDENT: { ru: 'Житель', en: 'Resident' },
  OPERATOR: { ru: 'Оператор', en: 'Operator' },
  EXECUTOR: { ru: 'Исполнитель', en: 'Executor' },
  ADMIN: { ru: 'Администратор', en: 'Admin' },
};

/** Домашняя страница роли — куда ведём после входа. */
export const HOME_BY_ROLE: Record<Role, string> = {
  RESIDENT: '/my',
  OPERATOR: '/queue',
  EXECUTOR: '/tasks',
  ADMIN: '/admin',
};

export function statusLabel(status: RequestStatus): string {
  return `${STATUS_LABELS[status].ru} / ${STATUS_LABELS[status].en}`;
}

/** Показываем приоритет только когда он важен: высокий и срочный. */
export function isPriorityVisible(priority: Priority): boolean {
  return priority === 'HIGH' || priority === 'URGENT';
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
