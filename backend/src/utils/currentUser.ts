import type { Request } from 'express';
import type { AuthUser } from '../types/express';
import { badRequest, unauthorized } from './httpError';

/** Гарантирует, что middleware `authenticate` уже отработал. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) {
    throw unauthorized();
  }
  return req.user;
}

export function paramId(req: Request, name = 'id'): string {
  const value = req.params[name];
  if (!value) {
    throw badRequest('Некорректный идентификатор / invalid id');
  }
  return value;
}
