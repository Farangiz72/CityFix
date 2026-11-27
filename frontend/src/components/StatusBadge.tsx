import { STATUS_LABELS } from '../api/labels';
import type { RequestStatus } from '../api/types';

/** Подпись статуса: русский текст + английский, цвет задаётся классом. */
export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`badge badge--${status.toLowerCase()}`}>
      {STATUS_LABELS[status].ru}
      <span className="badge__en">{STATUS_LABELS[status].en}</span>
    </span>
  );
}
