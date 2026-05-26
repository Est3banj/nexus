export interface Brand {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  brand_id: string;
  category_id?: string;
  model_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  storage_gb: number;
  color: string;
  sku?: string;
  sale_price_cents: number;
  cost_price_cents?: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  variant_id: string;
  imei1: string;
  imei2?: string | null;
  status: 'in_stock' | 'sold' | 'warranty';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface IntakeItem {
  imei1: string;
  imei2?: string;
}

export interface IntakeRequest {
  items: IntakeItem[];
}

export type UserRole = 'admin' | 'employee';
export type InventoryStatus = 'in_stock' | 'sold' | 'warranty';
export type MovementType = 'intake' | 'sale' | 'warranty_send' | 'warranty_return' | 'adjustment';
