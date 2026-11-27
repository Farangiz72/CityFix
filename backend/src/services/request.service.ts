import { Prisma } from '@prisma/client';
import {
  CATEGORIES,
  isStatus,
  PRIORITIES,
  REJECT_REASONS,
  STATUSES,
  STATUS_TRANSITIONS,
  type RequestStatus,
} from '../domain';
import type { AuthUser } from '../types/express';
import { removeUploadedFile } from '../middleware/upload';
import { directoryRepository } from '../repositories/directory.repository';
import { requestRepository } from '../repositories/request.repository';
import { userRepository } from '../repositories/user.repository';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError';
import {
  optionalDate,
  optionalEnum,
  optionalString,
  positiveInt,
  requireEnum,
  requireNumber,
  requireString,
} from '../utils/validate';

function scopeFor(user: AuthUser): Prisma.RequestWhereInput {
  if (user.role === 'RESIDENT') {
    return { authorId: user.id };
  }
  if (user.role === 'EXECUTOR') {
    return { assigneeId: user.id };
  }
  return {};
}

/** Область видимости берётся из токена, а не из query — «чужие» заявки недостижимы (NFR-2). */
function assertCanView(user: AuthUser, request: { authorId: string; assigneeId: string | null }): void {
  if (user.role === 'RESIDENT' && request.authorId !== user.id) {
    throw forbidden('Заявка принадлежит другому жителю / request belongs to another resident');
  }
  if (user.role === 'EXECUTOR' && request.assigneeId !== user.id) {
    throw forbidden('Заявка назначена другому исполнителю / request is assigned to another executor');
  }
}

/** `2026-11-20` из поля даты — это «весь день», поэтому верхняя граница расширяется до 23:59. */
function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export interface RequestFilter {
  where: Prisma.RequestWhereInput;
  page: number;
  limit: number;
  sort: 'newest' | 'oldest';
}

/**
 * Единый разбор фильтров списка (FR-3, BL-T1): им пользуются и страница заявок, и выгрузка CSV,
 * поэтому «экспорт по текущему фильтру» отдаёт ровно то же, что видно на экране.
 */
export function buildRequestFilter(user: AuthUser, query: Record<string, unknown>): RequestFilter {
  const where: Prisma.RequestWhereInput = { ...scopeFor(user) };

  const status = optionalEnum(query.status, STATUSES, 'Статус');
  if (status) {
    where.status = status;
  }

  // Категория и служба — одно и то же измерение (код службы равен коду категории).
  const category = optionalString(query.category, 'Категория', { min: 2, max: 20 });
  if (category) {
    where.category = category;
  }

  const serviceId = optionalString(query.serviceId, 'Служба', { min: 1, max: 40 });
  if (serviceId) {
    where.assignee = { is: { serviceId } };
  }

  const search = optionalString(query.search, 'Поиск', { min: 1, max: 120 });
  if (search) {
    const numeric = Number(search);
    // SQLite не поддерживает опцию `mode: 'insensitive'`; LIKE и так регистронезависим для ASCII.
    where.OR = [
      { title: { contains: search } },
      { address: { contains: search } },
      ...(Number.isInteger(numeric) && numeric > 0 ? [{ number: numeric }] : []),
    ];
  }

  const dateFrom = optionalDate(query.dateFrom, 'Дата с');
  const dateTo = optionalDate(query.dateTo, 'Дата по');
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: endOfDay(dateTo) } : {}),
    };
  }

  return {
    where,
    page: positiveInt(query.page, 1, 1, 10_000),
    limit: positiveInt(query.limit, 20, 1, 100),
    sort: query.sort === 'oldest' ? 'oldest' : 'newest',
  };
}

async function list(user: AuthUser, query: Record<string, unknown>) {
  const { where, page, limit, sort } = buildRequestFilter(user, query);

  const { items, total } = await requestRepository.list({
    where,
    skip: (page - 1) * limit,
    take: limit,
    sort,
  });

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function get(user: AuthUser, id: string) {
  const request = await requestRepository.findById(id);
  if (!request) {
    throw notFound('Заявка не найдена / request not found');
  }
  assertCanView(user, request);
  return request;
}

/**
 * BL-T1 / TC-26: категория приходит из справочника. Отключённую категорию нельзя выбрать
 * в новой заявке, но старые заявки с ней продолжают открываться.
 */
export async function assertCategoryUsable(code: string): Promise<void> {
  const total = await directoryRepository.countCategories();
  if (total === 0) {
    // База ещё без справочника (свежая миграция) — работаем по встроенному списку.
    if (!(CATEGORIES as readonly string[]).includes(code)) {
      throw badRequest('Категория: неизвестное значение / unknown category');
    }
    return;
  }
  const category = await directoryRepository.findCategoryByCode(code);
  if (!category) {
    throw badRequest('Категория не найдена / category not found');
  }
  if (!category.isActive) {
    throw badRequest('Категория отключена / the category is disabled');
  }
}

/**
 * FR-2 / TC-1…TC-3: создание заявки.
 * Файл приходит multipart-полем `photo`; если валидация не прошла, он удаляется.
 */
async function create(user: AuthUser, body: Record<string, unknown>, file?: Express.Multer.File) {
  try {
    const title = requireString(body.title, 'Название', { min: 5, max: 120 });
    const description = requireString(body.description, 'Описание', { min: 10, max: 2000 });
    const category = requireString(body.category, 'Категория', { min: 2, max: 20 }).toUpperCase();
    const priority = optionalEnum(body.priority, PRIORITIES, 'Приоритет') ?? 'NORMAL';
    const address = requireString(body.address, 'Адрес', { min: 3, max: 200 });

    await assertCategoryUsable(category);

    // TC-2: точка на карте обязательна — проверяется и в браузере, и здесь.
    if (body.lat === undefined || body.lng === undefined || body.lat === '' || body.lng === '') {
      throw badRequest('Укажите место на карте / specify a location on the map');
    }
    const lat = requireNumber(body.lat, 'Широта', -90, 90);
    const lng = requireNumber(body.lng, 'Долгота', -180, 180);

    const created = await requestRepository.create({
      title,
      description,
      category,
      priority,
      address,
      lat,
      lng,
      photoUrl: file ? `/uploads/${file.filename}` : null,
      authorId: user.id,
    });

    return get(user, created.id);
  } catch (error) {
    removeUploadedFile(file?.path);
    throw error;
  }
}

/** FR-3, FR-4: смена статуса с историей, правами и проверкой перехода (матрица v2). */
async function changeStatus(user: AuthUser, id: string, body: Record<string, unknown>) {
  const request = await requestRepository.findById(id);
  if (!request) {
    throw notFound('Заявка не найдена / request not found');
  }

  const to = requireEnum(body.status, STATUSES, 'Статус');
  const from = request.status;
  if (!isStatus(from)) {
    throw conflict('Некорректный статус заявки в базе / corrupted request status');
  }

  const allowedRoles = STATUS_TRANSITIONS[from][to];
  if (!allowedRoles || allowedRoles.length === 0) {
    throw conflict(`Недопустимый переход статуса: ${from} → ${to} / invalid transition`);
  }
  if (!allowedRoles.includes(user.role)) {
    throw forbidden(`Роль ${user.role} не может выполнить это действие / role ${user.role} is not allowed`);
  }

  assertCanView(user, request);

  // Только первичная передача в службу требует выбора исполнителя.
  let assigneeId: string | undefined;
  if (from === 'NEW' && to === 'VERIFIED') {
    const requested = typeof body.assigneeId === 'string' ? body.assigneeId.trim() : '';
    if (!requested) {
      throw badRequest('Выберите исполнителя службы / choose a service executor');
    }
    const executor = await userRepository.findExecutor(requested);
    if (!executor) {
      throw badRequest('Исполнитель не найден / executor not found');
    }
    assigneeId = executor.id;
  }

  const comment = optionalString(body.comment, 'Комментарий', { min: 1, max: 500 });

  // BL-T2: причина отказа берётся из фиксированного списка (TC-10, TC-11).
  let reasonCode: string | null = null;
  let rejectReason: string | null = null;
  if (to === 'REJECTED') {
    reasonCode = requireEnum(body.reasonCode, REJECT_REASONS, 'Причина отказа');
    if (reasonCode === 'OTHER' && !comment) {
      throw badRequest('Для причины «Другое» нужен комментарий / a comment is required for "Other"');
    }
    rejectReason = reasonCode;
  }

  // BL-T3: пауза и выполнение требуют пояснения (TC-13).
  if (to === 'PENDING' && !comment) {
    throw badRequest('Укажите причину приостановки / a pause reason is required');
  }
  if (to === 'RESOLVED' && !comment) {
    throw badRequest('Укажите, что сделано / describe what was fixed');
  }

  const resumeDate = optionalDate(body.resumeDate, 'Дата возобновления');
  const reopen = from === 'RESOLVED' && to === 'VERIFIED';

  await requestRepository.transfer({
    id,
    from,
    to,
    comment,
    reasonCode,
    changedById: user.id,
    ...(assigneeId !== undefined ? { assigneeId } : {}),
    resolved: to === 'RESOLVED',
    ...(to === 'REJECTED' ? { rejectReason } : {}),
    ...(to === 'PENDING' ? { resumeDate } : {}),
    reopen,
  });

  return get(user, id);
}

/** BL-R1: житель подтверждает результат — отметка `confirmedAt`, статус не меняется. */
async function confirm(user: AuthUser, id: string) {
  const request = await requestRepository.findById(id);
  if (!request) {
    throw notFound('Заявка не найдена / request not found');
  }
  if (request.authorId !== user.id) {
    throw forbidden('Подтвердить может только автор заявки / only the author can confirm');
  }
  if (request.status !== 'RESOLVED') {
    throw conflict('Подтвердить можно только выполненную заявку / only a completed request can be confirmed');
  }
  if (request.confirmedAt) {
    throw conflict('Заявка уже подтверждена / the request is already confirmed');
  }

  await requestRepository.confirm(id);
  return get(user, id);
}

/** BL-R1: «Проблема осталась» — возврат в работу (RESOLVED → VERIFIED, счётчик возвратов +1). */
async function reopen(user: AuthUser, id: string, body: Record<string, unknown>) {
  const comment =
    optionalString(body.comment, 'Комментарий', { min: 1, max: 500 }) ??
    'Житель вернул заявку в работу / reopened by the resident';
  return changeStatus(user, id, { status: 'VERIFIED', comment });
}

/**
 * Расширенная сводка (BL-T1): по статусам, службам и категориям, среднее время
 * «Новая → Выполнена» и число отклонённых.
 */
async function stats() {
  const [grouped, total, byCategoryRows, byAssigneeRows, durations, categories, services, executors] =
    await Promise.all([
      requestRepository.stats(),
      requestRepository.count(),
      requestRepository.statsByCategory(),
      requestRepository.statsByAssignee(),
      requestRepository.resolvedDurations(),
      directoryRepository.listCategories(),
      directoryRepository.listServices(),
      userRepository.listExecutors(),
    ]);

  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<RequestStatus, number>;
  for (const row of grouped) {
    if (isStatus(row.status)) {
      byStatus[row.status] = row._count._all;
    }
  }

  const categoryCounts = new Map<string, number>();
  for (const row of byCategoryRows) {
    categoryCounts.set(row.category, row._count._all);
  }
  const byCategory = categories.map((category) => ({
    code: category.code,
    name: category.name,
    isActive: category.isActive,
    count: categoryCounts.get(category.code) ?? 0,
  }));
  // Заявки со старым кодом, которого уже нет в справочнике, не теряются в сводке.
  for (const [code, count] of categoryCounts) {
    if (!categories.some((category) => category.code === code)) {
      byCategory.push({ code, name: code, isActive: false, count });
    }
  }

  const serviceOfExecutor = new Map(executors.map((executor) => [executor.id, executor.service]));
  const serviceCounts = new Map<string, number>();
  let unassigned = 0;
  for (const row of byAssigneeRows) {
    if (!row.assigneeId) {
      unassigned += row._count._all;
      continue;
    }
    const code = serviceOfExecutor.get(row.assigneeId)?.code ?? 'NONE';
    serviceCounts.set(code, (serviceCounts.get(code) ?? 0) + row._count._all);
  }
  const byService = services.map((service) => ({
    code: service.code,
    name: service.name,
    isActive: service.isActive,
    count: serviceCounts.get(service.code) ?? 0,
  }));
  if ((serviceCounts.get('NONE') ?? 0) > 0) {
    byService.push({
      code: 'NONE',
      name: 'Без службы (исполнитель не привязан)',
      isActive: false,
      count: serviceCounts.get('NONE') ?? 0,
    });
  }

  const hours =
    durations.length === 0
      ? null
      : durations.reduce((sum, row) => {
          const resolved = row.resolvedAt ?? row.createdAt;
          return sum + (resolved.getTime() - row.createdAt.getTime()) / 3_600_000;
        }, 0) / durations.length;

  return {
    total,
    byStatus,
    byCategory,
    byService,
    unassigned,
    rejected: byStatus.REJECTED,
    avgResolutionHours: hours === null ? null : Math.round(hours * 10) / 10,
  };
}

async function executors() {
  return userRepository.listExecutors();
}

/**
 * BL-T4 / FR-26: счётчики для главной страницы. Маршрут открыт без токена, поэтому в ответе
 * только агрегаты: ни авторов, ни адресов, ни фото, ни текстов заявок (NFR-3).
 */
async function publicStats() {
  const [grouped, total, durations] = await Promise.all([
    requestRepository.stats(),
    requestRepository.count(),
    requestRepository.resolvedDurations(),
  ]);

  const byStatus = new Map<string, number>();
  for (const row of grouped) {
    byStatus.set(row.status, row._count._all);
  }
  const count = (status: RequestStatus): number => byStatus.get(status) ?? 0;

  const hours =
    durations.length === 0
      ? null
      : durations.reduce((sum, row) => {
          const resolved = row.resolvedAt ?? row.createdAt;
          return sum + (resolved.getTime() - row.createdAt.getTime()) / 3_600_000;
        }, 0) / durations.length;

  return {
    total,
    resolved: count('RESOLVED'),
    inProgress: count('IN_PROGRESS') + count('PENDING'),
    open: count('NEW') + count('VERIFIED'),
    rejected: count('REJECTED'),
    avgResolutionDays: hours === null ? null : Math.round((hours / 24) * 10) / 10,
    updatedAt: new Date().toISOString(),
  };
}

export const requestService = { list, get, create, changeStatus, confirm, reopen, stats, publicStats, executors };
