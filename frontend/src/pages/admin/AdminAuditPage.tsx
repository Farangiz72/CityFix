import { useCallback, useEffect, useState } from 'react';
import { fetchAudit } from '../../api/admin';
import { errorMessage } from '../../api/client';
import { AUDIT_ACTION_LABELS, AUDIT_OBJECT_LABELS, formatDateTime } from '../../api/labels';
import type { AuditEntry, Paginated } from '../../api/types';
import { AdminTabs } from '../../components/AdminTabs';
import { Pagination } from '../../components/Pagination';
import { EmptyState, ErrorBox, Spinner } from '../../components/Spinner';

const OBJECT_TYPES = ['USER', 'SERVICE', 'CATEGORY', 'REQUEST'] as const;
type ObjectType = (typeof OBJECT_TYPES)[number] | '';

/**
 * BL-T1 п.5 / TC-34: журнал действий только читается — записей здесь не удаляют и не правят.
 * Кто, когда и что изменил: роли, блокировки, справочники, категории заявок и выгрузки.
 */
export function AdminAuditPage() {
  const [data, setData] = useState<Paginated<AuditEntry> | null>(null);
  const [objectType, setObjectType] = useState<ObjectType>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAudit({ objectType, page }));
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setLoading(false);
    }
  }, [objectType, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="admin">
      <section className="page">
        <div className="page__head">
          <div>
            <h1>Журнал действий</h1>
            <p className="page__subtitle">
              Кто, когда и что изменил: роли, блокировки, справочники и категории заявок. Записи неизменяемы —
              удалить или отредактировать их нельзя даже администратору.
            </p>
          </div>
        </div>

        <AdminTabs />

        <div className="filters">
          <label className="field field--inline">
            <span>Объект</span>
            <select
              value={objectType}
              onChange={(event) => {
                setObjectType(event.target.value as ObjectType);
                setPage(1);
              }}
            >
              <option value="">Все</option>
              {OBJECT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {AUDIT_OBJECT_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="button button--secondary" disabled={loading} onClick={() => void load()}>
            Обновить
          </button>
        </div>

        {error ? <ErrorBox message={error} onRetry={() => void load()} /> : null}
        {loading ? <Spinner /> : null}

        {!loading && data ? (
          data.items.length === 0 ? (
            <EmptyState title="Записей нет" hint="Журнал пополняется, когда администратор что-то меняет." />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Когда</th>
                      <th>Кто</th>
                      <th>Действие</th>
                      <th>Что изменено</th>
                      <th>Объект</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((entry) => (
                      <tr key={entry.id}>
                        <td className="table__muted">{formatDateTime(entry.createdAt)}</td>
                        <td>
                          <span className="table__strong">{entry.actor.fullName}</span>
                          <span className="table__muted">{entry.actor.role ?? ''}</span>
                        </td>
                        <td>
                          <span className={`pill pill--action pill--${entry.action.toLowerCase()}`}>
                            {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                          </span>
                        </td>
                        <td>{entry.summary}</td>
                        <td className="table__muted">
                          {AUDIT_OBJECT_LABELS[entry.objectType] ?? entry.objectType}
                          <code className="table__id">{entry.objectId.slice(0, 8)}</code>
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
