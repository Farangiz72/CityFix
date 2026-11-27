import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loginRequest, meRequest, registerRequest, type RegisterPayload } from '../api/auth';
import { clearToken, getToken, setToken, UNAUTHORIZED_EVENT } from '../api/client';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Восстановление сессии после перезагрузки страницы: токен есть — проверяем его на сервере.
  useEffect(() => {
    let cancelled = false;

    if (!getToken()) {
      setLoading(false);
      return;
    }

    meRequest()
      .then((restored) => {
        if (!cancelled) setUser(restored);
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Истёкший токен (401) разлогинивает автоматически — см. api/client.ts
  useEffect(() => {
    const handle = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, handle);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handle);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const result = await registerRequest(payload);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
}
