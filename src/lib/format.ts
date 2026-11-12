/**
 * Shared number formatting.
 *
 * Every quantity, count and amount in the UI goes through these helpers so
 * thousands are grouped (1,250) and decimals stay consistent.
 */

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Group thousands and trim pointless decimals. `1,250.5`, `12,400`. */
export function formatNumber(
  value: number | string | null | undefined,
  maxDecimals = 4
): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!isNumber(n as number)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxDecimals }).format(n as number);
}

/**
 * Format a quantity in the material's pack, e.g. `"100 × 25 KG = 2,500 KG"`.
 * Plain units ("kg") fall back to the historic `"1,250 kg"` form.
 */
export function formatQty(
  value: number | string | null | undefined,
  unit?: string | null,
  maxDecimals = 4
): string {
  const qty = formatNumber(value, maxDecimals);
  const parsed = parseUom(unit);
  if (!parsed) return unit ? `${qty} ${unit}` : qty;
  const perPack = packWeightKg(parsed.packSize, parsed.packUnit);
  if (perPack === null) return `${qty} × ${unit}`;
  return `${qty} × ${unit} = ${formatNumber(Number(value) * perPack)} KG`;
}

/** Parse a rendered pack label such as `"25 KG"`, `"500 G"` or `"12 PCS"`. */
export function parseUom(
  label?: string | null
): { packSize: number; packUnit: 'KG' | 'G' | 'PCS' } | null {
  const match = String(label ?? '').trim().match(/^([\d.]+)\s*(KG|G|PCS)$/i);
  if (!match) return null;
  const packSize = Number(match[1]);
  if (!Number.isFinite(packSize) || packSize <= 0) return null;
  return { packSize, packUnit: match[2].toUpperCase() as 'KG' | 'G' | 'PCS' };
}

/** Weight of one pack in kilograms, or null for count units. */
export function packWeightKg(
  packSize: number | string,
  packUnit: string
): number | null {
  const unit = String(packUnit).toUpperCase();
  const size = Number(packSize);
  if (!Number.isFinite(size) || size <= 0) return null;
  if (unit === 'KG') return size;
  if (unit === 'G') return size / 1000;
  return null;
}

/**
 * Show a pack count in its natural form: `"100 × 25 KG = 2,500 KG"`.
 * Kept as a named alias so call sites read clearly.
 */
export const formatPackQuantity = formatQty;

/** Just the weight side, e.g. `"2,500 KG"`, or an empty string for count units. */
export function quantityWeightLabel(
  value: number | string | null | undefined,
  unit?: string | null
): string {
  const parsed = parseUom(unit);
  if (!parsed) return '';
  const perPack = packWeightKg(parsed.packSize, parsed.packUnit);
  if (perPack === null) return '';
  return `${formatNumber(Number(value) * perPack)} KG`;
}

/** `formatMoney(1250000)` → `"NGN 1,250,000.00"`. */
export function formatMoney(
  value: number | string | null | undefined,
  currency = 'NGN',
  maximumFractionDigits = 2
): string {
  const n = typeof value === 'string' ? Number(value) : value;
  const safe = isNumber(n as number) ? (n as number) : 0;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(safe);
}

/** Percentage with a fixed decimal place, e.g. `"92.4%"`. */
export function formatPercent(value: number | string | null | undefined, decimals = 1): string {
  const n = typeof value === 'string' ? Number(value) : value;
  const safe = isNumber(n as number) ? (n as number) : 0;
  return `${safe.toFixed(decimals)}%`;
}
