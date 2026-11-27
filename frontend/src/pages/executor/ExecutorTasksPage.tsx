import { RequestsListPage } from '../shared/RequestsListPage';

/** Задачи исполнителя: только заявки, назначенные его службе (FR-4). */
export function ExecutorTasksPage() {
  return (
    <RequestsListPage
      title="Мои задачи"
      subtitle="Заявки, назначенные вашей службе: взять в работу и закрыть"
    />
  );
}
