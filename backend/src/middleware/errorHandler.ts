import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { HttpError } from '../utils/httpError';

interface ErrorBody {
  error: string;
  details?: unknown;
}

function toHttpError(error: unknown): { status: number; body: ErrorBody } {
  if (error instanceof HttpError) {
    return { status: error.status, body: { error: error.message, details: error.details } };
  }

  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return { status: 413, body: { error: `Файл больше допустимого размера / file too large` } };
    }
    if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
      return { status: 400, body: { error: 'Можно приложить только один файл в поле photo / one file in the photo field' } };
    }
    return { status: 400, body: { error: `Ошибка загрузки файла / upload error: ${error.code}` } };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return { status: 404, body: { error: 'Запись не найдена / record not found' } };
    }
    if (error.code === 'P2002') {
      return { status: 409, body: { error: 'Такая запись уже существует / record already exists' } };
    }
    return { status: 400, body: { error: 'Некорректный запрос к базе данных / invalid database request' } };
  }

  // Синтаксическая ошибка JSON от body-parser
  if (error instanceof SyntaxError && 'body' in error) {
    return { status: 400, body: { error: 'Некорректный JSON в запросе / malformed JSON body' } };
  }

  return { status: 500, body: { error: 'Внутренняя ошибка сервера / internal server error' } };
}

/** Единая точка ответа об ошибке: клиент всегда получает { error: "текст" }. */
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const { status, body } = toHttpError(error);
  if (status >= 500) {
    console.error('[cityfix] unhandled error:', error);
  }
  res.status(status).json(body);
};
