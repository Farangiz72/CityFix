import { RequestsListPage } from '../shared/RequestsListPage';

/** Очередь оператора: по умолчанию новые заявки, которые надо проверить (FR-3). */
export function OperatorQueuePage() {
  return (
    <RequestsListPage
      title="Очередь заявок"
      subtitle="Новые заявки проверяются и передаются в службу"
      showAuthor
      defaultStatus="NEW"
    />
  );
}
