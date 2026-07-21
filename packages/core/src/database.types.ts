/**
 * Tipos de la base de datos — versión interina escrita a mano.
 *
 * La versión autoritativa se regenera desde el esquema real con:
 *   pnpm db:types   (supabase gen types typescript --local)
 *
 * Se mantiene sincronizada con supabase/migrations/*.sql
 */

export type UserRole = 'admin' | 'vendedor' | 'cliente';
export type Gender = 'hombre' | 'mujer' | 'unisex';
export type Concentration = 'Parfum' | 'EDP' | 'EDT' | 'EDC' | 'Otro';
export type MovementType =
  'entrada' | 'salida' | 'ajuste' | 'traspaso_entrada' | 'traspaso_salida' | 'venta';
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';
export type SaleStatus = 'completada' | 'anulada';
export type OrderStatus = 'pendiente' | 'confirmado' | 'listo' | 'entregado' | 'cancelado';

export interface StoreRow {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  role: UserRole;
  store_id: string | null;
  phone: string | null;
  created_at: string;
}

export interface BrandRow {
  id: string;
  name: string;
  created_at: string;
}

/** Tipo de artículo dentro de una familia (Árabe en Perfumes, Frascos en Envases…). */
export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  family_id: string | null;
  created_at: string;
}

/** Unidad en que se cuenta un artículo. */
export type ProductUnit = 'unidad' | 'ml' | 'g' | 'l';

/** Familia de artículos: Perfumes, Envases, Esencias, Materia prima… */
export interface ProductFamilyRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Cómo se clasifica la familia: bien tangible o consumible interno. */
  kind: 'articulo' | 'insumo';
  /** true = sus artículos no se venden en el POS. Independiente de `kind`. */
  is_supply: boolean;
  /** Familias base que no se pueden eliminar desde la app. */
  is_system: boolean;
  created_at: string;
}

export interface ProductRow {
  id: string;
  name: string;
  brand_id: string | null;
  category_id: string | null;
  family_id: string | null;
  unit: ProductUnit;
  is_sellable: boolean;
  description: string | null;
  gender: Gender | null;
  concentration: Concentration | null;
  volume_ml: number | null;
  barcode: string | null;
  sku: string | null;
  price: number;
  cost: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryRow {
  id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  min_quantity: number;
  updated_at: string;
}

export interface InventoryMovementRow {
  id: string;
  store_id: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  reason: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CustomerRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  profile_id: string | null;
  created_at: string;
}

export interface SupplierRow {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface SaleRow {
  id: string;
  store_id: string;
  customer_id: string | null;
  sold_by: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  created_at: string;
}

export interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface OrderRow {
  id: string;
  store_id: string;
  customer_id: string | null;
  created_by: string | null;
  status: OrderStatus;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

/** Producto con su marca, categoría y stock de una sucursal (para el POS/inventario). */
export interface ProductWithStock extends ProductRow {
  brand: Pick<BrandRow, 'id' | 'name'> | null;
  category: Pick<CategoryRow, 'id' | 'name' | 'slug'> | null;
  inventory: Pick<InventoryRow, 'quantity' | 'min_quantity'>[] | null;
}
