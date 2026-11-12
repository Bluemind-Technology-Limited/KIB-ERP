import { formatQty, parseUom } from '../../lib/format';

interface PackQuantityPreviewProps {
  quantity: string | number | null | undefined;
  unit?: string | null;
  /** Prefix shown before the calculation. */
  label?: string;
  className?: string;
}

/**
 * Live "Total: 500 × 25 KG = 12,500 KG" line for entry forms.
 * Renders nothing until there is a positive quantity and a pack-style unit.
 */
export function PackQuantityPreview({
  quantity,
  unit,
  label = 'Total',
  className = 'text-slate-400',
}: PackQuantityPreviewProps) {
  const qty = Number(quantity);
  if (!unit || !Number.isFinite(qty) || qty <= 0 || !parseUom(unit)) return null;

  return (
    <p className={`text-[9px] font-semibold ${className}`}>
      {label}: {formatQty(qty, unit)}
    </p>
  );
}
