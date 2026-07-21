import type { InventoryRow, SaleRow } from './database.types';

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

/** Verdadero si la fecha ISO corresponde al día de hoy (hora local). */
export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export interface SalesSummary {
  /** Suma de los totales de las ventas completadas. */
  revenue: number;
  /** Número de ventas completadas. */
  count: number;
  /** Ticket promedio (0 si no hubo ventas). */
  average: number;
}

/** Resume las ventas completadas de hoy. Se usa en Inicio y en Reportes. */
export function summarizeTodaySales(sales: SaleRow[]): SalesSummary {
  const today = sales.filter((s) => s.status === 'completada' && isToday(s.created_at));
  const revenue = today.reduce((sum, s) => sum + s.total, 0);
  const count = today.length;
  return { revenue, count, average: count > 0 ? revenue / count : 0 };
}
