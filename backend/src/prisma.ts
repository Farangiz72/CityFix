import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * База — файл внутри проекта: backend/data/cityfix.db (см. README, docs/04-er.md).
 * Внешний сервер БД не нужен; путь можно переопределить переменной DATABASE_URL.
 * The database is a file inside the project; no external DB server is required.
 */
const dataDir = path.resolve(__dirname, '../data');
fs.mkdirSync(dataDir, { recursive: true });

const defaultUrl = `file:${path.join(dataDir, 'cityfix.db').replace(/\\/g, '/')}`;
process.env.DATABASE_URL ??= defaultUrl;

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
