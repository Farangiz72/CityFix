import { useCallback, useEffect, useState } from 'react';
import {
  createCategory,
  createService,
  fetchCategories,
  fetchServices,
  updateCategory,
  updateService,
} from '../../api/admin';
import { errorMessage } from '../../api/client';
import type { CategoryItem, ServiceItem } from '../../api/types';
import { AdminTabs } from '../../components/AdminTabs';
import { ErrorBox, Spinner } from '../../components/Spinner';

interface CategoryDraft {
  name: string;
  slaHours: string;
}

const EMPTY_CATEGORY = { code: '', name: '', slaHours: '72' };
const EMPTY_SERVICE = { code: '', name: '' };

/**
 * BL-T1 п.2: справочники служб и категорий. Удаления нет — только отключение,
 * иначе старые заявки и исполнители теряют историю (is_active = false).
 */
export function AdminDirectoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({ name: '', slaHours: '72' });
  const [newCategory, setNewCategory] = useState(EMPTY_CATEGORY);
  const [editService, setEditService] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [newService, setNewService] = useState(EMPTY_SERVICE);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryList, serviceList] = await Promise.all([fetchCategories(), fetchServices()]);
      setCategories(categoryList);
      setServices(serviceList);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  const saveCategory = (item: CategoryItem) => {
    const sla = Number(categoryDraft.slaHours);
    void act(
      () =>
        updateCategory(item.id, {
          name: categoryDraft.name.trim(),
          slaHours: Number.isFinite(sla) ? sla : item.slaHours,
        }),
      `Категория ${item.code} сохранена.`,
    ).then(() => setEditCategory(null));
  };

  return (
    <div className="admin">
      <section className="page">
        <div className="page__head">
          <div>
            <h1>Справочники</h1>
            <p className="page__subtitle">
              Службы и категории связаны кодом: категория заявки определяет службу-исполнителя. Записи только
              отключаются — история заявок остаётся целой.
            </p>
          </div>
        </div>

        <AdminTabs />

        {error ? <ErrorBox message={error} /> : null}
        {notice ? <p className="notice">{notice}</p> : null}
        {loading ? <Spinner /> : null}

        {!loading ? (
          <div className="admin__columns">
            <div className="card">
              <h2>Категории</h2>
              <p className="page__subtitle">
                Отключённая категория исчезает из формы жителя, но старые заявки с ней открываются.
              </p>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Код</th>
                      <th>Название</th>
                      <th>SLA</th>
                      <th>Состояние</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((item) => (
                      <tr key={item.id} className={item.isActive ? '' : 'table__row--off'}>
                        <td>
                          <code>{item.code}</code>
                        </td>
                        <td>
                          {editCategory === item.id ? (
                            <input
                              type="text"
                              value={categoryDraft.name}
                              onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })}
                            />
                          ) : (
                            item.name
                          )}
                        </td>
                        <td>
                          {editCategory === item.id ? (
                            <input
                              type="number"
                              min={1}
                              max={8760}
                              value={categoryDraft.slaHours}
                              onChange={(event) =>
                                setCategoryDraft({ ...categoryDraft, slaHours: event.target.value })
                              }
                            />
                          ) : (
                            `${item.slaHours} ч`
                          )}
                        </td>
                        <td>
                          <span className={`pill ${item.isActive ? 'pill--on' : 'pill--off'}`}>
                            {item.isActive ? 'активна' : 'отключена'}
                          </span>
                        </td>
                        <td>
                          <div className="table__actions">
                            {editCategory === item.id ? (
                              <>
                                <button
                                  type="button"
                                  className="button button--primary button--small"
                                  disabled={busy}
                                  onClick={() => saveCategory(item)}
                                >
                                  Сохранить
                                </button>
                                <button
                                  type="button"
                                  className="button button--ghost button--small"
                                  onClick={() => setEditCategory(null)}
                                >
                                  Отмена
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="button button--secondary button--small"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditCategory(item.id);
                                    setCategoryDraft({ name: item.name, slaHours: String(item.slaHours) });
                                  }}
                                >
                                  Изменить
                                </button>
                                <button
                                  type="button"
                                  className="button button--ghost button--small"
                                  disabled={busy}
                                  onClick={() =>
                                    void act(
                                      () => updateCategory(item.id, { isActive: !item.isActive }),
                                      item.isActive
                                        ? `Категория ${item.code} отключена.`
                                        : `Категория ${item.code} включена.`,
                                    )
                                  }
                                >
                                  {item.isActive ? 'Отключить' : 'Включить'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form
                className="form form--inline"
                onSubmit={(event) => {
                  event.preventDefault();
                  const payload = {
                    code: newCategory.code.trim().toUpperCase(),
                    name: newCategory.name.trim(),
                    slaHours: Number(newCategory.slaHours) || 72,
                  };
                  void act(async () => {
                    await createCategory(payload);
                    setNewCategory(EMPTY_CATEGORY);
                  }, `Категория ${payload.code} создана.`);
                }}
              >
                <label className="field">
                  <span>Код</span>
                  <input
                    type="text"
                    required
                    placeholder="PARKS"
                    value={newCategory.code}
                    onChange={(event) => setNewCategory({ ...newCategory, code: event.target.value.toUpperCase() })}
                  />
                </label>
                <label className="field">
                  <span>Название</span>
                  <input
                    type="text"
                    required
                    placeholder="Парки и скверы"
                    value={newCategory.name}
                    onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>SLA, часов</span>
                  <input
                    type="number"
                    min={1}
                    max={8760}
                    value={newCategory.slaHours}
                    onChange={(event) => setNewCategory({ ...newCategory, slaHours: event.target.value })}
                  />
                </label>
                <button type="submit" className="button button--primary" disabled={busy}>
                  Добавить
                </button>
              </form>
            </div>

            <div className="card">
              <h2>Службы</h2>
              <p className="page__subtitle">
                Исполнитель привязывается к службе; при отключении службы связь сохраняется, но новых
                исполнителей в неё не добавить.
              </p>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Код</th>
                      <th>Название</th>
                      <th>Исполнителей</th>
                      <th>Состояние</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((item) => (
                      <tr key={item.id} className={item.isActive ? '' : 'table__row--off'}>
                        <td>
                          <code>{item.code}</code>
                        </td>
                        <td>
                          {editService === item.id ? (
                            <input
                              type="text"
                              value={serviceName}
                              onChange={(event) => setServiceName(event.target.value)}
                            />
                          ) : (
                            item.name
                          )}
                        </td>
                        <td>{item._count.users}</td>
                        <td>
                          <span className={`pill ${item.isActive ? 'pill--on' : 'pill--off'}`}>
                            {item.isActive ? 'активна' : 'отключена'}
                          </span>
                        </td>
                        <td>
                          <div className="table__actions">
                            {editService === item.id ? (
                              <>
                                <button
                                  type="button"
                                  className="button button--primary button--small"
                                  disabled={busy}
                                  onClick={() =>
                                    void act(
                                      () => updateService(item.id, { name: serviceName.trim() }),
                                      `Служба ${item.code} сохранена.`,
                                    ).then(() => setEditService(null))
                                  }
                                >
                                  Сохранить
                                </button>
                                <button
                                  type="button"
                                  className="button button--ghost button--small"
                                  onClick={() => setEditService(null)}
                                >
                                  Отмена
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="button button--secondary button--small"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditService(item.id);
                                    setServiceName(item.name);
                                  }}
                                >
                                  Изменить
                                </button>
                                <button
                                  type="button"
                                  className="button button--ghost button--small"
                                  disabled={busy}
                                  onClick={() =>
                                    void act(
                                      () => updateService(item.id, { isActive: !item.isActive }),
                                      item.isActive
                                        ? `Служба ${item.code} отключена.`
                                        : `Служба ${item.code} включена.`,
                                    )
                                  }
                                >
                                  {item.isActive ? 'Отключить' : 'Включить'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form
                className="form form--inline"
                onSubmit={(event) => {
                  event.preventDefault();
                  const payload = {
                    code: newService.code.trim().toUpperCase(),
                    name: newService.name.trim(),
                  };
                  void act(async () => {
                    await createService(payload);
                    setNewService(EMPTY_SERVICE);
                  }, `Служба ${payload.code} создана.`);
                }}
              >
                <label className="field">
                  <span>Код</span>
                  <input
                    type="text"
                    required
                    placeholder="PARKS"
                    value={newService.code}
                    onChange={(event) => setNewService({ ...newService, code: event.target.value.toUpperCase() })}
                  />
                </label>
                <label className="field">
                  <span>Название</span>
                  <input
                    type="text"
                    required
                    placeholder="Служба «Парки»"
                    value={newService.name}
                    onChange={(event) => setNewService({ ...newService, name: event.target.value })}
                  />
                </label>
                <button type="submit" className="button button--primary" disabled={busy}>
                  Добавить
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
