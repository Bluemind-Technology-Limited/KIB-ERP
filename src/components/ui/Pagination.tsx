import { PAGE_SIZE } from '../../hooks/usePagination';

/**
 * Table footer: "showing x–y of n" plus previous/next controls.
 *
 * Neutral chrome, matching the header's back/forward buttons — pagination is
 * navigation, not a primary action.
 */
export function Pagination({
  page,
  totalPages,
  total,
  onChange,
  className = '',
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (total <= PAGE_SIZE) return null;

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const buttonClass =
    'inline-flex h-7 items-center justify-center rounded-md border border-line bg-surface px-2.5 text-[10px] font-semibold text-ink-3 transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 ${className}`}
    >
      <span className="text-[10px] font-semibold text-ink-faint">
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className={buttonClass}
          aria-label="Previous page"
        >
          Prev
        </button>
        <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className={buttonClass}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default Pagination;
