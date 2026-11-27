import { Prisma } from '@prisma/client';
import type { Priority, RequestStatus } from '../domain';
import { prisma } from '../prisma';

/** Поля карточки списка: без `description`, чтобы 1000 записей не раздували ответ (NFR-1). */
export const requestListSelect = {
  id: true,
  number: true,
  title: true,
  category: true,
  priority: true,
  status: true,
  address: true,
  lat: true,
  lng: true,
  photoUrl: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  author: { select: { id: true, fullName: true } },
  assignee: {
    select: { id: true, fullName: true, service: { select: { id: true, code: true, name: true } } },
  },
} satisfies Prisma.RequestSelect;

export type RequestListRecord = Prisma.RequestGetPayload<{ select: typeof requestListSelect }>;

/** Поля выгрузки в CSV (BL-T1): плоские значения, без вложенных объектов. */
export const requestExportSelect = {
  number: true,
  createdAt: true,
  status: true,
  category: true,
  priority: true,
  title: true,
  address: true,
  lat: true,
  lng: true,
  resolvedAt: true,
  rejectReason: true,
  author: { select: { fullName: true } },
  assignee: { select: { fullName: true } },
} satisfies Prisma.RequestSelect;

export interface ListParams {
  where: Prisma.RequestWhereInput;
  skip: number;
  take: number;
  sort: 'newest' | 'oldest';
}

export interface CreateRequestData {
  title: string;
  description: string;
  /** Код из справочника категорий (BL-T1): строкой, а не enum. */
  category: string;
  priority: Priority;
  address: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
  authorId: string;
}

export const requestRepository = {
  async list({ where, skip, take, sort }: ListParams) {
    const [items, total] = await prisma.$transaction([
      prisma.request.findMany({
        where,
        select: requestListSelect,
        orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
        skip,
        take,
      }),
      prisma.request.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string) {
    return prisma.request.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
        assignee: { select: { id: true, fullName: true, role: true } },
        history: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            comment: true,
            reasonCode: true,
            createdAt: true,
            changedBy: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    });
  },

  /**
   * Создание заявки и первой записи истории — одной транзакцией.
   * В SQLite автоинкремента для не-id поля нет, поэтому сквозной номер выдаётся здесь: max + 1.
   */
  create(data: CreateRequestData) {
    return prisma.$transaction(async (tx) => {
      const last = await tx.request.findFirst({ orderBy: { number: 'desc' }, select: { number: true } });
      const created = await tx.request.create({
        data: {
          number: (last?.number ?? 0) + 1,
          title: data.title,
          description: data.description,
          category: data.category,
          priority: data.priority,
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          photoUrl: data.photoUrl,
          authorId: data.authorId,
        },
      });

      await tx.statusHistory.create({
        data: {
          requestId: created.id,
          fromStatus: null,
          toStatus: 'NEW',
          comment: 'Заявка создана / request created',
          changedById: data.authorId,
        },
      });

      return created;
    });
  },

  /**
   * Смена статуса + запись истории в одной транзакции (TC-6, TC-8, TC-14).
   * Дополнительные поля нужны волне 1: причина отказа, дата возобновления, счётчик возвратов.
   */
  transfer(data: {
    id: string;
    from: RequestStatus;
    to: RequestStatus;
    comment: string | null;
    reasonCode?: string | null;
    changedById: string;
    assigneeId?: string | null;
    resolved: boolean;
    rejectReason?: string | null;
    resumeDate?: Date | null;
    reopen?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: data.id },
        data: {
          status: data.to,
          ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
          ...(data.resolved ? { resolvedAt: new Date() } : {}),
          ...(data.rejectReason !== undefined ? { rejectReason: data.rejectReason } : {}),
          ...(data.resumeDate !== undefined ? { resumeDate: data.resumeDate } : {}),
          // Возврат в работу жителем: заявка снова в работе, подтверждение и дата решения снимаются.
          ...(data.reopen ? { reopenCount: { increment: 1 }, resolvedAt: null, confirmedAt: null } : {}),
        },
      });

      await tx.statusHistory.create({
        data: {
          requestId: data.id,
          fromStatus: data.from,
          toStatus: data.to,
          comment: data.comment,
          ...(data.reasonCode !== undefined ? { reasonCode: data.reasonCode } : {}),
          changedById: data.changedById,
        },
      });
    });
  },

  /** Отметка «житель подтвердил результат» — флаг, а не отдельный статус (BL-R1). */
  confirm(id: string) {
    return prisma.request.update({ where: { id }, data: { confirmedAt: new Date() } });
  },

  stats() {
    return prisma.request.groupBy({ by: ['status'], _count: { _all: true } });
  },

  /** BL-T1: сводка по категориям и по исполнителям (службам). */
  statsByCategory() {
    return prisma.request.groupBy({ by: ['category'], _count: { _all: true } });
  },

  statsByAssignee() {
    return prisma.request.groupBy({ by: ['assigneeId'], _count: { _all: true } });
  },

  /** Среднее время «Новая → Выполнена» считается в сервисе по этим парам дат. */
  resolvedDurations() {
    return prisma.request.findMany({
      where: { status: 'RESOLVED', resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    });
  },

  /** Выгрузка CSV: тот же фильтр, что и у списка; лимит защищает память (NFR-1). */
  exportRows(where: Prisma.RequestWhereInput, take = 5000) {
    return prisma.request.findMany({
      where,
      select: requestExportSelect,
      orderBy: { createdAt: 'desc' },
      take,
    });
  },

  /** BL-T1: администратор исправляет категорию (и, при необходимости, исполнителя). */
  setCategory(id: string, category: string, assigneeId?: string | null) {
    return prisma.request.update({
      where: { id },
      data: { category, ...(assigneeId !== undefined ? { assigneeId } : {}) },
    });
  },

  count() {
    return prisma.request.count();
  },
};
