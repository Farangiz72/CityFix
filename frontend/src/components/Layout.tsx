import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { HOME_BY_ROLE, ROLE_LABELS } from '../api/labels';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS: Record<string, Array<{ to: string; label: string }>> = {
  RESIDENT: [
    { to: '/my', label: 'Мои заявки' },
    { to: '/my/new', label: 'Новая заявка' },
  ],
  OPERATOR: [{ to: '/queue', label: 'Очередь заявок' }],
  EXECUTOR: [{ to: '/tasks', label: 'Мои задачи' }],
  // BL-T1: кабинет администратора — сводка, заявки, пользователи, справочники, журнал.
  ADMIN: [
    { to: '/admin', label: 'Сводка' },
    { to: '/admin/requests', label: 'Заявки' },
    { to: '/admin/users', label: 'Пользователи' },
    { to: '/admin/directories', label: 'Справочники' },
    { to: '/admin/audit', label: 'Журнал' },
  ],
};

/** Общий каркас: шапка с ролью, навигация по роли, выход. */
export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items = user ? NAV_ITEMS[user.role] ?? [] : [];

  return (
    <div className="app">
      <header className="header">
        <Link className="header__brand" to={user ? HOME_BY_ROLE[user.role] : '/'}>
          City<span>Fix</span>
        </Link>

        {user ? (
          <>
            <nav className="header__nav">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/admin' || item.to === '/my'}
                  className={({ isActive }) => `header__link${isActive ? ' header__link--active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="header__user">
              <span className="header__role">{ROLE_LABELS[user.role].ru}</span>
              <span className="header__name">{user.fullName}</span>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  logout();
                  navigate('/login', { replace: true });
                }}
              >
                Выйти
              </button>
            </div>
          </>
        ) : null}
      </header>

      <main className="main">{children}</main>

      <footer className="footer">
        CityFix · учебный проект · заявки жителей, оператор, служба, администратор
      </footer>
    </div>
  );
}
