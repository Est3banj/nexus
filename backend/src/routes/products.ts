import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { validateImeiPair } from '../lib/imei';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export function createProductsRouter() {
  const router = Router();

  // GET /api/products — list products with brand info
  router.get('/', authenticate(supabaseUrl, supabaseAnonKey), async (req, res) => {
    const { brand_id, search, page = '1', limit = '20' } = req.query;

    let query = req.supabase!
      .from('products')
      .select(`
        id, model_name, model_code, description, main_image_url, is_active, created_at,
        brand:brand_id(id, name, slug),
        variants:product_variants(
          id, storage_gb, color, sale_price_cents,
          inventory_items(count)
        )
      `, { count: 'exact' });

    query = query.eq('is_active', true);
    if (brand_id) query = query.eq('brand_id', brand_id);
    if (search) query = query.ilike('model_name', `%${search}%`);

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    const { data, error, count } = await query
      .order('model_name')
      .range(from, to);

    if (error) return res.status(500).json({ error: error.message });

    // Transform: flatten stock_count and strip cost_price for employees
    const products = data.map((p: any) => ({
      ...p,
      variants: p.variants?.map((v: any) => {
        const stock_count = v.inventory_items?.[0]?.count ?? 0;
        if (req.user?.role !== 'admin') {
          const { cost_price_cents, ...rest } = v;
          return { ...rest, stock_count, inventory_items: undefined };
        }
        return { ...v, stock_count, inventory_items: undefined };
      }) ?? [],
    }));

    res.json({ products, total: count, page: pageNum, limit: limitNum });
  });

  // GET /api/products/:id — product detail with variants + stock count
  router.get('/:id', authenticate(supabaseUrl, supabaseAnonKey), async (req, res) => {
    const { data: product, error } = await req.supabase!
      .from('products')
      .select(`
        *,
        brand:brand_id(id, name, slug),
        variants:product_variants(
          id, storage_gb, color, sale_price_cents, cost_price_cents,
          is_active, created_at,
          inventory_items(count)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Product not found' });

    // Transform variants to include stock count at top level
    product.variants = product.variants.map((v: any) => ({
      ...v,
      stock_count: v.inventory_items?.[0]?.count ?? 0,
      inventory_items: undefined, // limpiamos el formato anidado
    }));

    // If employee, strip cost_price from all variants
    if (req.user?.role !== 'admin') {
      product.variants = product.variants.map((v: any) => {
        const { cost_price_cents, ...rest } = v;
        return rest;
      });
    }

    res.json({ product });
  });

  // POST /api/products — create product (admin only)
  router.post('/', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { brand_id, model_name, description, category_id } = req.body;

    if (!brand_id || !model_name?.trim()) {
      return res.status(400).json({ error: 'Brand and model name are required' });
    }

    const { data, error } = await req.supabase!
      .from('products')
      .insert({ brand_id, model_name: model_name.trim(), description, category_id })
      .select(`
        *,
        brand:brand_id(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Product already exists for this brand' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ product: data });
  });

  // PUT /api/products/:id — update product (admin only)
  router.put('/:id', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { model_name, model_code, description, category_id, is_active } = req.body;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (model_name?.trim()) updates.model_name = model_name.trim();
    if (model_code !== undefined) updates.model_code = model_code?.trim() || null;
    if (description !== undefined) updates.description = description;
    if (category_id !== undefined) updates.category_id = category_id;
    if (typeof is_active === 'boolean') updates.is_active = is_active;

    const { data, error } = await req.supabase!
      .from('products')
      .update(updates)
      .eq('id', req.params.id)
      .select(`
        *,
        brand:brand_id(id, name, slug)
      `)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ product: data });
  });

  // DELETE /api/products/:id — deactivate product (admin only)
  router.delete('/:id', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    // Instead of hard delete, mark as inactive to preserve referential integrity
    const { data, error } = await req.supabase!
      .from('products')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, model_name, is_active')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: `Producto "${data.model_name}" desactivado`, product: data });
  });

  // POST /api/products/full — unified creation: brand + product + variants + stock (admin only)
  router.post('/full', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { brand_id, new_brand, model_name, description, model_code, main_image_url, variants } = req.body;

    // --- Validaciones ---
    if (!model_name?.trim()) {
      return res.status(400).json({ error: 'El nombre del modelo es requerido' });
    }

    if (!brand_id && !new_brand?.trim()) {
      return res.status(400).json({ error: 'Seleccione una marca o ingrese una nueva' });
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'Debe agregar al menos una variante' });
    }

    for (const v of variants) {
      if (!v.storage_gb || !v.color?.trim() || !v.sale_price_cents) {
        return res.status(400).json({ error: 'Cada variante requiere almacenamiento, color y precio de venta' });
      }
    }

    try {
      // Paso 1: Crear marca si es nueva
      let finalBrandId = brand_id;
      if (!finalBrandId && new_brand) {
        const slug = new_brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const { data: brand, error: brandError } = await req.supabase!
          .from('brands')
          .insert({ name: new_brand.trim(), slug })
          .select('id')
          .single();

        if (brandError) {
          if (brandError.code === '23505') {
            return res.status(409).json({ error: `La marca "${new_brand}" ya existe` });
          }
          throw brandError;
        }
        finalBrandId = brand.id;
      }

      // Paso 2: Crear producto
      const { data: product, error: productError } = await req.supabase!
        .from('products')
        .insert({
          brand_id: finalBrandId,
          model_name: model_name.trim(),
          description,
          model_code: model_code?.trim() || null,
          main_image_url: main_image_url || null,
        })
        .select('id, model_name, brand:brand_id(id, name)')
        .single();

      if (productError) throw productError;

      // Paso 3: Crear variantes y (opcional) registrar IMEIs
      const createdVariants: any[] = [];
      const imeiErrors: { variant: string; imei1: string; imei2?: string; error: string }[] = [];
      let totalImeisInserted = 0;

      for (const v of variants) {
        const { data: variant, error: variantError } = await req.supabase!
          .from('product_variants')
          .insert({
            product_id: product.id,
            storage_gb: v.storage_gb,
            color: v.color.trim(),
            sale_price_cents: v.sale_price_cents,
            cost_price_cents: v.cost_price_cents || null,
          })
          .select('id, storage_gb, color, sale_price_cents, cost_price_cents')
          .single();

        if (variantError) {
          if (variantError.code === '23505') {
            return res.status(409).json({
              error: `La variante ${v.storage_gb}GB ${v.color} ya existe para este producto`,
              created: { product, variants: createdVariants },
            });
          }
          throw variantError;
        }

        // Paso 4: Registrar IMEIs si se proporcionaron
        let insertedCount = 0;
        if (Array.isArray(v.items) && v.items.length > 0) {
          const validItems: { imei1: string; imei2?: string | null }[] = [];
          for (const item of v.items) {
            if (!item.imei1?.trim()) continue;
            const result = validateImeiPair(item.imei1, item.imei2);
            if (result.valid) {
              validItems.push({ imei1: result.imei1!, imei2: result.imei2 });
            } else {
              const errMsg = result.errors.map((e) => e.error).join('; ');
              imeiErrors.push({ variant: `${v.storage_gb}GB ${v.color}`, imei1: item.imei1, imei2: item.imei2, error: errMsg });
            }
          }

          // Verificar duplicados en DB (ambas columnas)
          if (validItems.length > 0) {
            const allImeis = validItems.flatMap((item) => {
              const vals: string[] = [item.imei1];
              if (item.imei2) vals.push(item.imei2);
              return vals;
            });

            const { data: existing } = await req.supabase!
              .from('inventory_items')
              .select('imei1, imei2')
              .or(`imei1.in.(${allImeis.join(',')}),imei2.in.(${allImeis.join(',')})`);

            const dbImeis = new Set<string>();
            if (existing) {
              for (const row of existing) {
                if (row.imei1) dbImeis.add(row.imei1);
                if (row.imei2) dbImeis.add(row.imei2);
              }
            }

            const uniqueItems = validItems.filter((item) => {
              const vals: string[] = [item.imei1];
              if (item.imei2) vals.push(item.imei2);
              const dup = vals.some((v) => dbImeis.has(v));
              if (dup) {
                imeiErrors.push({ variant: `${v.storage_gb}GB ${v.color}`, imei1: item.imei1, imei2: item.imei2 || undefined, error: 'IMEI ya registrado' });
              }
              return !dup;
            });

            if (uniqueItems.length > 0) {
              const records = uniqueItems.map((item) => ({
                variant_id: variant.id,
                imei1: item.imei1,
                imei2: item.imei2 || null,
                status: 'in_stock' as const,
              }));

              const { error: insertError } = await req.supabase!
                .from('inventory_items')
                .insert(records);

              if (!insertError) {
                insertedCount = uniqueItems.length;
                totalImeisInserted += insertedCount;

                // Log movement
                await req.supabase!.from('stock_movements').insert({
                  variant_id: variant.id,
                  movement_type: 'intake',
                  quantity: insertedCount,
                  performed_by: req.user!.id,
                  reference_note: `Entrada inicial de ${insertedCount} unidades`,
                });
              }
            }
          }
        }

        createdVariants.push({
          ...variant,
          stock_count: insertedCount,
          imei_errors: imeiErrors.filter((e) => e.variant === `${v.storage_gb}GB ${v.color}`).length > 0
            ? imeiErrors.filter((e) => e.variant === `${v.storage_gb}GB ${v.color}`)
            : undefined,
        });
      }

      res.status(201).json({
        product: {
          ...product,
          variants: createdVariants,
        },
        imei_errors: imeiErrors.length > 0 ? imeiErrors : undefined,
        summary: `Producto creado con ${createdVariants.length} variante(s) y ${totalImeisInserted} IMEI(s) registrados`,
      });
    } catch (err: any) {
      console.error('Error creating full product:', err);
      res.status(500).json({ error: err.message || 'Error al crear el producto' });
    }
  });

  return router;
}
