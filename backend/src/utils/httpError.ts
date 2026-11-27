/** Ошибка с HTTP-статусом: единственный способ вернуть осмысленный код из сервисов. */
export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string): HttpError => new HttpError(400, message);
export const unauthorized = (message = 'Требуется авторизация / Authorization required'): HttpError =>
  new HttpError(401, message);
export const forbidden = (message: string): HttpError => new HttpError(403, message);
export const notFound = (message: string): HttpError => new HttpError(404, message);
export const conflict = (message: string): HttpError => new HttpError(409, message);
