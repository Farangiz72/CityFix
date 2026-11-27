import { prisma } from '../prisma';

/**
 * Справочники служб и категорий (BL-T1).
 * Физического удаления нет: запись, связанная с заявками или пользователями, только отключается
 * (`isActive = false`), иначе ломается история.
 */
export const directoryRepository = {
  listServices() {
    return prisma.service.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { users: true } } },
    });
  },

  findServiceById(id: string) {
    return prisma.service.findUnique({ where: { id } });
  },

  findServiceByCode(code: string) {
    return prisma.service.findUnique({ where: { code } });
  },

  createService(data: { code: string; name: string }) {
    return prisma.service.create({ data });
  },

  updateService(id: string, data: { name?: string; isActive?: boolean }) {
    return prisma.service.update({ where: { id }, data });
  },

  /** Сколько исполнителей привязано к службе — подсказка администратору при отключении. */
  countServiceUsers(id: string) {
    return prisma.user.count({ where: { serviceId: id } });
  },

  listCategories() {
    return prisma.category.findMany({ orderBy: { code: 'asc' } });
  },

  findCategoryById(id: string) {
    return prisma.category.findUnique({ where: { id } });
  },

  findCategoryByCode(code: string) {
    return prisma.category.findUnique({ where: { code } });
  },

  createCategory(data: { code: string; name: string; slaHours: number }) {
    return prisma.category.create({ data });
  },

  updateCategory(id: string, data: { name?: string; slaHours?: number; isActive?: boolean }) {
    return prisma.category.update({ where: { id }, data });
  },

  /** Сколько заявок в категории: по этой цифре решается, можно ли её отключать. */
  countRequestsByCategory(code: string) {
    return prisma.request.count({ where: { category: code } });
  },

  countCategories() {
    return prisma.category.count();
  },
};
