import { useEffect, useId, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Модальное окно подтверждения (BL-T5): общий стиль `.modal` из index.css.
 * Закрывается по Esc, клику по подложке и кнопке «Отмена».
 */
export function Modal({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Отмена',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal">
      <div className="modal__backdrop" onClick={onCancel} />
      <div className="modal__card" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        {children ? <div className="modal__text">{children}</div> : null}
        <div className="modal__actions">
          <button type="button" className="button button--secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'button button--danger' : 'button button--primary'}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
