// Cliente
export { createSupabaseClient, type SupabaseClient } from './client';

// Tipos de dominio / base de datos
export * from './database.types';

// Validaciones (Zod)
export * from './validation';

// Acceso a datos
export * from './api/auth';
export * from './api/products';
export * from './api/inventory';
export * from './api/sales';
export * from './api/orders';
export * from './api/contacts';
export * from './api/metrics';
export * from './api/stores';
export * from './api/families';
export * from './api/categories';
export * from './api/recipes';
export * from './api/templates';

// Utilidades
export * from './format';
