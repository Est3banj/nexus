-- 003_product_extras.sql
-- Adds model_code and main_image_url to products
-- Requires: 001_initial_schema.sql and 002_dual_imei.sql executed first

ALTER TABLE products ADD COLUMN IF NOT EXISTS model_code VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS main_image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_products_model_code ON products (model_code);
