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

/** `formatQty(1250, 'kg')` → `"1,250 kg"`. */
export function formatQty(
  value: number | string | null | undefined,
  unit?: string | null,
  maxDecimals = 4
): string {
  const formatted = formatNumber(value, maxDecimals);
  return unit ? `${formatted} ${unit}` : formatted;
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
