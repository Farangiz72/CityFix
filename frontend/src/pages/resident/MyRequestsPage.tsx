import { Link } from 'react-router-dom';
import { RequestsListPage } from '../shared/RequestsListPage';

/** «Мои заявки» жителя: только свои заявки, статус и полная история (FR-5). */
export function MyRequestsPage() {
  return (
    <RequestsListPage
      title="Мои заявки"
      subtitle="Здесь виден текущий статус и вся история каждой заявки"
      headerAction={
        <Link className="button button--primary" to="/my/new">
          + Новая заявка
        </Link>
      }
    />
  );
}
