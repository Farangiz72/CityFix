import { formatDateTime, REJECT_REASON_LABELS, ROLE_LABELS, STATUS_LABELS } from '../api/labels';
import type { HistoryEntry, RejectReason } from '../api/types';

/** FR-5 / TC-8: житель видит весь путь заявки — кто, когда и что изменил. */
export function HistoryTimeline({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="report__meta report__meta--muted">История пока пуста</p>;
  }

  return (
    <ol className="timeline">
      {history.map((entry) => (
        <li key={entry.id} className="timeline__item">
          <span className="timeline__dot" aria-hidden="true" />
          <div className="timeline__body">
            <p className="timeline__title">
              {STATUS_LABELS[entry.toStatus].ru}
              {entry.fromStatus ? (
                <span className="timeline__from"> (было: {STATUS_LABELS[entry.fromStatus].ru})</span>
              ) : null}
            </p>
            <p className="timeline__meta">
              {formatDateTime(entry.createdAt)} · {entry.changedBy.fullName}
              {entry.changedBy.role ? ` (${ROLE_LABELS[entry.changedBy.role].ru})` : ''}
            </p>
            {entry.comment ? <p className="timeline__comment">{entry.comment}</p> : null}
            {entry.reasonCode && entry.reasonCode in REJECT_REASON_LABELS ? (
              <p className="timeline__meta">
                Причина: {REJECT_REASON_LABELS[entry.reasonCode as RejectReason].ru}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
