import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  createUser,
  fetchServices,
  fetchUsers,
  resetPassword,
  updateUser,
  type CreateUserPayload,
} from '../../api/admin';
import { errorMessage } from '../../api/client';
import { formatDateTime, ROLE_LABELS } from '../../api/labels';
import type { AdminUser, Paginated, Role, ServiceItem } from '../../api/types';
import { AdminTabs } from '../../components/AdminTabs';
import { Pagination } from '../../components/Pagination';
import { EmptyState, ErrorBox, Spinner } from '../../components/Spinner';

const MANAGEABLE_ROLES: Role[] = ['RESIDENT', 'OPERATOR', 'EXECUTOR', 'ADMIN'];

interface FormState {
  email: string;
  fullName: string;
  role: 'OPERATOR' | 'EXECUTOR';
  password: string;
  phone: string;
  serviceId: string;
}

const EMPTY_FORM: FormState = {
  email: '',
  fullName: '',
  role: 'OPERATOR',
  password: '',
  phone: '',
  serviceId: '',
};

/** BL-T1 п.1: список пользователей, создание, смена роли и службы, блокировка, сброс пароля. */
export function AdminUsersPage() {
  const [data, setData] = useState<Paginated<AdminUser> | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchUsers({ search, role, page }));
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setLoading(false);
    }
  }, [search, role, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetchServices()
      .then(setServices)
      .catch(() => setServices([]));
  }, []);

  const act = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await load();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload: CreateUserPayload = {
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      role: form.role,
      password: form.password,
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.role === 'EXECUTOR' && form.serviceId ? { serviceId: form.serviceId } : {}),
    };
    void act(async () => {
      await createUser(payload);
      setForm(EMPTY_FORM);
      setFormOpen(false);
    }, `Пользователь ${payload.email} создан.`);
  };

  const resetUserPassword = (user: AdminUser) => {
    void (async () => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const result = await resetPassword(user.id);
        setNotice(`Новый пароль для ${user.email}: ${result.password} — передайте его пользователю.`);
        await load();
      } catch (problem) {
        setError(errorMessage(problem));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="admin">
      <section className="page">
        <div className="page__head">
          <div>
            <h1>Пользователи</h1>
            <p className="page__subtitle">
              Жители регистрируются сами; операторов и исполнителей создаёт администратор
            </p>
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setFormOpen((open) => !open)}
          >
            {formOpen ? 'Свернуть форму' : 'Создать пользователя'}
          </button>
        </div>

        <AdminTabs />

        {error ? <ErrorBox message={error} /> : null}
        {notice ? <p className="notice">{notice}</p> : null}

        {formOpen ? (
          <form className="card form" onSubmit={submit}>
            <h2>Новый пользователь</h2>
            <div className="form__row">
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </label>
              <label className="field">
                <span>ФИО или название службы</span>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={120}
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                />
              </label>
            </div>

            <div className="form__row">
              <label className="field">
                <span>Роль</span>
                <select
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value as 'OPERATOR' | 'EXECUTOR' })}
                >
                  <option value="OPERATOR">Оператор</option>
                  <option value="EXECUTOR">Исполнитель</option>
                </select>
              </label>
              <label className="field">
                <span>Служба (для исполнителя)</span>
                <select
                  value={form.serviceId}
                  disabled={form.role !== 'EXECUTOR'}
                  onChange={(event) => setForm({ ...form, serviceId: event.target.value })}
                >
                  <option value="">— не выбрана —</option>
                  {services
                    .filter((service) => service.isActive)
                    .map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="form__row">
              <label className="field">
                <span>Пароль (минимум 8 символов)</span>
                <input
                  type="text"
                  required
                  minLength={8}
                  maxLength={72}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Телефон (необязательно)</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </label>
            </div>

            <div className="form__actions">
              <button type="button" className="button button--secondary" onClick={() => setFormOpen(false)}>
                Отмена
              </button>
              <button type="submit" className="button button--primary" disabled={busy}>
                Создать
              </button>
            </div>
          </form>
        ) : null}

        <div className="filters">
          <label className="field field--inline">
            <span>Роль</span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value as Role | '');
                setPage(1);
              }}
            >
              <option value="">Все</option>
              {MANAGEABLE_ROLES.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABELS[item].ru}
                </option>
              ))}
            </select>
          </label>

          <form
            className="field field--inline field--search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput);
              setPage(1);
            }}
          >
            <span>Поиск</span>
            <input
              type="search"
              value={searchInput}
              placeholder="email или ФИО"
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <button type="submit" className="button button--secondary">
              Найти
            </button>
          </form>
        </div>

        {loading ? <Spinner /> : null}

        {!loading && data ? (
          data.items.length === 0 ? (
            <EmptyState title="Пользователей нет" hint="Измените фильтр или создайте нового пользователя." />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Пользователь</th>
                      <th>Роль</th>
                      <th>Служба</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((user) => (
                      <tr key={user.id} className={user.isActive ? '' : 'table__row--off'}>
                        <td>
                          <span className="table__strong">{user.fullName}</span>
                          <span className="table__muted">{user.email}</span>
                          <span className="table__muted">создан {formatDateTime(user.createdAt)}</span>
                        </td>
                        <td>
                          <select
                            value={user.role}
                            disabled={busy}
                            aria-label={`Роль ${user.email}`}
                            onChange={(event) => {
                              const next = event.target.value as Role;
                              void act(
                                () => updateUser(user.id, { role: next }),
                                `Роль ${user.email}: ${ROLE_LABELS[next].ru}.`,
                              );
                            }}
                          >
                            {MANAGEABLE_ROLES.map((item) => (
                              <option key={item} value={item}>
                                {ROLE_LABELS[item].ru}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {user.role === 'EXECUTOR' ? (
                            <select
                              value={user.serviceId ?? ''}
                              disabled={busy}
                              aria-label={`Служба ${user.email}`}
                              onChange={(event) => {
                                const next = event.target.value;
                                void act(
                                  () => updateUser(user.id, { serviceId: next || null }),
                                  `Служба ${user.email} обновлена.`,
                                );
                              }}
                            >
                              <option value="">— не выбрана —</option>
                              {services.map((service) => (
                                <option key={service.id} value={service.id}>
                                  {service.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="table__muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className={`pill ${user.isActive ? 'pill--on' : 'pill--blocked'}`}>
                            {user.isActive ? 'активен' : 'заблокирован'}
                          </span>
                        </td>
                        <td>
                          <div className="table__actions">
                            <button
                              type="button"
                              className="button button--secondary button--small"
                              disabled={busy}
                              onClick={() =>
                                void act(
                                  () => updateUser(user.id, { isActive: !user.isActive }),
                                  user.isActive
                                    ? `Пользователь ${user.email} заблокирован.`
                                    : `Пользователь ${user.email} разблокирован.`,
                                )
                              }
                            >
                              {user.isActive ? 'Заблокировать' : 'Разблокировать'}
                            </button>
                            <button
                              type="button"
                              className="button button--ghost button--small"
                              disabled={busy}
                              onClick={() => resetUserPassword(user)}
                            >
                              Сбросить пароль
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
            </>
          )
        ) : null}
      </section>
    </div>
  );
}
