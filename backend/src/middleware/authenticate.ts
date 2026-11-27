import type { RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { config } from '../config';
import { isRole } from '../domain';
import { userRepository } from '../repositories/user.repository';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';

/**
 * Проверяет JWT и подставляет актуального пользователя из БД.
 * Роль берётся из базы, а не только из токена: устаревший токен не даёт лишних прав.
 */
export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw unauthorized();
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    throw unauthorized('Сессия истекла, войдите снова / session expired');
  }

  const userId = typeof payload.sub === 'string' ? payload.sub : '';
  const user = userId ? await userRepository.findById(userId) : null;
  if (!user) {
    throw unauthorized('Пользователь не найден / user not found');
  }

  if (!isRole(user.role)) {
    throw unauthorized('Некорректная роль пользователя / invalid user role');
  }

  // BL-T1: блокировка действует сразу, даже если токен выдан раньше (TC-24).
  if (!user.isActive) {
    throw unauthorized('Учётная запись заблокирована / account is blocked');
  }

  req.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  next();
});
