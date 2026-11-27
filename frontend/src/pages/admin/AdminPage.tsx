import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { STATUS_LABELS, STATUS_ORDER } from '../../api/labels';
import { fetchStats } from '../../api/requests';
import type { CountByName, Stats } from '../../api/types';
import { AdminTabs } from '../../components/AdminTabs';
import { ErrorBox, Spinner } from '../../components/Spinner';

function formatHours(hours: number | null): string {
  if (hours === null) {
    return '—';
  }
  if (hours < 48) {
    return `${hours.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ч`;
  }
  return `${(hours / 24).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} сут`;
}

/** Разрез «служба/категория» с простой полосой: видно, где сосредоточены заявки. */
function Breakdown({ title, rows, total }: { title: string; rows: CountByName[]; total: number }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <ul className="breakdown">
        {rows.map((row) => {
          const percent = total > 0 ? Math.round((row.count / total) * 100) : 0;
          return (
            <li key={row.code} className="breakdown__row">
              <span className="breakdown__label">
                {row.name}
                {row.isActive ? null : <span className="pill pill--off">отключена</span>}
              </span>
              <span className="breakdown__bar" aria-hidden="true">
                <span className="breakdown__fill" style={{ width: `${percent}%` }} />
              </span>
              <span className="breakdown__value">{row.count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** BL-T1 п.4: статистика по статусам, службам, категориям, срокам и отказам. */
export function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetchStats()
      .then(setStats)
      .catch((problem) => setError(errorMessage(problem)));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="admin">
      <section className="page page--compact">
        <h1>Сводка</h1>
        <p className="page__subtitle">
          Всего заявок: {stats?.total ?? '—'} · статусы меняют оператор и исполнитель, администратор управляет
          справочниками и пользователями
        </p>

        <AdminTabs />

        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {!stats && !error ? <Spinner /> : null}

        {stats ? (
          <>
            <div className="tiles">
              {STATUS_ORDER.map((status) => (
                <div key={status} className={`tile tile--${status.toLowerCase()}`}>
                  <span className="tile__value">{stats.byStatus[status]}</span>
                  <span className="tile__label">{STATUS_LABELS[status].ru}</span>
                  <span className="tile__en">{STATUS_LABELS[status].en}</span>
                </div>
              ))}
            </div>

            <div className="tiles">
              <div className="tile tile--in_progress">
                <span className="tile__value">{formatHours(stats.avgResolutionHours)}</span>
                <span className="tile__label">Среднее время «Новая → Выполнена»</span>
                <span className="tile__en">Average resolution time</span>
              </div>
              <div className="tile tile--rejected">
                <span className="tile__value">{stats.rejected}</span>
                <span className="tile__label">Отклонено</span>
                <span className="tile__en">Rejected</span>
              </div>
              <div className="tile tile--new">
                <span className="tile__value">{stats.unassigned}</span>
                <span className="tile__label">Без исполнителя</span>
                <span className="tile__en">No assignee yet</span>
              </div>
            </div>

            <div className="admin__columns">
              <Breakdown title="По категориям" rows={stats.byCategory} total={stats.total} />
              <Breakdown title="По службам" rows={stats.byService} total={stats.total} />
            </div>

            <p className="admin__hint">
              Служба заявки определяется её категорией, поэтому разрезы «по службам» и «по категориям»
              совпадают по смыслу, но показывают разные справочники.{' '}
              <Link to="/admin/requests">Открыть все заявки с фильтрами →</Link>
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}
