import { Link } from 'react-router-dom';
import { categoryLabel, formatDateTime, isPriorityVisible, PRIORITY_LABELS } from '../api/labels';
import type { RequestListItem } from '../api/types';
import { StatusBadge } from './StatusBadge';

interface Props {
  request: RequestListItem;
  showAuthor?: boolean;
  actions?: JSX.Element;
}

/** Карточка заявки в списке — общая для всех ролей (docs/05-layouts.md). */
export function ReportCard({ request, showAuthor = false, actions }: Props) {
  return (
    <article className="card report">
      <div className="report__head">
        <Link className="report__title" to={`/requests/${request.id}`}>
          №{request.number} · {request.title}
        </Link>
        <div className="report__badges">
          {isPriorityVisible(request.priority) ? (
            <span className={`chip chip--${request.priority.toLowerCase()}`}>
              {PRIORITY_LABELS[request.priority].ru}
            </span>
          ) : null}
          <StatusBadge status={request.status} />
        </div>
      </div>

      <p className="report__meta">
        {categoryLabel(request.category)} · {request.address}
      </p>

      <p className="report__meta report__meta--muted">
        {formatDateTime(request.createdAt)}
        {showAuthor ? ` · житель: ${request.author.fullName}` : ''}
        {request.assignee ? ` · исполнитель: ${request.assignee.fullName}` : ''}
      </p>

      {request.photoUrl ? (
        <img className="report__photo" src={request.photoUrl} alt={`Фото к заявке №${request.number}`} loading="lazy" />
      ) : null}

      {actions ? <div className="report__actions">{actions}</div> : null}
    </article>
  );
}
