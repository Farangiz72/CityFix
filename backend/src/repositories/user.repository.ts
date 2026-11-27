import type { Prisma } from '@prisma/client';
import type { Role } from '../domain';
import { prisma } from '../prisma';

/** Публичные поля: пароль не покидает сервер, `isActive` нужен интерфейсу (BL-T1). */
const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  phone: true,
  isActive: true,
  serviceId: true,
  createdAt: true,
} as const;

/** Карточка в админском списке: плюс служба исполнителя. */
const adminUserSelect = {
  ...publicUserSelect,
  service: { select: { id: true, code: true, name: true } },
} as const;

const executorSelect = {
  id: true,
  fullName: true,
  role: true,
  serviceId: true,
  service: { select: { id: true, code: true, name: true } },
} as const;

export type AdminUserRecord = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  phone?: string | null;
  serviceId?: string | null;
}

export interface UpdateUserData {
  fullName?: string;
  phone?: string | null;
  role?: Role;
  serviceId?: string | null;
  isActive?: boolean;
}

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  },

  findByIdWithPassword(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findAdminCard(id: string) {
    return prisma.user.findUnique({ where: { id }, select: adminUserSelect });
  },

  create(data: CreateUserData) {
    return prisma.user.create({ data, select: adminUserSelect });
  },

  update(id: string, data: UpdateUserData) {
    return prisma.user.update({ where: { id }, data, select: adminUserSelect });
  },

  setPassword(id: string, passwordHash: string) {
    return prisma.user.update({ where: { id }, data: { passwordHash }, select: adminUserSelect });
  },

  /** BL-T1: список пользователей с поиском и фильтром по роли. */
  async list({ where, skip, take }: { where: Prisma.UserWhereInput; skip: number; take: number }) {
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: adminUserSelect,
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  /** Сколько активных администраторов: последнего нельзя разжаловать или заблокировать. */
  countActiveAdmins() {
    return prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
  },

  listExecutors() {
    return prisma.user.findMany({
      where: { role: 'EXECUTOR', isActive: true },
      select: executorSelect,
      orderBy: { fullName: 'asc' },
    });
  },

  findExecutor(id: string) {
    return prisma.user.findFirst({ where: { id, role: 'EXECUTOR', isActive: true }, select: executorSelect });
  },

  count() {
    return prisma.user.count();
  },
};
