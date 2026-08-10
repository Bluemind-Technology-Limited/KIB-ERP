/**
 * Shared skeleton primitives — light, KIB-styled loading placeholders with a
 * soft shimmer. Use anywhere a page is fetching data from the backend.
 */
const shimmer = `
  @keyframes kib-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .kib-skeleton {
    background: linear-gradient(90deg, #F1F1F1 25%, #E8E8E8 37%, #F1F1F1 63%);
    background-size: 800px 100%;
    animation: kib-shimmer 1.4s ease-in-out infinite;
  }
`;

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <>
      <style>{shimmer}</style>
      <div className={`kib-skeleton rounded-md ${className}`} />
    </>
  );
}

/** Skeleton row inside a table body. */
export function TableRowSkeleton({ cols, hasAvatar = true }: { cols: number; hasAvatar?: boolean }) {
  return (
    <tr className="border-b border-slate-50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          {i === 0 && hasAvatar ? (
            <div className="flex items-center gap-2.5">
              <Skeleton className="w-7 h-7 rounded-md shrink-0" />
              <div className="space-y-1.5 flex-1 max-w-[180px]">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          ) : (
            <Skeleton className={`h-2.5 ${i === 0 ? 'w-24' : 'w-16'} max-w-full`} />
          )}
        </td>
      ))}
    </tr>
  );
}

/** Full table skeleton: header + N body rows. */
export function TableSkeleton({ cols, rows = 6, hasAvatar = true }: { cols: number; rows?: number; hasAvatar?: boolean }) {
  return (
    <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton className="h-2 w-14" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} cols={cols} hasAvatar={hasAvatar} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Header + subtitle skeleton for the page Action Header. */
export function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-5 w-44" />
      <Skeleton className="h-2.5 w-72" />
    </div>
  );
}
