import { badRequest } from './httpError';

interface StringOptions {
  min?: number;
  max?: number;
}

export function requireString(value: unknown, field: string, options: StringOptions = {}): string {
  const { min = 1, max = 5000 } = options;
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min) {
    throw badRequest(`${field}: минимум ${min} символов / at least ${min} characters`);
  }
  if (text.length > max) {
    throw badRequest(`${field}: максимум ${max} символов / at most ${max} characters`);
  }
  return text;
}

export function optionalString(value: unknown, field: string, options: StringOptions = {}): string | null {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  return requireString(value, field, options);
}

export function requireEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`${field}: допустимые значения — ${allowed.join(', ')} / allowed: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return requireEnum(value, allowed, field);
}

export function requireNumber(value: unknown, field: string, min: number, max: number): number {
  if (value === undefined || value === null || value === '') {
    throw badRequest(`${field}: обязательное поле / required field`);
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw badRequest(`${field}: ожидается число / a number is expected`);
  }
  if (parsed < min || parsed > max) {
    throw badRequest(`${field}: значение должно быть от ${min} до ${max} / must be between ${min} and ${max}`);
  }
  return parsed;
}

/**
 * Необязательная дата: пустая строка и null дают null, некорректное значение — 400.
 * Принимает и `2026-11-20`, и полный ISO-таймстемп.
 */
export function optionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const parsed = typeof value === 'string' ? new Date(value.trim()) : new Date(Number.NaN);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${field}: ожидается дата / a valid date is expected`);
  }
  return parsed;
}

/** Парсит целое из query-параметра с ограничением диапазона и значением по умолчанию. */
export function positiveInt(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
}

export function requireEmail(value: unknown): string {
  const email = requireString(value, 'Email', { min: 5, max: 120 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest('Email: неверный формат / invalid format');
  }
  return email;
}

export function requirePassword(value: unknown): string {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 8) {
    throw badRequest('Пароль: минимум 8 символов / password must be at least 8 characters');
  }
  if (password.length > 72) {
    throw badRequest('Пароль: максимум 72 символа / password must be at most 72 characters');
  }
  return password;
}
