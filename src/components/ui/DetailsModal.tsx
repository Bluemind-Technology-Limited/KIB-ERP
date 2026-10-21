import { Eye, X } from 'lucide-react';
import { Modal } from './Modal';

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
      <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#171717] leading-none truncate">{title}</h3>
            {subtitle && <div className="text-[10px] text-slate-400 mt-1.5">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status && (
              <span
                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  status.className ?? 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {status.label}
              </span>
            )}
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {sections.map((section, i) => (
          <div key={i} className="space-y-2">
            {section.title && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{section.title}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {section.fields.map((field, j) => (
                <div key={j} className={field.wide ? 'sm:col-span-2' : undefined}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{field.label}</p>
                  <div className="text-[11px] text-[#171717] break-words">{field.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {footer && <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">{footer}</div>}
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
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 h-7 px-2 rounded-lg border border-slate-200 text-slate-600 text-[10px] font-semibold hover:bg-slate-50 transition-colors"
      title="View details"
    >
      <Eye className="w-3 h-3" /> {label}
    </button>
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
