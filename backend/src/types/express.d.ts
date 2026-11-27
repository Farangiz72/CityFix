import type { Role } from '../domain';

/**
 * Пользователь, добавленный middleware `authenticate` в запрос.
 * The authenticated user is attached to the request by `authenticate`.
 */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
