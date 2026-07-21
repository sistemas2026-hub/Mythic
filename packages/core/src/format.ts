import type { InventoryRow } from './database.types';

/**
 * Formatea un monto como moneda. Por defecto COP sin decimales;
 * ajusta `currency`/`locale` según el país de la tienda.
 */
export function formatMoney(
  amount: number,
  { currency = 'COP', locale = 'es-CO' }: { currency?: string; locale?: string } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'COP' || currency === 'CLP' ? 0 : 2,
  }).format(amount);
}

export type StockStatus = 'ok' | 'low' | 'out';

/** Determina el estado de stock según la cantidad y el mínimo configurado. */
export function stockStatus(
  inventory: Pick<InventoryRow, 'quantity' | 'min_quantity'> | null | undefined,
): StockStatus {
  const qty = inventory?.quantity ?? 0;
  const min = inventory?.min_quantity ?? 0;
  if (qty <= 0) return 'out';
  if (qty <= min) return 'low';
  return 'ok';
}

export const stockStatusLabel: Record<StockStatus, string> = {
  ok: 'En stock',
  low: 'Stock bajo',
  out: 'Agotado',
};
