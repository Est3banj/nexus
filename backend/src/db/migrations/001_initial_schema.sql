-- 001_initial_schema.sql
-- Execute this against Supabase SQL Editor or via migration tool
-- Datetime: 2026-05-25

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. ENUM types
CREATE TYPE inventory_status AS ENUM ('in_stock', 'sold', 'warranty');
CREATE TYPE movement_type AS ENUM ('intake', 'sale', 'warranty_send', 'warranty_return', 'adjustment');
CREATE TYPE user_role AS ENUM ('admin', 'employee');

-- 3. TABLES

-- 3.1 Brands
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    model_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(brand_id, model_name)
);

-- 3.4 Product Variants
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    storage_gb INTEGER NOT NULL,
    color VARCHAR(100) NOT NULL,
    sku VARCHAR(255) UNIQUE,
    sale_price_cents INTEGER NOT NULL CHECK (sale_price_cents > 0),
    cost_price_cents INTEGER,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, storage_gb, color)
);

-- 3.5 Inventory Items
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    imei1 VARCHAR(15) NOT NULL,
    imei2 VARCHAR(15),
    status inventory_status NOT NULL DEFAULT 'in_stock',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.6 Product Images
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7 Stock Movements
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    movement_type movement_type NOT NULL,
    quantity INTEGER NOT NULL,
    reference_note TEXT,
    performed_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8 User Profiles
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'employee',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes
CREATE UNIQUE INDEX idx_inventory_items_imei1 ON inventory_items(imei1);
CREATE UNIQUE INDEX idx_inventory_items_imei2 ON inventory_items(imei2) WHERE imei2 IS NOT NULL;
CREATE INDEX idx_inventory_items_status ON inventory_items(status);
CREATE INDEX idx_inventory_items_variant_status ON inventory_items(variant_id, status);
CREATE INDEX idx_stock_movements_variant_created ON stock_movements(variant_id, created_at DESC);
CREATE INDEX idx_products_model_name_trgm ON products USING GIN (model_name gin_trgm_ops);
CREATE INDEX idx_brands_name_trgm ON brands USING GIN (name gin_trgm_ops);
CREATE INDEX idx_inventory_items_imei1_trgm ON inventory_items USING GIN (imei1 gin_trgm_ops);
CREATE INDEX idx_inventory_items_imei2_trgm ON inventory_items USING GIN (imei2 gin_trgm_ops);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- 5. Enable Row Level Security
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 6. RLS helper functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_authenticated_active()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.1 Brands policies
CREATE POLICY "brands_select" ON brands FOR SELECT USING (is_authenticated_active());
CREATE POLICY "brands_insert" ON brands FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "brands_update" ON brands FOR UPDATE USING (is_admin());
CREATE POLICY "brands_delete" ON brands FOR DELETE USING (is_admin());

-- 6.2 Categories policies
CREATE POLICY "categories_select" ON categories FOR SELECT USING (is_authenticated_active());
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (is_admin());
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (is_admin());

-- 6.3 Products policies
CREATE POLICY "products_select" ON products FOR SELECT USING (is_authenticated_active());
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "products_update" ON products FOR UPDATE USING (is_admin());
CREATE POLICY "products_delete" ON products FOR DELETE USING (is_admin());

-- 6.4 Product Variants policies
CREATE POLICY "variants_select" ON product_variants FOR SELECT USING (is_authenticated_active());
CREATE POLICY "variants_insert" ON product_variants FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "variants_update" ON product_variants FOR UPDATE USING (is_admin());
CREATE POLICY "variants_delete" ON product_variants FOR DELETE USING (is_admin());

-- 6.5 Inventory Items policies
CREATE POLICY "items_select" ON inventory_items FOR SELECT USING (is_authenticated_active());
CREATE POLICY "items_insert" ON inventory_items FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "items_update" ON inventory_items FOR UPDATE USING (is_admin());
CREATE POLICY "items_delete" ON inventory_items FOR DELETE USING (is_admin());

-- 6.6 Product Images policies
CREATE POLICY "images_select" ON product_images FOR SELECT USING (is_authenticated_active());
CREATE POLICY "images_insert" ON product_images FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "images_update" ON product_images FOR UPDATE USING (is_admin());
CREATE POLICY "images_delete" ON product_images FOR DELETE USING (is_admin());

-- 6.7 Stock Movements policies
CREATE POLICY "movements_select" ON stock_movements FOR SELECT USING (is_authenticated_active());
CREATE POLICY "movements_insert" ON stock_movements FOR INSERT WITH CHECK (is_admin());

-- 6.8 User Profiles policies
CREATE POLICY "profiles_select_own" ON user_profiles FOR SELECT USING (
    auth.uid() = id OR is_admin()
);
CREATE POLICY "profiles_insert_own" ON user_profiles FOR INSERT WITH CHECK (
    auth.uid() = id
);
CREATE POLICY "profiles_update" ON user_profiles FOR UPDATE USING (
    auth.uid() = id OR is_admin()
);

-- 7. Auth trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, role, is_active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown'),
        'employee',
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
