import type { Role } from '../domain';
import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../utils/httpError';

/**
 * NFR-2: права проверяются только на сервере. Кнопка, скрытая в интерфейсе, ничего не значит.
 * Usage: router.patch('/:id/status', authenticate, requireRole('OPERATOR', 'EXECUTOR'), handler)
 */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden(`Роль ${req.user.role} не может выполнить это действие / role ${req.user.role} is not allowed`));
      return;
    }
    next();
  };
