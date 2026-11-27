import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchActiveCategories, fetchServices } from '../../api/admin';
import { errorMessage } from '../../api/client';
import { mergeCategories, STATUS_LABELS, STATUS_ORDER } from '../../api/labels';
import { fetchRequests } from '../../api/requests';
import type {
  Category,
  Paginated,
  RequestFilters,
  RequestListItem,
  RequestStatus,
  ServiceItem,
} from '../../api/types';
import { Pagination } from '../../components/Pagination';
import { ReportCard } from '../../components/ReportCard';
import { EmptyState, ErrorBox, Spinner } from '../../components/Spinner';

interface Props {
  title: string;
  subtitle?: string;
  showAuthor?: boolean;
  defaultStatus?: RequestStatus | '';
  headerAction?: JSX.Element;
  /** BL-T1: администратору нужен период создания. */
  withDates?: boolean;
  /** Текущий фильтр — для выгрузки CSV «по тому, что видно на экране». */
  onFiltersChange?: (filters: RequestFilters) => void;
}

const LIMIT = 20;

/** Общий список заявок с фильтрами и пагинацией (FR-3, NFR-1, BL-T1) для всех ролей. */
export function RequestsListPage({
  title,
  subtitle,
  showAuthor = false,
  defaultStatus = '',
  headerAction,
  withDates = false,
  onFiltersChange,
}: Props) {
  const [filters, setFilters] = useState<RequestFilters>({
    status: defaultStatus,
    category: '',
    search: '',
    page: 1,
    limit: LIMIT,
  });
  const [searchInput, setSearchInput] = useState('');
  const [categories, setCategories] = useState<Array<{ code: string; name: string }>>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [data, setData] = useState<Paginated<RequestListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchRequests(filters));
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  // Справочник категорий: отключённые в фильтр не попадают, встроенные остаются всегда.
  useEffect(() => {
    let cancelled = false;
    fetchActiveCategories()
      .then((active) => {
        if (!cancelled) setCategories(mergeCategories(active));
      })
      .catch(() => {
        if (!cancelled) setCategories(mergeCategories([]));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Служба-исполнитель — админский разрез (BL-T1 п.3), поэтому справочник берём только там.
  useEffect(() => {
    if (!withDates) {
      return;
    }
    let cancelled = false;
    fetchServices()
      .then((list) => {
        if (!cancelled) setServices(list);
      })
      .catch(() => {
        if (!cancelled) setServices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [withDates]);

  // Родитель получает фильтр через ref, иначе новая лямбда перезапускала бы эффект.
  const notifyRef = useRef(onFiltersChange);
  notifyRef.current = onFiltersChange;
  useEffect(() => {
    notifyRef.current?.(filters);
  }, [filters]);

  const update = (patch: Partial<RequestFilters>) => {
    setFilters((current) => ({ ...current, ...patch, page: 1 }));
  };

  const categoryOptions =
    categories.length > 0 ? categories : mergeCategories([]);

  return (
    <section className="page">
      <div className="page__head">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="page__subtitle">{subtitle}</p> : null}
        </div>
        {headerAction}
      </div>

      <div className="filters">
        <label className="field field--inline">
          <span>Статус</span>
          <select value={filters.status ?? ''} onChange={(event) => update({ status: event.target.value as RequestStatus | '' })}>
            <option value="">Все</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status].ru}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--inline">
          <span>Категория / служба</span>
          <select
            value={filters.category ?? ''}
            onChange={(event) => update({ category: event.target.value as Category | '' })}
          >
            <option value="">Все</option>
            {categoryOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

        {withDates ? (
          <>
            <label className="field field--inline">
              <span>Служба-исполнитель</span>
              <select value={filters.serviceId ?? ''} onChange={(event) => update({ serviceId: event.target.value })}>
                <option value="">Все</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field--inline">
              <span>С</span>
              <input
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(event) => update({ dateFrom: event.target.value })}
              />
            </label>
            <label className="field field--inline">
              <span>По</span>
              <input
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(event) => update({ dateTo: event.target.value })}
              />
            </label>
          </>
        ) : null}

        <form
          className="field field--inline field--search"
          onSubmit={(event) => {
            event.preventDefault();
            update({ search: searchInput });
          }}
        >
          <span>Поиск</span>
          <input
            type="search"
            value={searchInput}
            placeholder="адрес, номер, название"
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit" className="button button--secondary">
            Найти
          </button>
        </form>
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorBox message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && data ? (
        <>
          {data.items.length === 0 ? (
            <EmptyState title="Заявок пока нет" hint="Измените фильтры или создайте новую заявку." />
          ) : (
            <div className="list">
              {data.items.map((item) => (
                <ReportCard key={item.id} request={item} showAuthor={showAuthor} />
              ))}
            </div>
          )}

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        </>
      ) : null}
    </section>
  );
}
