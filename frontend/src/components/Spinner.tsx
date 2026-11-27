/*
 * Состояния экрана в едином «берёзовом» стиле (BL-T5):
 * маленькая иллюстрация + подпись. Цвет — только из токенов.
 */

function LoadingArt() {
  return (
    <svg viewBox="0 0 48 48" width="34" height="34" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M13 30C13 19 22 12 37 12c0 15-7 24-18 24-4 0-6-2-6-6z"
        fill="var(--color-primary)"
      />
      <path
        d="M15 34c6-8 12-12 20-15"
        stroke="var(--color-primary-deep)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M30 39c4-1 7-4 9-8"
        stroke="var(--color-secondary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EmptyArt() {
  return (
    <svg viewBox="0 0 48 48" width="34" height="34" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M9 17h11l4 4h15v16a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V17z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M23 35c0-6 4-9 10-9 0 6-4 9-10 9z" fill="var(--color-primary)" />
      <path
        d="M23 35c2-4 4-6 8-8"
        stroke="var(--color-primary-deep)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="36" cy="12" r="3" fill="var(--color-secondary)" />
    </svg>
  );
}

function ErrorArt() {
  return (
    <svg viewBox="0 0 48 48" width="26" height="26" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M24 9l16 28H8L24 9z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
        fill="var(--color-surface)"
      />
      <path d="M24 20v9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="34" r="2" fill="currentColor" />
    </svg>
  );
}

export function Spinner({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="state__art state__art--loading" aria-hidden="true">
        <LoadingArt />
      </span>
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: JSX.Element }) {
  return (
    <div className="state state--empty">
      <span className="state__art" aria-hidden="true">
        <EmptyArt />
      </span>
      <h3>{title}</h3>
      {hint ? <p>{hint}</p> : null}
      {action}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__art state__art--error" aria-hidden="true">
        <ErrorArt />
      </span>
      <div className="state__body">
        <p>{message}</p>
        {onRetry ? (
          <button type="button" className="button button--secondary" onClick={onRetry}>
            Повторить
          </button>
        ) : null}
      </div>
    </div>
  );
}
