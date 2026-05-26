import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { validateImeiPair } from '../lib/imei';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export function createVariantsRouter() {
  const router = Router();

  // POST /api/products/:productId/variants — add variant (admin only)
  router.post('/products/:productId/variants', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { productId } = req.params;
    const { storage_gb, color, sale_price_cents, cost_price_cents, sku } = req.body;

    if (!storage_gb || !color?.trim() || !sale_price_cents) {
      return res.status(400).json({ error: 'Storage, color, and sale price are required' });
    }

    const { data, error } = await req.supabase!
      .from('product_variants')
      .insert({
        product_id: productId,
        storage_gb,
        color: color.trim(),
        sale_price_cents,
        cost_price_cents,
        sku,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Variant with this storage/color already exists' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ variant: data });
  });

  // PUT /api/variants/:id — update variant (admin only)
  router.put('/variants/:id', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { storage_gb, color, sale_price_cents, cost_price_cents, sku, is_active } = req.body;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (storage_gb) updates.storage_gb = storage_gb;
    if (color?.trim()) updates.color = color.trim();
    if (sale_price_cents) updates.sale_price_cents = sale_price_cents;
    if (cost_price_cents !== undefined) updates.cost_price_cents = cost_price_cents;
    if (sku !== undefined) updates.sku = sku;
    if (typeof is_active === 'boolean') updates.is_active = is_active;

    const { data, error } = await req.supabase!
      .from('product_variants')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ variant: data });
  });

  // GET /api/variants/:id — get variant detail with product info
  router.get('/variants/:id', authenticate(supabaseUrl, supabaseAnonKey), async (req, res) => {
    const { data, error } = await req.supabase!
      .from('product_variants')
      .select(`
        id, storage_gb, color, sale_price_cents, cost_price_cents,
        product:product_id(model_name, brand:brand_id(name))
      `)
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Variant not found' });

    // Si es empleado, ocultar costo
    if (req.user?.role !== 'admin') {
      const { cost_price_cents, ...rest } = data;
      return res.json({ variant: rest });
    }

    res.json({ variant: data });
  });

  // PATCH /api/variants/:id/toggle — activate/deactivate
  router.patch('/variants/:id/toggle', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { data: variant, error: fetchError } = await req.supabase!
      .from('product_variants')
      .select('is_active')
      .eq('id', req.params.id)
      .single();

    if (fetchError) return res.status(404).json({ error: 'Variant not found' });

    const { data, error } = await req.supabase!
      .from('product_variants')
      .update({ is_active: !variant.is_active, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ variant: data });
  });

  // POST /api/variants/:id/intake — register stock intake with IMEI pairs
  router.post('/variants/:id/intake', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de items con imei1 (y opcional imei2)' });
    }

    // Paso 1: Validar cada item con validateImeiPair
    const errors: { imei1: string; imei2?: string; error: string }[] = [];
    const validItems: { imei1: string; imei2?: string | null }[] = [];

    for (const item of items) {
      const result = validateImeiPair(item.imei1, item.imei2);
      if (result.valid) {
        validItems.push({ imei1: result.imei1!, imei2: result.imei2 });
      } else {
        const errMsg = result.errors.map((e) => e.error).join('; ');
        errors.push({ imei1: item.imei1, imei2: item.imei2, error: errMsg });
      }
    }

    // Paso 2: Verificar duplicados intra-batch
    if (validItems.length > 0) {
      const seenImei = new Map<string, number>();
      for (let i = validItems.length - 1; i >= 0; i--) {
        const item = validItems[i];
        const vals: string[] = [item.imei1];
        if (item.imei2) vals.push(item.imei2);
        let dupFound = false;
        for (const val of vals) {
          if (seenImei.has(val)) {
            errors.push({ imei1: item.imei1, imei2: item.imei2 || undefined, error: `IMEI ${val} duplicado dentro del lote` });
            validItems.splice(i, 1);
            dupFound = true;
            break;
          }
        }
        if (!dupFound) {
          for (const val of vals) {
            seenImei.set(val, i);
          }
        }
      }
    }

    // Paso 3: Verificar duplicados contra DB en ambas columnas
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

      if (existing && existing.length > 0) {
        const dbImeis = new Set<string>();
        for (const row of existing) {
          if (row.imei1) dbImeis.add(row.imei1);
          if (row.imei2) dbImeis.add(row.imei2);
        }

        for (let i = validItems.length - 1; i >= 0; i--) {
          const item = validItems[i];
          const vals: string[] = [item.imei1];
          if (item.imei2) vals.push(item.imei2);
          let dupFound = false;
          for (const val of vals) {
            if (dbImeis.has(val)) {
              errors.push({ imei1: item.imei1, imei2: item.imei2 || undefined, error: `IMEI ${val} ya registrado en el sistema` });
              validItems.splice(i, 1);
              dupFound = true;
              break;
            }
          }
        }
      }
    }

    // Paso 4: Insertar items válidos
    let inserted = 0;
    if (validItems.length > 0) {
      const records = validItems.map((item) => ({
        variant_id: req.params.id,
        imei1: item.imei1,
        imei2: item.imei2 || null,
        status: 'in_stock' as const,
      }));

      const { error: insertError } = await req.supabase!
        .from('inventory_items')
        .insert(records);

      if (insertError) {
        return res.status(500).json({ error: 'Error al guardar IMEIs: ' + insertError.message });
      }

      inserted = validItems.length;

      // Registrar movimiento de stock
      await req.supabase!.from('stock_movements').insert({
        variant_id: req.params.id,
        movement_type: 'intake',
        quantity: inserted,
        performed_by: req.user!.id,
        reference_note: `Entrada de ${inserted} unidades`,
      });
    }

    // Paso 5: Responder con resultado parcial si hay errores
    if (errors.length > 0) {
      return res.status(201).json({
        message: `${inserted} dispositivo(s) registrados, ${errors.length} error(es)`,
        inserted,
        errors,
      });
    }

    res.status(201).json({ message: `${inserted} dispositivo(s) registrados`, inserted });
  });

  // PATCH /api/inventory/:id/status — change IMEI status (admin only)
  router.patch('/inventory/:id/status', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { status, notes } = req.body;

    if (!status || !['in_stock', 'sold', 'warranty'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido. Debe ser: in_stock, sold, o warranty' });
    }

    // Fetch current item
    const { data: item, error: fetchError } = await req.supabase!
      .from('inventory_items')
      .select('id, variant_id, imei1, imei2, status')
      .eq('id', req.params.id)
      .single();

    if (fetchError) return res.status(404).json({ error: 'IMEI no encontrado' });

    if (item.status === status) {
      return res.status(400).json({ error: `El dispositivo ya está en estado "${status}"` });
    }

    // Mapear el tipo de movimiento según la transición
    function getMovementType(from: string, to: string): string {
      if (from === 'in_stock' && to === 'sold') return 'sale';
      if (from === 'in_stock' && to === 'warranty') return 'warranty_send';
      if (from === 'warranty' && to === 'in_stock') return 'warranty_return';
      if (from === 'sold' && to === 'warranty') return 'warranty_send';
      return 'adjustment';
    }

    const movementType = getMovementType(item.status, status);

    // Update status
    const { data: updated, error: updateError } = await req.supabase!
      .from('inventory_items')
      .update({
        status,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) return res.status(500).json({ error: updateError.message });

    // Log movement
    await req.supabase!.from('stock_movements').insert({
      variant_id: item.variant_id,
      movement_type: movementType,
      quantity: 1,
      performed_by: req.user!.id,
      reference_note: `IMEI ${item.imei1}: ${item.status} → ${status}${notes ? ` — ${notes}` : ''}`,
    });

    res.json({ inventory: updated });
  });

  // GET /api/inventory/search — search IMEIs by partial match
  router.get('/inventory/search', authenticate(supabaseUrl, supabaseAnonKey), async (req, res) => {
    const { q } = req.query;

    if (!q || (q as string).trim().length === 0) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido (?q=)' });
    }

    const searchTerm = (q as string).trim();

    const { data, error } = await req.supabase!
      .from('inventory_items')
      .select(`
        id, imei1, imei2, status, notes, created_at, updated_at,
        variant:variant_id(
          storage_gb, color, sale_price_cents, cost_price_cents,
          product:product_id(model_name, brand:brand_id(name))
        )
      `)
      .or(`imei1.ilike.%${searchTerm}%,imei2.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ error: error.message });

    // Stripear cost_price si no es admin
    let results = data;
    if (req.user?.role !== 'admin') {
      results = data.map((item: any) => {
        if (item.variant) {
          const { cost_price_cents, ...variantRest } = item.variant;
          return { ...item, variant: variantRest };
        }
        return item;
      });
    }

    res.json({ results, total: results.length });
  });

  // GET /api/inventory/:id/movements — stock movements for a specific inventory item
  router.get('/inventory/:id/movements', authenticate(supabaseUrl, supabaseAnonKey), async (req, res) => {
    const { data, error } = await req.supabase!
      .from('stock_movements')
      .select(`
        id, movement_type, quantity, reference_note, performed_by, created_at,
        variant:variant_id(storage_gb, color)
      `)
      .eq('inventory_item_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ movements: data });
  });

  // GET /api/variants/:id/inventory — list inventory items with IMEIs for a variant
  router.get('/variants/:id/inventory', authenticate(supabaseUrl, supabaseAnonKey), async (req, res) => {
    const { status } = req.query;

    let query = req.supabase!
      .from('inventory_items')
      .select('id, imei1, imei2, status, notes, created_at, updated_at')
      .eq('variant_id', req.params.id)
      .order('created_at', { ascending: false });

    if (status && ['in_stock', 'sold', 'warranty'].includes(status as string)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json({ inventory: data });
  });

  return router;
}
