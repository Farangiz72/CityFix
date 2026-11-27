import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/admin', label: 'Сводка', end: true },
  { to: '/admin/requests', label: 'Заявки' },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/directories', label: 'Справочники' },
  { to: '/admin/audit', label: 'Журнал действий' },
];

/** Разделы кабинета администратора (BL-T1): одна панель, пять экранов. */
export function AdminTabs() {
  return (
    <nav className="admin-tabs" aria-label="Разделы администратора">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `admin-tabs__link${isActive ? ' admin-tabs__link--active' : ''}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
