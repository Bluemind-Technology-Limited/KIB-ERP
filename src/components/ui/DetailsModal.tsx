import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Shared "View details" modal.
 *
 * Tables keep a compact set of columns and push everything else (notes, ids,
 * dates, related records) into this modal. One component so every module shows
 * details the same way.
 */

export interface DetailField {
  label: string;
  value: React.ReactNode;
  /** Render across the full width — use for long text such as notes. */
  wide?: boolean;
}

export interface DetailSection {
  title?: string;
  fields: DetailField[];
}

export function DetailsModal({
  title,
  subtitle,
  status,
  sections,
  onClose,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  status?: { label: string; className?: string };
  sections: DetailSection[];
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <Modal onClose={onClose}>
      <div className="bg-surface rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-ink leading-none truncate">{title}</h3>
            {subtitle && <div className="text-[10px] text-ink-faint mt-1.5">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status && (
              <span
                className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  status.className ?? 'bg-slate-600 text-white'
                }`}
              >
                {status.label}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-ink-faint hover:text-ink-muted"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {sections.map((section, i) => (
          <div
            key={i}
            className="space-y-2 rounded-lg border border-line bg-surface-2/70 px-3 py-2.5"
          >
            {section.title && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{section.title}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {section.fields.map((field, j) => (
                <div key={j} className={field.wide ? 'sm:col-span-2' : undefined}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">{field.label}</p>
                  <div className="text-[11px] text-ink break-words">{field.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {footer && <div className="flex justify-end gap-2 pt-2 border-t border-line">{footer}</div>}
      </div>
    </Modal>
  );
}

/** Row action that opens a DetailsModal. Stops the click bubbling to row handlers. */
export function ViewButton({
  onClick,
  label = 'View',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 h-7 px-2 text-[10px]"
      title="View details"
    >
      {label}
    </Button>
  );
}

/** Renders a value safely inside a details field. */
export function detailValue(value: unknown, fallback = '—'): React.ReactNode {
  if (value === null || value === undefined || value === '') return fallback;
  return value as React.ReactNode;
}

/** Formats a date for a details field. */
export function detailDate(value: unknown, withTime = false): string {
  if (!value) return '—';
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return '—';
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}
