export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return <p className="pagination__total">Всего: {total}</p>;
  }

  return (
    <nav className="pagination" aria-label="Страницы списка">
      <button
        type="button"
        className="button button--secondary"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        ← Назад
      </button>
      <span className="pagination__label">
        {page} из {totalPages} · всего {total}
      </span>
      <button
        type="button"
        className="button button--secondary"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        Вперёд →
      </button>
    </nav>
  );
}
