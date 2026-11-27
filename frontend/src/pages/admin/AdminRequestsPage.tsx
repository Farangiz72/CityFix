import { useCallback, useState } from 'react';
import { downloadRequestsCsv } from '../../api/admin';
import { errorMessage } from '../../api/client';
import type { RequestFilters } from '../../api/types';
import { AdminTabs } from '../../components/AdminTabs';
import { ErrorBox } from '../../components/Spinner';
import { RequestsListPage } from '../shared/RequestsListPage';

/**
 * BL-T1 п.3 и п.6: все заявки с фильтрами по статусу, службе, категории и дате,
 * плюс выгрузка CSV по этим же фильтрам.
 */
export function AdminRequestsPage() {
  const [filters, setFilters] = useState<RequestFilters>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportCsv = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const params: Record<string, string | number> = {};
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.serviceId) params.serviceId = filters.serviceId;
      if (filters.search) params.search = filters.search;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      const count = await downloadRequestsCsv(params);
      setNotice(`Файл CSV сформирован: заявок ${count}.`);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };

  const handleFilters = useCallback((next: RequestFilters) => setFilters(next), []);

  return (
    <div className="admin">
      <AdminTabs />

      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      <RequestsListPage
        title="Все заявки"
        subtitle="Фильтры по статусу, категории, службе-исполнителю и периоду создания; CSV выгружается по тем же условиям"
        showAuthor
        withDates
        onFiltersChange={handleFilters}
        headerAction={
          <button type="button" className="button button--secondary" disabled={busy} onClick={() => void exportCsv()}>
            {busy ? 'Готовим файл…' : 'Экспорт в CSV'}
          </button>
        }
      />
    </div>
  );
}
