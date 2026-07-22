import { z } from 'zod';

export const genderSchema = z.enum(['hombre', 'mujer', 'unisex']);
export const concentrationSchema = z.enum(['Parfum', 'EDP', 'EDT', 'EDC', 'Otro']);
export const paymentMethodSchema = z.enum(['efectivo', 'tarjeta', 'transferencia', 'otro']);

export const productUnitSchema = z.enum(['unidad', 'ml', 'g', 'l']);

/** Alta/edición de un artículo (perfume, envase, esencia o materia prima). */
export const productInputSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio'),
  brand_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  family_id: z.string().uuid().nullable().optional(),
  unit: productUnitSchema.default('unidad'),
  is_sellable: z.boolean().default(true),
  /** Plantilla estándar de la que salió su fórmula. */
  formula_template_id: z.string().uuid().nullable().optional(),
  /** Esencia que define su aroma. */
  essence_id: z.string().uuid().nullable().optional(),
  /** true cuando la fórmula se apartó de la plantilla. */
  is_custom_formula: z.boolean().optional(),
  description: z.string().optional(),
  gender: genderSchema.nullable().optional(),
  concentration: concentrationSchema.nullable().optional(),
  volume_ml: z.number().int().positive().nullable().optional(),
  barcode: z.string().min(3).nullable().optional(),
  sku: z.string().min(2).nullable().optional(),
  price: z.number().nonnegative('El precio no puede ser negativo'),
  cost: z.number().nonnegative().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
});
export type ProductInput = z.infer<typeof productInputSchema>;

/** Alta de un artículo desde el inventario, con sus existencias iniciales. */
export const newArticleSchema = productInputSchema.extend({
  quantity: z.number().int().nonnegative().default(0),
  min_quantity: z.number().int().nonnegative().default(0),
});
export type NewArticleInput = z.infer<typeof newArticleSchema>;

/** Un renglón del carrito del POS. */
export const cartItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive('La cantidad debe ser mayor a cero'),
});
export type CartItem = z.infer<typeof cartItemSchema>;

/** Payload para registrar una venta (mapea a la función register_sale). */
export const registerSaleSchema = z.object({
  store_id: z.string().uuid(),
  payment_method: paymentMethodSchema.default('efectivo'),
  discount: z.number().nonnegative().default(0),
  customer_id: z.string().uuid().nullable().optional(),
  items: z.array(cartItemSchema).min(1, 'La venta necesita al menos un artículo'),
});
export type RegisterSaleInput = z.infer<typeof registerSaleSchema>;

/** Payload para registrar un pedido (mapea a la función register_order). */
export const registerOrderSchema = z.object({
  store_id: z.string().uuid(),
  customer_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(cartItemSchema).min(1, 'El pedido necesita al menos un artículo'),
});
export type RegisterOrderInput = z.infer<typeof registerOrderSchema>;

/** Ajuste manual de stock. */
export const stockAdjustmentSchema = z.object({
  store_id: z.string().uuid(),
  product_id: z.string().uuid(),
  type: z.enum(['entrada', 'salida', 'ajuste']),
  quantity: z.number().int().positive(),
  reason: z.string().optional(),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
