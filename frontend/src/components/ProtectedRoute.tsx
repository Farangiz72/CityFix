import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../api/types';
import { Spinner } from './Spinner';

interface Props {
  roles?: Role[];
  children: ReactElement;
}

/** Защищённый маршрут: без токена — на вход, с чужой ролью — «нет доступа». */
export function ProtectedRoute({ roles, children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Spinner label="Проверяем вход…" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="page">
        <div className="state state--error">
          <h2>Недостаточно прав</h2>
          <p>Роль «{user.role}» не может открыть эту страницу.</p>
        </div>
      </div>
    );
  }

  return children;
}
