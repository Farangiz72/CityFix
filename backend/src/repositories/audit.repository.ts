import type { Prisma } from '@prisma/client';
import type { AuditAction } from '../domain';
import { prisma } from '../prisma';

export interface AuditEntryData {
  actorId: string;
  action: AuditAction;
  objectType: 'USER' | 'SERVICE' | 'CATEGORY' | 'REQUEST';
  objectId: string;
  summary: string;
  details?: Record<string, unknown>;
}

/**
 * Журнал действий (BL-T1, NFR-4): только добавление и чтение.
 * Методов update/delete здесь нет намеренно — запись аудита неизменяема.
 */
export const auditRepository = {
  create(entry: AuditEntryData) {
    return prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        objectType: entry.objectType,
        objectId: entry.objectId,
        summary: entry.summary,
        details: entry.details ? JSON.stringify(entry.details) : null,
      },
    });
  },

  async list({ where, skip, take }: { where: Prisma.AuditLogWhereInput; skip: number; take: number }) {
    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          action: true,
          objectType: true,
          objectId: true,
          summary: true,
          createdAt: true,
          actor: { select: { id: true, fullName: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  },
};
