import path from 'node:path';
import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string, fallback: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) {
    return value;
  }
  if (isProduction) {
    // Fail fast instead of running with a public default secret.
    throw new Error(`Переменная окружения ${name} обязательна / environment variable ${name} is required`);
  }
  return fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET', 'dev-only-secret-change-me-32-characters'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 5),
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  seedOnStart: (process.env.SEED_ON_START ?? 'true') === 'true',
  seedDemoRequests: Number(process.env.SEED_DEMO_REQUESTS ?? 1000),
  bcryptRounds: 10,
} as const;
