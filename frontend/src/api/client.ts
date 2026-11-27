import axios, { type AxiosError } from 'axios';

const TOKEN_KEY = 'cityfix.token';

export const UNAUTHORIZED_EVENT = 'cityfix:unauthorized';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Ошибка API с готовым текстом от сервера — его и показываем пользователю. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const status = error.response?.status ?? 0;
    const message =
      error.response?.data?.error ??
      (status === 0 ? 'Нет связи с сервером / no connection to the server' : error.message);

    if (status === 401) {
      clearToken();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    return Promise.reject(new ApiError(message, status));
  },
);

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Неизвестная ошибка / unknown error';
}
