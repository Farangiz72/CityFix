import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import {
  ASSIGNABLE_ROLES,
  CATEGORIES,
  DIRECTORY_CODE_PATTERN,
  ROLES,
  isRole,
  type AuditAction,
  type Role,
} from '../domain';
import { config } from '../config';
import type { AuthUser } from '../types/express';
import { auditRepository } from '../repositories/audit.repository';
import { directoryRepository } from '../repositories/directory.repository';
import { requestRepository } from '../repositories/request.repository';
import { userRepository } from '../repositories/user.repository';
import { badRequest, conflict, notFound } from '../utils/httpError';
import {
  optionalEnum,
  optionalString,
  positiveInt,
  requireEmail,
  requirePassword,
  requireString,
} from '../utils/validate';
import { assertCategoryUsable, buildRequestFilter, requestService } from './request.service';

/** Значения из JSON могут прийти строками: `isActive: false` и `isActive: 'false'` равнозначны. */
function asBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function normalizeCode(value: unknown, field: string): string {
  const code = requireString(value, field, { min: 2, max: 20 }).toUpperCase();
  if (!DIRECTORY_CODE_PATTERN.test(code)) {
    throw badRequest(
      `${field}: заглавные латинские буквы, цифры и «_», например ROADS / letters, digits and underscore`,
    );
  }
  return code;
}

function generatePassword(): string {
  return `Cf-${crypto.randomBytes(6).toString('hex')}`;
}

/** Запись в журнал: единственное место, откуда он пополняется (NFR-4). */
function audit(
  actor: AuthUser,
  action: AuditAction,
  objectType: 'USER' | 'SERVICE' | 'CATEGORY' | 'REQUEST',
  objectId: string,
  summary: string,
  details?: Record<string, unknown>,
) {
  return auditRepository.create({ actorId: actor.id, action, objectType, objectId, summary, details });
}

const ROLE_ORDER: Record<string, number> = { ADMIN: 0, OPERATOR: 1, EXECUTOR: 2, RESIDENT: 3 };

/* ------------------------------ Пользователи ------------------------------ */

async function listUsers(query: Record<string, unknown>) {
  const where: Prisma.UserWhereInput = {};

  const role = optionalEnum(query.role, ROLES, 'Роль');
  if (role) {
    where.role = role;
  }

  const search = optionalString(query.search, 'Поиск', { min: 1, max: 120 });
  if (search) {
    where.OR = [{ email: { contains: search } }, { fullName: { contains: search } }];
  }

  const page = positiveInt(query.page, 1, 1, 10_000);
  const limit = positiveInt(query.limit, 50, 1, 100);
  const { items, total } = await userRepository.list({ where, skip: (page - 1) * limit, take: limit });

  return {
    items: items.sort(
      (a, b) =>
        (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.fullName.localeCompare(b.fullName, 'ru'),
    ),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function resolveService(serviceId: unknown, role: Role | undefined): Promise<string | null> {
  const raw = typeof serviceId === 'string' ? serviceId.trim() : '';
  if (!raw) {
    if (role === 'EXECUTOR') {
      throw badRequest('Исполнителю нужна служба / an executor needs a service');
    }
    return null;
  }
  const service = await directoryRepository.findServiceById(raw);
  if (!service) {
    throw badRequest('Служба не найдена / service not found');
  }
  if (!service.isActive) {
    throw badRequest('Служба отключена / the service is disabled');
  }
  return service.id;
}

/** BL-T1 / TC-23: администратор создаёт оператора или исполнителя (жители регистрируются сами). */
async function createUser(actor: AuthUser, body: Record<string, unknown>) {
  const email = requireEmail(body.email);
  const fullName = requireString(body.fullName, 'ФИО', { min: 3, max: 120 });
  const role = requireEnumRole(body.role);
  const password = requirePassword(body.password);
  const phone = optionalString(body.phone, 'Телефон', { min: 5, max: 30 });
  const serviceId = await resolveService(body.serviceId, role);

  if (await userRepository.findByEmail(email)) {
    throw conflict('Пользователь с таким email уже зарегистрирован / email already registered');
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const created = await userRepository.create({ email, passwordHash, fullName, role, phone, serviceId });

  await audit(actor, 'USER_CREATED', 'USER', created.id, `Создан пользователь ${email} (${role})`, {
    role,
    serviceId,
  });

  return created;
}

function requireEnumRole(value: unknown): Role {
  if (typeof value !== 'string' || !(ASSIGNABLE_ROLES as readonly string[]).includes(value)) {
    throw badRequest(
      `Роль: допустимые значения — ${ASSIGNABLE_ROLES.join(', ')} / allowed: ${ASSIGNABLE_ROLES.join(', ')}`,
    );
  }
  return value as Role;
}

/** BL-T1: смена роли и службы, блокировка. Ограничения — TC-25. */
async function updateUser(actor: AuthUser, id: string, body: Record<string, unknown>) {
  const target = await userRepository.findAdminCard(id);
  if (!target) {
    throw notFound('Пользователь не найден / user not found');
  }
  if (!isRole(target.role)) {
    throw badRequest('Некорректная роль пользователя в базе / corrupted user role');
  }

  if (body.role !== undefined) {
    if (typeof body.role !== 'string' || !isRole(body.role)) {
      throw badRequest(`Роль: допустимые значения — ${ROLES.join(', ')} / allowed: ${ROLES.join(', ')}`);
    }
  }
  const role = body.role === undefined ? target.role : (body.role as Role);
  const isActive = asBoolean(body.isActive) ?? target.isActive;

  // TC-25: себя разжаловать и заблокировать нельзя.
  if (id === actor.id && role !== target.role) {
    throw conflict('Нельзя изменить собственную роль / you cannot change your own role');
  }
  if (id === actor.id && body.isActive !== undefined && isActive === false) {
    throw conflict('Нельзя заблокировать собственную учётную запись / you cannot block yourself');
  }

  // TC-25: последний активный администратор остаётся администратором.
  const removesAdmin =
    target.role === 'ADMIN' && target.isActive && (role !== 'ADMIN' || isActive === false);
  if (removesAdmin && (await userRepository.countActiveAdmins()) <= 1) {
    throw conflict(
      'Нельзя разжаловать или заблокировать последнего администратора / the last administrator must stay active',
    );
  }

  const data: {
    fullName?: string;
    phone?: string | null;
    role?: Role;
    serviceId?: string | null;
    isActive?: boolean;
  } = {};

  if (body.fullName !== undefined) {
    data.fullName = requireString(body.fullName, 'ФИО', { min: 3, max: 120 });
  }
  if (body.phone !== undefined) {
    data.phone = optionalString(body.phone, 'Телефон', { min: 5, max: 30 });
  }
  if (body.role !== undefined) {
    data.role = role;
  }
  if (body.isActive !== undefined) {
    data.isActive = isActive;
  }
  if (body.serviceId !== undefined) {
    data.serviceId = await resolveService(body.serviceId, role);
  } else if (role === 'EXECUTOR' && !target.serviceId) {
    throw badRequest('Исполнителю нужна служба / an executor needs a service');
  } else if (role !== 'EXECUTOR' && target.serviceId) {
    // Оператору и администратору служба не нужна — снимаем привязку.
    data.serviceId = null;
  }

  const updated = await userRepository.update(id, data);

  if (data.role && data.role !== target.role) {
    await audit(actor, 'USER_ROLE_CHANGED', 'USER', id, `Роль ${target.email}: ${target.role} → ${data.role}`, {
      from: target.role,
      to: data.role,
    });
  }
  if (updated.serviceId !== target.serviceId) {
    await audit(
      actor,
      'USER_SERVICE_CHANGED',
      'USER',
      id,
      `Служба ${target.email}: ${target.service?.name ?? 'нет'} → ${updated.service?.name ?? 'нет'}`,
      { from: target.serviceId, to: updated.serviceId },
    );
  }
  if (data.isActive !== undefined && data.isActive !== target.isActive) {
    await audit(
      actor,
      data.isActive ? 'USER_UNBLOCKED' : 'USER_BLOCKED',
      'USER',
      id,
      data.isActive
        ? `Разблокирован пользователь ${target.email}`
        : `Заблокирован пользователь ${target.email}`,
      { isActive: data.isActive },
    );
  }

  return updated;
}

/** BL-T1: сброс пароля. Новый пароль показывается администратору один раз и в журнал не пишется. */
async function resetPassword(actor: AuthUser, id: string, body: Record<string, unknown>) {
  const target = await userRepository.findAdminCard(id);
  if (!target) {
    throw notFound('Пользователь не найден / user not found');
  }

  const password = body.password ? requirePassword(body.password) : generatePassword();
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const updated = await userRepository.setPassword(id, passwordHash);

  await audit(actor, 'USER_PASSWORD_RESET', 'USER', id, `Сброшен пароль пользователя ${target.email}`);

  return { user: updated, password };
}

/* ------------------------------ Справочники ------------------------------ */

async function listServices() {
  const services = await directoryRepository.listServices();
  return { items: services };
}

async function createService(actor: AuthUser, body: Record<string, unknown>) {
  const code = normalizeCode(body.code, 'Код службы');
  const name = requireString(body.name, 'Название', { min: 2, max: 60 });

  if (await directoryRepository.findServiceByCode(code)) {
    throw conflict('Служба с таким кодом уже есть / service code already exists');
  }

  const created = await directoryRepository.createService({ code, name });
  await audit(actor, 'SERVICE_CREATED', 'SERVICE', created.id, `Создана служба ${name} (${code})`);
  return created;
}

async function updateService(actor: AuthUser, id: string, body: Record<string, unknown>) {
  const service = await directoryRepository.findServiceById(id);
  if (!service) {
    throw notFound('Служба не найдена / service not found');
  }

  const isActive = asBoolean(body.isActive);
  const name = body.name === undefined ? undefined : requireString(body.name, 'Название', { min: 2, max: 60 });
  const updated = await directoryRepository.updateService(id, {
    ...(name !== undefined ? { name } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  });

  const executorsCount = await directoryRepository.countServiceUsers(id);
  const changes = [
    name !== undefined && name !== service.name ? `название «${service.name}» → «${name}»` : '',
    isActive !== undefined && isActive !== service.isActive
      ? isActive
        ? 'включена'
        : `отключена (исполнителей: ${executorsCount})`
      : '',
  ].filter(Boolean);

  await audit(
    actor,
    'SERVICE_UPDATED',
    'SERVICE',
    id,
    `Служба ${service.code}: ${changes.join(', ') || 'без изменений'}`,
    { from: { name: service.name, isActive: service.isActive }, to: { name: updated.name, isActive: updated.isActive } },
  );

  return updated;
}

async function listCategories() {
  const categories = await directoryRepository.listCategories();
  return { items: categories };
}

/** Активные категории для формы жителя (TC-26): отключённые не предлагаются. */
async function activeCategories() {
  const categories = await directoryRepository.listCategories();
  const order = (code: string) => {
    const index = (CATEGORIES as readonly string[]).indexOf(code);
    return index === -1 ? CATEGORIES.length : index;
  };
  return {
    items: categories
      .filter((category) => category.isActive)
      .sort((a, b) => order(a.code) - order(b.code) || a.name.localeCompare(b.name, 'ru'))
      .map((category) => ({ code: category.code, name: category.name, slaHours: category.slaHours })),
  };
}

async function createCategory(actor: AuthUser, body: Record<string, unknown>) {
  const code = normalizeCode(body.code, 'Код категории');
  const name = requireString(body.name, 'Название', { min: 2, max: 60 });
  const slaHours = positiveInt(body.slaHours, 72, 1, 8760);

  if (await directoryRepository.findCategoryByCode(code)) {
    throw conflict('Категория с таким кодом уже есть / category code already exists');
  }

  const created = await directoryRepository.createCategory({ code, name, slaHours });
  await audit(actor, 'CATEGORY_CREATED', 'CATEGORY', created.id, `Создана категория ${name} (${code})`);
  return created;
}

async function updateCategory(actor: AuthUser, id: string, body: Record<string, unknown>) {
  const category = await directoryRepository.findCategoryById(id);
  if (!category) {
    throw notFound('Категория не найдена / category not found');
  }

  const name = body.name === undefined ? undefined : requireString(body.name, 'Название', { min: 2, max: 60 });
  const slaHours = body.slaHours === undefined ? undefined : positiveInt(body.slaHours, category.slaHours, 1, 8760);
  const isActive = asBoolean(body.isActive);

  const updated = await directoryRepository.updateCategory(id, {
    ...(name !== undefined ? { name } : {}),
    ...(slaHours !== undefined ? { slaHours } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  });

  const requestsCount = await directoryRepository.countRequestsByCategory(category.code);
  const changes = [
    name !== undefined && name !== category.name ? `название «${category.name}» → «${name}»` : '',
    slaHours !== undefined && slaHours !== category.slaHours ? `SLA ${category.slaHours} → ${slaHours} ч` : '',
    isActive !== undefined && isActive !== category.isActive
      ? isActive
        ? 'включена'
        : `отключена (заявок: ${requestsCount})`
      : '',
  ].filter(Boolean);

  await audit(
    actor,
    'CATEGORY_UPDATED',
    'CATEGORY',
    id,
    `Категория ${category.code}: ${changes.join(', ') || 'без изменений'}`,
    {
      from: { name: category.name, slaHours: category.slaHours, isActive: category.isActive },
      to: { name: updated.name, slaHours: updated.slaHours, isActive: updated.isActive },
    },
  );

  return updated;
}

/* --------------------------- Заявки и журнал --------------------------- */

/** BL-T1: администратор исправляет категорию (и службу вместе с ней), если оператор ошибся. */
async function changeRequestCategory(actor: AuthUser, id: string, body: Record<string, unknown>) {
  const request = await requestRepository.findById(id);
  if (!request) {
    throw notFound('Заявка не найдена / request not found');
  }

  const category = requireString(body.category, 'Категория', { min: 2, max: 20 }).toUpperCase();
  if (category === request.category) {
    throw badRequest('Категория не изменилась / the category is unchanged');
  }
  await assertCategoryUsable(category);

  const requested = typeof body.assigneeId === 'string' ? body.assigneeId.trim() : '';
  let assigneeId: string | null | undefined;

  if (requested) {
    const executor = await userRepository.findExecutor(requested);
    if (!executor) {
      throw badRequest('Исполнитель не найден / executor not found');
    }
    if (executor.service?.code !== category) {
      throw badRequest('Исполнитель не из службы этой категории / executor belongs to another service');
    }
    assigneeId = executor.id;
  } else if (request.assigneeId) {
    const current = await userRepository.findExecutor(request.assigneeId);
    if (!current || current.service?.code !== category) {
      const working = ['VERIFIED', 'IN_PROGRESS', 'PENDING', 'RESOLVED'].includes(request.status);
      if (working) {
        throw badRequest('Выберите исполнителя новой службы / choose an executor of the new service');
      }
      assigneeId = null;
    }
  }

  await requestRepository.setCategory(id, category, assigneeId);
  await audit(
    actor,
    'REQUEST_CATEGORY_CHANGED',
    'REQUEST',
    id,
    `Категория заявки №${request.number}: ${request.category} → ${category}`,
    { from: request.category, to: category, assigneeId: assigneeId ?? request.assigneeId },
  );

  return requestService.get(actor, id);
}

async function listAudit(query: Record<string, unknown>) {
  const where: Prisma.AuditLogWhereInput = {};

  const objectType = optionalEnum(query.objectType, ['USER', 'SERVICE', 'CATEGORY', 'REQUEST'] as const, 'Объект');
  if (objectType) {
    where.objectType = objectType;
  }

  const page = positiveInt(query.page, 1, 1, 10_000);
  const limit = positiveInt(query.limit, 50, 1, 100);
  const { items, total } = await auditRepository.list({ where, skip: (page - 1) * limit, take: limit });

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/* ------------------------------- Экспорт ------------------------------- */

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** BL-T1 п.6: выгрузка по текущему фильтру. `;` и BOM — чтобы Excel открыл кириллицу. */
async function exportRequestsCsv(actor: AuthUser, query: Record<string, unknown>) {
  const { where } = buildRequestFilter(actor, query);
  const rows = await requestRepository.exportRows(where);

  const header = [
    'Номер',
    'Создана',
    'Статус',
    'Категория',
    'Приоритет',
    'Заголовок',
    'Адрес',
    'Широта',
    'Долгота',
    'Житель',
    'Исполнитель',
    'Выполнена',
    'Причина отказа',
  ];

  const lines = rows.map((row) =>
    [
      row.number,
      row.createdAt.toISOString(),
      row.status,
      row.category,
      row.priority,
      row.title,
      row.address,
      row.lat,
      row.lng,
      row.author.fullName,
      row.assignee?.fullName ?? '',
      row.resolvedAt ? row.resolvedAt.toISOString() : '',
      row.rejectReason ?? '',
    ]
      .map(csvCell)
      .join(';'),
  );

  await audit(actor, 'REQUESTS_EXPORTED', 'REQUEST', 'export', `Выгружено заявок в CSV: ${rows.length}`, {
    filter: Object.keys(query).filter((key) => key !== 'page' && key !== 'limit'),
  });

  return { csv: `\uFEFF${header.join(';')}\r\n${lines.join('\r\n')}\r\n`, count: rows.length };
}

export const adminService = {
  listUsers,
  createUser,
  updateUser,
  resetPassword,
  listServices,
  createService,
  updateService,
  listCategories,
  activeCategories,
  createCategory,
  updateCategory,
  changeRequestCategory,
  listAudit,
  exportRequestsCsv,
};
