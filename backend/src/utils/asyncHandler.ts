import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Пробрасывает отказ промиса в errorHandler, чтобы не писать try/catch в каждом контроллере. */
export const asyncHandler =
  (handler: AsyncRoute): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };
