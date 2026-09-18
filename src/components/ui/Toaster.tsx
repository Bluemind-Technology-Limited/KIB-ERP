import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, type Toast, type ToastVariant } from '../../stores/useToastStore';

const VARIANT_STYLES: Record<ToastVariant, { wrap: string; icon: string; Icon: typeof Info }> = {
  success: {
    wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: 'text-emerald-600',
    Icon: CheckCircle2,
  },
  error: {
    wrap: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: 'text-rose-600',
    Icon: AlertCircle,
  },
  info: {
    wrap: 'border-slate-200 bg-white text-slate-700',
    icon: 'text-slate-500',
    Icon: Info,
  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const { wrap, icon, Icon } = VARIANT_STYLES[toast.variant];

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg shadow-black/10 ${wrap}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${icon}`} />
      <p className="flex-1 text-xs font-semibold leading-relaxed">{toast.message}</p>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Global toast stack.
 *
 * Rendered through a portal to `document.body` with `z-9999` so it always
 * paints above the modal overlay (`Modal` uses `z-50`). Toasts raised from
 * inside a modal — successes included — are therefore fully visible.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-9999 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body
  );
}
