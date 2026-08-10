/**
 * Shared empty-state block — KIB-styled illustration + message used when a
 * list has no rows yet. Renders the empty.svg from /public.
 */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      <img src="/empty.svg" alt="Empty" className="w-32 h-24 mb-3" />
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-1 max-w-xs">{hint}</p>}
    </div>
  );
}
