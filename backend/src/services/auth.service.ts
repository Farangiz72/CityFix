import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { isRole, type Role } from '../domain';
import { config } from '../config';
import { userRepository } from '../repositories/user.repository';
import { conflict, forbidden, unauthorized } from '../utils/httpError';
import { optionalString, requireEmail, requirePassword, requireString } from '../utils/validate';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  phone: string | null;
  createdAt: Date;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

/**
 * SQLite отдаёт роль строкой — сужаем её до Role.
 * Повреждённое значение трактуется как «житель»: принцип наименьших прав.
 */
function toPublicUser(row: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone: string | null;
  createdAt: Date;
}): PublicUser {
  return { ...row, role: isRole(row.role) ? row.role : 'RESIDENT' };
}

function signToken(user: PublicUser): string {
  const options: SignOptions = {
    subject: user.id,
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign({ role: user.role, email: user.email }, config.jwtSecret, options);
}

/** FR-1: регистрация всегда создаёт жителя; остальные роли приходят из начальных данных. */
async function register(body: Record<string, unknown>): Promise<AuthResult> {
  const email = requireEmail(body.email);
  const password = requirePassword(body.password);
  const fullName = requireString(body.fullName, 'ФИО', { min: 3, max: 120 });
  const phone = optionalString(body.phone, 'Телефон', { min: 5, max: 30 });

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw conflict('Пользователь с таким email уже зарегистрирован / email already registered');
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const created = await userRepository.create({ email, passwordHash, fullName, role: 'RESIDENT', phone });
  const user = toPublicUser(created);
  return { token: signToken(user), user };
}

/** TC-7: неверный пароль даёт 401 и одинаковый текст для «нет пользователя» и «неверный пароль». */
async function login(body: Record<string, unknown>): Promise<AuthResult> {
  const email = requireEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  const found = await userRepository.findByEmail(email);
  const valid = found ? await bcrypt.compare(password, found.passwordHash) : false;
  if (!found || !valid) {
    throw unauthorized('Неверный email или пароль / wrong email or password');
  }

  // BL-T1 / TC-24: заблокированный пользователь не входит даже с верным паролем.
  if (!found.isActive) {
    throw forbidden('Учётная запись заблокирована, обратитесь к администратору / account is blocked');
  }

  const user = toPublicUser(found);
  return { token: signToken(user), user };
}

async function me(userId: string): Promise<PublicUser> {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw unauthorized('Пользователь не найден / user not found');
  }
  return toPublicUser(user);
}

export const authService = { register, login, me };
