import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Every table shows six rows per page. */
export const PAGE_SIZE = 6;

/**
 * Page state for a table, held in the URL (`?page=N`).
 *
 * Because the page lives in the query string, a reload — or a link someone
 * copies — lands back on the same page instead of resetting to the first one.
 */
export function usePagination<T>(items: T[], param = 'page') {
  const [params, setParams] = useSearchParams();

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const parsed = Number(params.get(param) ?? 1);
  const requested = Number.isFinite(parsed) ? Math.floor(parsed) : 1;
  const page = Math.min(Math.max(1, requested), totalPages);

  const pageItems = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page]
  );

  const setPage = (next: number) => {
    const target = Math.min(Math.max(1, next), totalPages);
    const nextParams = new URLSearchParams(params);
    if (target === 1) nextParams.delete(param);
    else nextParams.set(param, String(target));
    setParams(nextParams, { replace: true });
  };

  return { page, totalPages, total, pageItems, setPage };
}
