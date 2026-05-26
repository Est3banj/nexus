-- 002_dual_imei.sql
-- Migration: Split single imei column into imei1 (required) + imei2 (optional)
-- Requires: 001_initial_schema.sql to have been executed first

-- 1. Enable pg_trgm for trigram search indexes (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Drop old indexes that reference 'imei' column
DROP INDEX IF EXISTS idx_inventory_items_imei;
DROP INDEX IF EXISTS idx_inventory_items_imei_trgm;

-- 3. Rename imei → imei1 (preserves data and NOT NULL constraint)
ALTER TABLE inventory_items RENAME COLUMN imei TO imei1;

-- 4. Add imei2 column (optional, nullable)
ALTER TABLE inventory_items ADD COLUMN imei2 VARCHAR(15);

-- 5. Explicitly set imei2 to NULL for existing rows
UPDATE inventory_items SET imei2 = NULL;

-- 6. Unique indexes
CREATE UNIQUE INDEX idx_inventory_items_imei1 ON inventory_items(imei1);
CREATE UNIQUE INDEX idx_inventory_items_imei2 ON inventory_items(imei2) WHERE imei2 IS NOT NULL;

-- 7. Search indexes (GIN trigram for partial match)
CREATE INDEX idx_inventory_items_imei1_trgm ON inventory_items USING GIN (imei1 gin_trgm_ops);
CREATE INDEX idx_inventory_items_imei2_trgm ON inventory_items USING GIN (imei2 gin_trgm_ops);
